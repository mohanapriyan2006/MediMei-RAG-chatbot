import asyncio
import logging
import re
from typing import Callable, List, Optional

import pymupdf as fitz

from app.core.task_manager import task_manager

logger = logging.getLogger(__name__)

OCR_TIMEOUT_SECONDS = 120


def _normalize_line(line: str) -> str:
    """Normalise a single line for duplicate comparison."""
    return re.sub(r"\s+", " ", line).strip().lower()


def _merge_texts(native_text: str, ocr_text: str) -> str:
    """Merge native and OCR text, avoiding duplicate lines.

    Only exact (normalised) duplicates are removed — no fuzzy matching that
    could drop legitimate medical content.
    """
    if not ocr_text:
        return native_text
    if not native_text:
        return ocr_text

    native_lines = [l for l in native_text.splitlines() if l.strip()]
    native_set = {_normalize_line(l) for l in native_lines}

    unique_ocr_lines = []
    for line in ocr_text.splitlines():
        if line.strip() and _normalize_line(line) not in native_set:
            unique_ocr_lines.append(line)

    if not unique_ocr_lines:
        return native_text
    return native_text.rstrip() + "\n" + "\n".join(unique_ocr_lines)


async def extract_pdf_pages(
    file_path: str,
    document_id: Optional[str] = None,
    task_id: Optional[str] = None,
    on_progress: Optional[Callable[[int, int, str], None]] = None,
) -> List[dict]:
    """Extract page content using PyMuPDF, falling back to OCR when quality is low.

    Decision logic per page::

        PyMuPDF native text
            ↓
        image detection (page.get_images)
            ↓
        quality analysis (QualityChecker)
            ↓
        OCR triggered when:
            - chars < 30 OR words < 5 OR garble > 5%
            - OR page contains embedded images

        Scenario A — poor native text:
            OCR text *replaces* native (only if OCR is non-empty)

        Scenario B — good native text + images:
            native + unique OCR lines are *merged*

        OCR failure / timeout / empty:
            native text is always retained
    """
    pages: List[dict] = []
    doc = None
    try:
        await task_manager.raise_if_cancelled(task_id)
        doc = await asyncio.to_thread(fitz.open, file_path)
        total_pages = len(doc)

        from app.services.pdf.quality_checker import QualityChecker
        from app.services.pdf.ocr import get_ocr_service

        quality_checker = QualityChecker()
        ocr_service = get_ocr_service(use_gpu=True)

        for page_no, page in enumerate(doc, start=1):
            await task_manager.raise_if_cancelled(task_id)

            text, images, rect = await asyncio.gather(
                asyncio.to_thread(page.get_text, "text"),
                asyncio.to_thread(page.get_images, full=True),
                asyncio.to_thread(lambda p: p.rect, page),
            )

            text = (text or "").strip()
            image_count = len(images or [])
            page_width = rect.width
            page_height = rect.height

            # Quality check on native text
            page_record_raw = {
                "text": text,
                "page_width": page_width,
                "page_height": page_height,
            }
            quality_report = quality_checker.check(page_record_raw)
            quality_score = quality_report["quality_score"]

            needs_ocr = (
                quality_report["needs_ocr"]
                or image_count > 0
            )

            extraction_method = "pymupdf"
            ocr_confidence: Optional[float] = None

            if needs_ocr:
                if image_count > 0:
                    logger.info(
                        "Image detected in PDF page %s (%s images). OCR triggered.",
                        page_no, image_count,
                    )
                else:
                    logger.info(
                        "Page %s needs OCR fallback (chars: %s, words: %s, garble: %s, quality: %s)",
                        page_no,
                        quality_report["char_count"],
                        quality_report["word_count"],
                        quality_report["garble_ratio"],
                        quality_score,
                    )

                try:
                    ocr_result = await asyncio.wait_for(
                        asyncio.to_thread(
                            ocr_service.ocr_page, page, page_no, document_id
                        ),
                        timeout=OCR_TIMEOUT_SECONDS,
                    )
                except asyncio.TimeoutError:
                    logger.warning(
                        "OCR timed out after %ss for page %s. Keeping native text.",
                        OCR_TIMEOUT_SECONDS, page_no,
                    )
                    ocr_result = {
                        "text": "",
                        "confidence": 0.0,
                        "extraction_method": "ocr_failed",
                        "success": False,
                    }

                ocr_text = (ocr_result.get("text") or "").strip()
                ocr_success = ocr_result.get("success", False) and bool(ocr_text)
                ocr_method = ocr_result.get("extraction_method", "ocr_failed")

                if ocr_success:
                    ocr_confidence = ocr_result.get("confidence")
                    logger.info(
                        "OCR completed for page %s. Confidence: %s, method: %s",
                        page_no, ocr_confidence, ocr_method,
                    )

                    native_is_poor = quality_report["needs_ocr"]

                    if native_is_poor and not text:
                        # Scenario A: no native text → OCR replaces
                        text = ocr_text
                        extraction_method = ocr_method
                    elif native_is_poor:
                        # Scenario A: poor native text → OCR replaces (only if non-empty)
                        text = ocr_text
                        extraction_method = ocr_method
                    else:
                        # Scenario B: good native + images → merge
                        text = _merge_texts(text, ocr_text)
                        extraction_method = f"pymupdf+{ocr_method}"

                    # Recalculate quality on the final text
                    final_record = {
                        "text": text,
                        "page_width": page_width,
                        "page_height": page_height,
                    }
                    final_quality = quality_checker.check(final_record)
                    quality_score = final_quality["quality_score"]
                else:
                    logger.warning(
                        "OCR failed for page %s (method: %s). Retaining native text.",
                        page_no, ocr_method,
                    )
                    if not text:
                        extraction_method = ocr_method
                    # else: keep "pymupdf" — native text retained

            pages.append({
                "document_id": document_id,
                "page_no": page_no,
                "text": text,
                "extraction_method": extraction_method,
                "quality_score": quality_score,
                "ocr_confidence": ocr_confidence,
                "image_count": image_count,
                "page_width": page_width,
                "page_height": page_height,
            })

            if on_progress:
                on_progress(page_no, total_pages, "extracting")

    except Exception as exc:
        logger.error("PDF extraction failed for %s: %s", file_path, exc)
        raise
    finally:
        if doc is not None:
            try:
                await asyncio.to_thread(doc.close)
            except Exception:
                pass

    return pages
