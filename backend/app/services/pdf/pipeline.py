import asyncio
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.services.chunking.chunk_builder import build_chunks
from app.services.pdf.cleaner import clean_text
from app.services.pdf.extractor import extract_pdf_pages
from app.services.pdf.ocr import IMAGE_EXTENSIONS, get_ocr_service
from app.services.pdf.quality_checker import QualityChecker, QualityConfig
from app.services.pdf.section_detector import SectionDetector

logger = logging.getLogger(__name__)


async def extract_image_page(
    file_path: str,
    document_id: Optional[str] = None,
) -> List[dict]:
    """Extract text from a standalone image file via OCR.

    Returns a list with a single page record (page_no=1) using the same
    structure as ``extract_pdf_pages`` so downstream processing is unchanged.
    """
    from PIL import Image

    ocr_service = get_ocr_service(use_gpu=True)
    quality_checker = QualityChecker()

    # Get image dimensions
    try:
        img = Image.open(file_path)
        page_width = float(img.width)
        page_height = float(img.height)
        img.close()
    except Exception as exc:
        logger.warning("Could not read image dimensions for %s: %s", file_path, exc)
        page_width = 0.0
        page_height = 0.0

    ocr_result = ocr_service.ocr_image(file_path)
    ocr_text = (ocr_result.get("text") or "").strip()
    ocr_success = ocr_result.get("success", False) and bool(ocr_text)
    ocr_method = ocr_result.get("extraction_method", "ocr_failed")
    ocr_confidence = ocr_result.get("confidence") if ocr_success else None

    if ocr_success:
        text = ocr_text
        extraction_method = ocr_method
        logger.info("Image OCR completed for %s. Confidence: %s", file_path, ocr_confidence)
    else:
        text = ""
        extraction_method = ocr_method
        logger.warning("Image OCR failed for %s (method: %s)", file_path, ocr_method)

    page_record = {
        "text": text,
        "page_width": page_width,
        "page_height": page_height,
    }
    quality_report = quality_checker.check(page_record)
    quality_score = quality_report["quality_score"]

    return [{
        "document_id": document_id,
        "page_no": 1,
        "text": text,
        "extraction_method": extraction_method,
        "quality_score": quality_score,
        "ocr_confidence": ocr_confidence,
        "image_count": 1,
        "page_width": page_width,
        "page_height": page_height,
    }]


async def process_document(
    file_path: str,
    document_id: str,
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
    quality_config: Optional[QualityConfig] = None,
) -> Dict[str, Any]:
    """Run the complete ingestion pipeline on a PDF or standalone image.

    Dispatches based on file extension:
        .pdf → extract_pdf_pages
        image extensions → extract_image_page (OCR)

    Both paths produce the same page-record structure so downstream
    cleaning, section detection, chunking, and indexing remain unchanged.
    """
    ext = Path(file_path).suffix.lower()

    if ext == ".pdf":
        return await process_pdf(
            file_path, document_id, chunk_size, chunk_overlap, quality_config
        )
    elif ext in IMAGE_EXTENSIONS:
        return await _process_image(
            file_path, document_id, chunk_size, chunk_overlap, quality_config
        )
    else:
        raise ValueError(f"Unsupported file extension: {ext}")


async def _process_image(
    file_path: str,
    document_id: str,
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
    quality_config: Optional[QualityConfig] = None,
) -> Dict[str, Any]:
    """Run the ingestion pipeline on a standalone image file."""
    if not Path(file_path).is_file():
        raise FileNotFoundError(f"Image not found: {file_path}")

    section = SectionDetector()

    try:
        raw_pages = await extract_image_page(file_path, document_id)
    except Exception as exc:
        logger.error("Failed to extract image %s: %s", file_path, exc)
        return {
            "success": False,
            "error_code": "IMAGE_EXTRACTION_FAILED",
            "error": str(exc),
            "document_id": document_id,
            "pages": [],
            "chunks": [],
            "errors": [],
        }

    errors: List[Dict[str, Any]] = []
    processed_pages: List[Dict[str, Any]] = []
    current_section: Optional[str] = None

    for page in raw_pages:
        try:
            text = page["text"]
            method = page["extraction_method"]
            quality_score = page.get("quality_score", 1.0)
            ocr_confidence = page.get("ocr_confidence")

            cleaned = clean_text(text)
            current_section = section.detect(cleaned, current_section)
            if current_section is None:
                current_section = "Unknown"

            processed_pages.append({
                "document_id": document_id,
                "page_no": page["page_no"],
                "text": cleaned,
                "extraction_method": method,
                "image_count": page["image_count"],
                "page_width": page["page_width"],
                "page_height": page["page_height"],
                "section_title": current_section,
                "quality_score": quality_score,
                "ocr_confidence": ocr_confidence,
            })
        except Exception as exc:
            logger.error(
                "Error processing page %s of %s: %s",
                page.get("page_no"),
                file_path,
                exc,
            )
            errors.append({
                "page_no": page.get("page_no"),
                "error_code": "PAGE_PROCESSING_FAILED",
                "error": str(exc),
            })

    chunks = build_chunks(processed_pages, chunk_size, chunk_overlap, document_id)

    return {
        "success": len(errors) == 0 and len(processed_pages) > 0,
        "document_id": document_id,
        "pages": processed_pages,
        "chunks": chunks,
        "errors": errors,
    }


async def process_pdf(
    file_path: str,
    document_id: str,
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
    quality_config: Optional[QualityConfig] = None,
) -> Dict[str, Any]:
    """Run the complete Part 1 ingestion pipeline on a PDF.

    Returns a dict with:
      - success: bool
      - document_id: str
      - pages: list of cleaned page records
      - chunks: list of retrieval-ready chunks
      - errors: list of {page_no, error_code, error} objects
    """
    if not Path(file_path).is_file():
        raise FileNotFoundError(f"PDF not found: {file_path}")

    section = SectionDetector()

    try:
        raw_pages = await extract_pdf_pages(file_path, document_id)
    except Exception as exc:
        logger.error("Failed to extract PDF %s: %s", file_path, exc)
        return {
            "success": False,
            "error_code": "PDF_EXTRACTION_FAILED",
            "error": str(exc),
            "document_id": document_id,
            "pages": [],
            "chunks": [],
            "errors": [],
        }

    errors: List[Dict[str, Any]] = []
    processed_pages: List[Dict[str, Any]] = []
    current_section: Optional[str] = None

    for page in raw_pages:
        try:
            text = page["text"]
            method = page["extraction_method"]
            quality_score = page.get("quality_score", 1.0)
            ocr_confidence = page.get("ocr_confidence")

            cleaned = clean_text(text)
            current_section = section.detect(cleaned, current_section)
            if current_section is None:
                current_section = "Unknown"

            processed_pages.append({
                "document_id": document_id,
                "page_no": page["page_no"],
                "text": cleaned,
                "extraction_method": method,
                "image_count": page["image_count"],
                "page_width": page["page_width"],
                "page_height": page["page_height"],
                "section_title": current_section,
                "quality_score": quality_score,
                "ocr_confidence": ocr_confidence,
            })
        except Exception as exc:
            logger.error(
                "Error processing page %s of %s: %s",
                page.get("page_no"),
                file_path,
                exc,
            )
            errors.append({
                "page_no": page.get("page_no"),
                "error_code": "PAGE_PROCESSING_FAILED",
                "error": str(exc),
            })

    chunks = build_chunks(processed_pages, chunk_size, chunk_overlap, document_id)

    return {
        "success": len(errors) == 0 and len(processed_pages) > 0,
        "document_id": document_id,
        "pages": processed_pages,
        "chunks": chunks,
        "errors": errors,
    }

