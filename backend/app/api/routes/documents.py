import os
import uuid
import logging
from typing import List

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File,
    BackgroundTasks,
    Header,
    status
)
from fastapi.responses import FileResponse

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db.database import get_db_session

from app.models.document import Document
from app.models.document_page import DocumentPage

from app.schemas.document import (
    DocumentUploadResponse,
    DocumentResponse,
    DocumentProcessResponse,
    DocumentUpdate,
    DocumentStatusResponse,
)

from app.services.pdf.extractor import extract_pdf_pages
from app.services.pdf.pipeline import extract_image_page
from app.services.pdf.ocr import IMAGE_EXTENSIONS
from app.services.chunking.chunker import create_chunks

from app.core.config import settings
from app.core.task_manager import task_manager, TaskCancelledError


logger = logging.getLogger(__name__)

router = APIRouter(tags=["documents"])


# =====================================================
# UPLOAD DIRECTORY
# =====================================================

UPLOAD_DIR = os.path.join(
    os.path.dirname(
        os.path.dirname(
            os.path.dirname(
                os.path.dirname(__file__)
            )
        )
    ),
    "data",
    "uploads"
)

os.makedirs(UPLOAD_DIR, exist_ok=True)


# =====================================================
# BACKGROUND PROCESSING
# =====================================================

async def simulate_processing_task(
    document_id: str,
    db_session_factory,
    task_id: str = "",
):
    """
    Process document:

    PDF
      ↓
    Extract pages (with progress updates)
      ↓
    Save document_pages
      ↓
    Create chunks + embeddings (with progress updates)
      ↓
    Index in Qdrant
      ↓
    Mark document completed
    """

    logger.info(
        f"Starting background processing for document: {document_id}"
    )

    async for db in db_session_factory():

        try:

            await task_manager.raise_if_cancelled(task_id)

            # -----------------------------------------
            # 1. Find document
            # -----------------------------------------

            result = await db.execute(
                select(Document).filter(
                    Document.document_id == document_id
                )
            )

            doc = result.scalar_one_or_none()

            if not doc:
                logger.error(
                    f"Document {document_id} not found in DB."
                )
                return

            await task_manager.raise_if_cancelled(task_id)

            # -----------------------------------------
            # 2. Update status → processing
            # -----------------------------------------

            doc.status = "processing"
            doc.stage = "extraction"
            doc.progress = 0
            doc.progress_detail = "Starting extraction…"

            await db.commit()

            await task_manager.raise_if_cancelled(task_id)

            # -----------------------------------------
            # 3. Find uploaded file
            # -----------------------------------------

            file_path = os.path.join(
                UPLOAD_DIR,
                f"{document_id}_{doc.file_name}"
            )

            logger.info(
                f"Reading file from: {file_path}"
            )

            if not os.path.exists(file_path):

                raise FileNotFoundError(
                    f"File not found: {file_path}"
                )

            # -----------------------------------------
            # 4. Extract pages (with progress)
            #    Dispatch based on file type:
            #    .pdf → PDF processor (PyMuPDF + OCR fallback)
            #    image extensions → image OCR processor
            # -----------------------------------------

            file_ext = os.path.splitext(file_path)[1].lower()
            is_image = file_ext in IMAGE_EXTENSIONS

            async def on_extraction_progress(current, total, stage):
                pct = int((current / total) * 50) if total > 0 else 0
                doc.stage = "extraction"
                doc.progress = pct
                doc.progress_detail = f"Extracting page {current}/{total}"
                try:
                    await db.commit()
                except Exception:
                    await db.rollback()

            try:
                if is_image:
                    logger.info("Processing image file %s via OCR", file_path)
                    pages = await extract_image_page(
                        file_path,
                        document_id=document_id,
                    )
                    # Update progress for single-page image
                    if on_extraction_progress:
                        await on_extraction_progress(1, 1, "extracting")
                else:
                    pages = await extract_pdf_pages(
                        file_path,
                        document_id=document_id,
                        task_id=task_id,
                        on_progress=on_extraction_progress,
                    )
            except Exception as exc:
                logger.error("Document extraction failed: %s", exc)
                raise

            await task_manager.raise_if_cancelled(task_id)

            if not pages:
                logger.warning(
                    "No pages were extracted from %s; completing with empty document.",
                    file_path,
                )
                doc.status = "completed"
                doc.stage = "completed"
                doc.progress = 100
                doc.progress_detail = "No pages extracted"
                doc.page_count = 0
                await db.commit()
                return

            logger.info(
                f"Extracted {len(pages)} pages."
            )

            # -----------------------------------------
            # 5. Remove old page records
            # -----------------------------------------

            old_pages_result = await db.execute(
                select(DocumentPage).filter(
                    DocumentPage.document_id == document_id
                )
            )

            old_pages = old_pages_result.scalars().all()

            for old_page in old_pages:

                await db.delete(old_page)

            await db.flush()

            await task_manager.raise_if_cancelled(task_id)

            # -----------------------------------------
            # 6. Save extracted pages
            # -----------------------------------------

            doc.stage = "saving_pages"
            doc.progress = 55
            doc.progress_detail = f"Saving {len(pages)} pages…"
            await db.commit()

            for page in pages:

                await task_manager.raise_if_cancelled(task_id)

                document_page = DocumentPage(
                    document_id=document_id,
                    page_no=page["page_no"],
                    extraction_method=page["extraction_method"],
                    quality_score=page.get("quality_score", 1.0),
                    text_ref=page["text"]
                )

                db.add(document_page)

            await db.commit()

            logger.info(
                f"Saved {len(pages)} document pages "
                f"for document {document_id}"
            )

            # -----------------------------------------
            # 7. Create chunks + embeddings (with progress)
            # -----------------------------------------

            doc.stage = "chunking"
            doc.progress = 60
            doc.progress_detail = "Chunking text and generating embeddings…"
            await db.commit()

            await task_manager.raise_if_cancelled(task_id)

            async def on_embedding_progress(current, total, stage):
                # Embedding progress maps to 60%–95% range
                pct = 60 + int((current / total) * 35) if total > 0 else 60
                doc.stage = "embedding"
                doc.progress = pct
                doc.progress_detail = f"Embedding chunk {current}/{total}"
                try:
                    await db.commit()
                except Exception:
                    await db.rollback()

            chunk_count = await create_chunks(
                document_id,
                db,
                task_id=task_id,
                on_progress=on_embedding_progress,
                page_ocr_confidence={
                    p["page_no"]: p.get("ocr_confidence")
                    for p in pages
                    if p.get("ocr_confidence") is not None
                },
            )

            logger.info(
                f"Created {chunk_count} chunks "
                f"for document {document_id}"
            )

            await task_manager.raise_if_cancelled(task_id)

            # -----------------------------------------
            # 8. Mark document completed
            # -----------------------------------------

            doc.status = "completed"
            doc.stage = "completed"
            doc.progress = 100
            doc.progress_detail = f"Ready — {len(pages)} pages, {chunk_count} chunks"
            doc.page_count = len(pages)

            await db.commit()

            logger.info(
                f"Completed processing for document: "
                f"{document_id}"
            )


        except TaskCancelledError:
            logger.info("Document processing cancelled for %s", document_id)
            try:
                await db.rollback()
                result = await db.execute(
                    select(Document).filter(
                        Document.document_id == document_id
                    )
                )
                doc = result.scalar_one_or_none()
                if doc:
                    doc.status = "failed"
                    doc.stage = "cancelled"
                    doc.progress_detail = "Processing cancelled by user"
                    await db.commit()
            except Exception:
                await db.rollback()
            return

        except Exception as e:

            logger.error(
                f"Error processing document "
                f"{document_id}: {str(e)}"
            )

            # -----------------------------------------
            # Mark document as failed
            # -----------------------------------------

            try:

                await db.rollback()

                result = await db.execute(
                    select(Document).filter(
                        Document.document_id == document_id
                    )
                )

                doc = result.scalar_one_or_none()

                if doc:

                    doc.status = "failed"
                    doc.stage = "failed"
                    doc.progress_detail = f"Error: {str(e)[:200]}"

                    await db.commit()

            except Exception:

                await db.rollback()


        break


# =====================================================
# UPLOAD DOCUMENT
# =====================================================

@router.post(
    "/upload",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_201_CREATED
)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    source: str = None,
    version: str = "1.0",
    x_task_id: str = Header(default=""),
    db: AsyncSession = Depends(get_db_session)
):

    # -----------------------------------------
    # 1. Validate file format
    # -----------------------------------------

    allowed_extensions = (".pdf", ".docx", ".doc", ".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff", ".tif")
    if not file.filename.lower().endswith(allowed_extensions):

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Only PDF, DOCX, DOC, and image files (PNG, JPG, JPEG, WEBP, BMP, TIFF) are supported."
        )


    # -----------------------------------------
    # 2. Create document ID
    # -----------------------------------------

    doc_id = str(uuid.uuid4())

    storage_key = (
        f"documents/{doc_id}_{file.filename}"
    )

    local_path = os.path.join(
        UPLOAD_DIR,
        f"{doc_id}_{file.filename}"
    )


    # -----------------------------------------
    # 3. Save PDF
    # -----------------------------------------

    try:

        content = await file.read()

        file_size_mb = (
            len(content) / (1024 * 1024)
        )


        if file_size_mb > settings.MAX_UPLOAD_SIZE_MB:

            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=(
                    f"File exceeds maximum allowed size of "
                    f"{settings.MAX_UPLOAD_SIZE_MB}MB."
                )
            )


        with open(local_path, "wb") as f:

            f.write(content)


        logger.info(
            f"Saved PDF to: {local_path}"
        )


        # -----------------------------------------
        # Cloudflare R2
        # -----------------------------------------

        if settings.R2_ENDPOINT_URL:

            logger.info(
                f"Uploading {file.filename} "
                f"to Cloudflare R2: {storage_key}"
            )


    except HTTPException:

        raise


    except Exception as e:

        logger.error(
            f"Failed to write file: {e}"
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file content: {str(e)}"
        )


    # -----------------------------------------
    # 4. Save document record
    # -----------------------------------------

    new_doc = Document(
        document_id=doc_id,
        file_name=file.filename,
        storage_key=storage_key,
        source=(
            source
            or file.filename.rsplit(".", 1)[0]
        ),
        version=version,
        status="uploaded"
    )

    db.add(new_doc)

    await db.commit()

    await db.refresh(new_doc)

    new_doc.file_size = len(content)
    new_doc.page_count = 0

    # -----------------------------------------
    # 5. Start processing
    # -----------------------------------------

    background_tasks.add_task(
        simulate_processing_task,
        doc_id,
        get_db_session,
        task_id=x_task_id,
    )


    # -----------------------------------------
    # 6. Return response
    # -----------------------------------------

    return DocumentUploadResponse(
        document=DocumentResponse.model_validate(new_doc),
        message=(
            "Document uploaded successfully. "
            "Processing started in background."
        )
    )


# =====================================================
# LIST DOCUMENTS
# =====================================================

@router.get(
    "",
    response_model=List[DocumentResponse]
)
async def list_documents(
    db: AsyncSession = Depends(get_db_session)
):

    result = await db.execute(
        select(Document)
    )

    documents = result.scalars().all()

    from sqlalchemy import func
    page_counts_result = await db.execute(
        select(DocumentPage.document_id, func.count(DocumentPage.page_no))
        .group_by(DocumentPage.document_id)
    )
    page_counts = {doc_id: count for doc_id, count in page_counts_result.all()}

    for doc in documents:
        doc.page_count = page_counts.get(doc.document_id, 0)
        file_path = os.path.join(UPLOAD_DIR, f"{doc.document_id}_{doc.file_name}")
        doc.file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0

    return [
        DocumentResponse.model_validate(doc)
        for doc in documents
    ]


# =====================================================
# GET SINGLE DOCUMENT
# =====================================================

@router.get(
    "/{document_id}",
    response_model=DocumentResponse
)
async def get_document(
    document_id: str,
    db: AsyncSession = Depends(get_db_session)
):

    result = await db.execute(
        select(Document).filter(
            Document.document_id == document_id
        )
    )

    doc = result.scalar_one_or_none()

    if not doc:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found."
        )

    from sqlalchemy import func
    page_count_result = await db.execute(
        select(func.count(DocumentPage.page_no))
        .where(DocumentPage.document_id == document_id)
    )
    doc.page_count = page_count_result.scalar() or 0
    file_path = os.path.join(UPLOAD_DIR, f"{doc.document_id}_{doc.file_name}")
    doc.file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0

    return DocumentResponse.model_validate(doc)


# =====================================================
# PROCESS / REPROCESS DOCUMENT
# =====================================================

@router.post(
    "/{document_id}/process",
    response_model=DocumentProcessResponse
)
async def process_document(
    document_id: str,
    background_tasks: BackgroundTasks,
    x_task_id: str = Header(default=""),
    db: AsyncSession = Depends(get_db_session)
):

    # -----------------------------------------
    # 1. Find document
    # -----------------------------------------

    result = await db.execute(
        select(Document).filter(
            Document.document_id == document_id
        )
    )

    doc = result.scalar_one_or_none()

    if not doc:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found."
        )


    # -----------------------------------------
    # 2. Reset status
    # -----------------------------------------

    doc.status = "uploaded"

    await db.commit()

    await db.refresh(doc)


    # -----------------------------------------
    # 3. Start processing
    # -----------------------------------------

    background_tasks.add_task(
        simulate_processing_task,
        document_id,
        get_db_session,
        task_id=x_task_id,
    )


    # -----------------------------------------
    # 4. Return response
    # -----------------------------------------

    return DocumentProcessResponse(
        document_id=document_id,
        job_id=str(uuid.uuid4()),
        stage="extraction",
        status="uploaded",
        message="Document reprocessing pipeline triggered."
    )


# =====================================================
# DELETE DOCUMENT
# =====================================================

@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: str,
    db: AsyncSession = Depends(get_db_session)
):
    # 1. Find document
    result = await db.execute(
        select(Document).filter(
            Document.document_id == document_id
        )
    )
    doc = result.scalar_one_or_none()

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found."
        )

    # 2. Delete related records
    from app.models.chunk import Chunk
    from app.models.citation import Citation
    from app.models.document_page import DocumentPage
    from app.repositories.qdrant_repository import qdrant_repository

    # Delete chunks from Qdrant vector database
    try:
        await qdrant_repository.delete_document_chunks(document_id)
    except Exception as e:
        logger.error(f"Failed to delete Qdrant chunks for document {document_id}: {e}")

    await db.execute(
        delete(Chunk).where(Chunk.document_id == document_id)
    )
    await db.execute(
        delete(DocumentPage).where(DocumentPage.document_id == document_id)
    )
    await db.execute(
        delete(Citation).where(Citation.document_id == document_id)
    )

    # 3. Delete document
    await db.delete(doc)
    await db.commit()
    return


# =====================================================
# UPDATE DOCUMENT METADATA
# =====================================================

@router.patch(
    "/{document_id}",
    response_model=DocumentResponse
)
async def update_document(
    document_id: str,
    update: DocumentUpdate,
    db: AsyncSession = Depends(get_db_session)
):
    result = await db.execute(
        select(Document).filter(Document.document_id == document_id)
    )
    doc = result.scalar_one_or_none()

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found."
        )

    if update.source is not None:
        doc.source = update.source
    if update.version is not None:
        doc.version = update.version
    if update.file_name is not None:
        doc.file_name = update.file_name

    await db.commit()
    await db.refresh(doc)

    from sqlalchemy import func
    page_count_result = await db.execute(
        select(func.count(DocumentPage.page_no))
        .where(DocumentPage.document_id == document_id)
    )
    doc.page_count = page_count_result.scalar() or 0
    file_path = os.path.join(UPLOAD_DIR, f"{doc.document_id}_{doc.file_name}")
    doc.file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0

    return DocumentResponse.model_validate(doc)


# =====================================================
# GET DOCUMENT STATUS
# =====================================================

@router.get(
    "/{document_id}/status",
    response_model=DocumentStatusResponse
)
async def get_document_status(
    document_id: str,
    db: AsyncSession = Depends(get_db_session)
):
    result = await db.execute(
        select(Document).filter(Document.document_id == document_id)
    )
    doc = result.scalar_one_or_none()

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found."
        )

    return DocumentStatusResponse(
        document_id=doc.document_id,
        status=doc.status,
        stage=doc.stage or doc.status,
        progress=doc.progress or 0,
        progress_detail=doc.progress_detail,
        message=f"Document is currently {doc.status}."
    )


# =====================================================
# VIEW / DOWNLOAD PDF
# =====================================================

@router.get("/{document_id}/view")
async def view_document(
    document_id: str,
    db: AsyncSession = Depends(get_db_session)
):
    import mimetypes
    result = await db.execute(
        select(Document).filter(Document.document_id == document_id)
    )
    doc = result.scalar_one_or_none()

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found."
        )

    file_path = os.path.join(
        UPLOAD_DIR,
        f"{document_id}_{doc.file_name}"
    )

    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document file not found on disk."
        )

    content_type, _ = mimetypes.guess_type(doc.file_name)
    if not content_type:
        if doc.file_name.lower().endswith(".docx"):
            content_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        elif doc.file_name.lower().endswith(".doc"):
            content_type = "application/msword"
        elif doc.file_name.lower().endswith(".pdf"):
            content_type = "application/pdf"
        else:
            content_type = "application/octet-stream"

    return FileResponse(
        file_path,
        media_type=content_type,
        filename=doc.file_name
    )


# =====================================================
# GET DOCUMENT CHUNKS / EXTRACTED TEXT
# =====================================================

@router.get("/{document_id}/chunks")
async def get_document_chunks(
    document_id: str,
    db: AsyncSession = Depends(get_db_session)
):
    from app.models.chunk import Chunk
    result = await db.execute(
        select(Chunk)
        .filter(Chunk.document_id == document_id)
        .order_by(Chunk.page_no, Chunk.chunk_index)
    )
    chunks = result.scalars().all()
    return [
        {
            "chunk_id": str(c.chunk_id),
            "page_no": c.page_no or 1,
            "section": c.section or "Document Content",
            "text": c.chunk_text or ""
        }
        for c in chunks
    ]