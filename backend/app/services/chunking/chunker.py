import asyncio
import logging
from typing import Callable, Optional
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document_page import DocumentPage
from app.models.chunk import Chunk
from app.models.document import Document
from app.services.embeddings.embedding_service import embedding_service
from app.repositories.qdrant_repository import qdrant_repository
from app.services.pdf.cleaner import clean_text
from app.core.task_manager import task_manager, TaskCancelledError

logger = logging.getLogger(__name__)

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200
EMBEDDING_BATCH_SIZE = 32


def split_text(text):
    text = text.strip()

    if not text:
        return []

    chunks = []
    start = 0

    while start < len(text):
        end = start + CHUNK_SIZE
        chunk = text[start:end].strip()

        if chunk:
            chunks.append(chunk)

        if end >= len(text):
            break

        start = end - CHUNK_OVERLAP

    return chunks


async def create_chunks(
    document_id: str,
    db: AsyncSession,
    task_id: str = "",
    on_progress: Optional[Callable[[int, int, str], None]] = None,
    page_ocr_confidence: Optional[dict] = None,
):
    """
    Chunk document page text, save chunks to MySQL, generate embeddings,
    and bulk index them into Qdrant vector database.
    """
    # 1. Fetch the Document record to get metadata (e.g. file_name)
    doc_result = await db.execute(
        select(Document).where(Document.document_id == document_id)
    )
    doc = doc_result.scalar_one_or_none()
    if not doc:
        logger.error(f"Document {document_id} not found in database.")
        return 0

    # 2. Get all extracted pages
    result = await db.execute(
        select(DocumentPage)
        .where(DocumentPage.document_id == document_id)
        .order_by(DocumentPage.page_no)
    )
    pages = result.scalars().all()
    page_quality_map = {
        page.page_no: (page.quality_score if page.quality_score is not None else 1.0)
        for page in pages
    }
    page_ocr_conf_map = page_ocr_confidence or {}
    page_extraction_method_map = {
        page.page_no: page.extraction_method
        for page in pages
    }

    if not pages:
        logger.warning(f"No pages found for document {document_id}.")
        return 0

    # 3. Clean up existing chunks in MySQL and Qdrant if reprocessing
    await db.execute(
        delete(Chunk).where(Chunk.document_id == document_id)
    )
    try:
        await qdrant_repository.delete_document_chunks(document_id)
    except Exception as exc:
        logger.warning(f"Qdrant cleanup failed for {document_id}: {exc}")
    await db.flush()

    # 4. Perform text chunking on each page
    total_chunks = 0
    for page in pages:
        cleaned_text = clean_text(page.text_ref)
        if not cleaned_text:
            continue

        page_chunks = split_text(cleaned_text)

        for index, text in enumerate(page_chunks):
            chunk = Chunk(
                document_id=document_id,
                page_no=page.page_no,
                section=None,  # Section detection will update this if applicable
                chunk_index=total_chunks,  # Unique sequential index across document
                text_hash=None,
                chunk_text=text
            )
            db.add(chunk)
            total_chunks += 1

    # Commit chunks to MySQL to generate auto-incrementing chunk_ids
    await db.commit()

    if total_chunks == 0:
        return 0

    # 5. Retrieve committed chunks from MySQL to get populated chunk_ids
    chunks_result = await db.execute(
        select(Chunk)
        .where(Chunk.document_id == document_id)
        .order_by(Chunk.chunk_index)
    )
    db_chunks = chunks_result.scalars().all()

    # 6. Batch embed all chunk texts in small batches with progress updates
    await task_manager.raise_if_cancelled(task_id)
    logger.info(f"Generating embeddings for {len(db_chunks)} chunks of document: {doc.file_name}")
    chunk_texts = [c.chunk_text for c in db_chunks]

    all_embeddings: list = []
    total_batches = (len(chunk_texts) + EMBEDDING_BATCH_SIZE - 1) // EMBEDDING_BATCH_SIZE

    try:
        for batch_idx in range(total_batches):
            await task_manager.raise_if_cancelled(task_id)

            start_idx = batch_idx * EMBEDDING_BATCH_SIZE
            end_idx = min(start_idx + EMBEDDING_BATCH_SIZE, len(chunk_texts))
            batch_texts = chunk_texts[start_idx:end_idx]

            batch_embeddings = await asyncio.to_thread(
                embedding_service.create_embeddings, batch_texts
            )
            all_embeddings.extend(batch_embeddings)

            if on_progress:
                on_progress(end_idx, len(chunk_texts), "embedding")

    except Exception as exc:
        logger.error(f"Embedding generation failed for {document_id}: {exc}")
        # Chunks are saved in MySQL; Qdrant indexing will be skipped.
        return total_chunks

    await task_manager.raise_if_cancelled(task_id)

    # 7. Index chunks in Qdrant Vector DB (best-effort — chunks are already in MySQL)
    logger.info(f"Indexing {len(db_chunks)} chunks in Qdrant for document: {doc.file_name}")

    # Make sure Qdrant collection is created with the real model dimension.
    qdrant_repository.set_vector_size(embedding_service.vector_size)

    qdrant_chunks = []
    for chunk, emb in zip(db_chunks, all_embeddings):
        qdrant_chunks.append({
            "chunk_id": chunk.chunk_id,  # BigInteger MySQL primary key serves as Qdrant ID
            "document_id": document_id,
            "document_name": doc.file_name,
            "page_no": chunk.page_no,
            "section": chunk.section,
            "chunk_index": chunk.chunk_index,
            "chunk_text": chunk.chunk_text,
            "embedding": emb,
            "quality_score": page_quality_map.get(chunk.page_no, 1.0),
            "ocr_confidence": page_ocr_conf_map.get(chunk.page_no),
            "extraction_method": page_extraction_method_map.get(chunk.page_no),
        })

    try:
        await qdrant_repository.add_chunks(qdrant_chunks)
        logger.info(f"Successfully chunked and indexed {total_chunks} chunks for document: {doc.file_name}")
    except Exception as exc:
        logger.warning(
            f"Qdrant indexing failed for {document_id}: {exc}. "
            f"Chunks saved to MySQL but not vector-indexed."
        )

    return total_chunks