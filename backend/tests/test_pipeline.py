import pymupdf as fitz
import os
import tempfile
from unittest.mock import MagicMock, patch

from app.services.pdf.pipeline import process_pdf, process_document, extract_image_page

import pytest


def _create_test_pdf() -> str:
    doc = fitz.open()
    p1 = doc.new_page()
    p1.insert_text((72, 72), "DOSAGE AND ADMINISTRATION", fontsize=12)
    p1.insert_text((72, 100), "The recommended dose is 10 mg once daily.", fontsize=12)
    p2 = doc.new_page()
    p2.insert_text((72, 72), "CONTRAINDICATIONS", fontsize=12)
    p2.insert_text((72, 100), "Do not use in patients with hypersensitivity.", fontsize=12)
    fd, path = tempfile.mkstemp(suffix=".pdf")
    os.close(fd)
    doc.save(path)
    doc.close()
    return path


def _create_test_image() -> str:
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (400, 200), "white")
    draw = ImageDraw.Draw(img)
    draw.text((50, 50), "Paracetamol 500 mg", fill="black")
    draw.text((50, 100), "Take one tablet twice daily", fill="black")
    fd, path = tempfile.mkstemp(suffix=".png")
    os.close(fd)
    img.save(path)
    return path


def _create_mixed_pdf() -> str:
    """Create a PDF with native text on page 1 and an image on page 2."""
    from PIL import Image, ImageDraw
    import io

    img = Image.new("RGB", (300, 150), "white")
    draw = ImageDraw.Draw(img)
    draw.text((30, 30), "Image text content", fill="black")
    img_bytes = io.BytesIO()
    img.save(img_bytes, format="png")
    img_data = img_bytes.getvalue()

    doc = fitz.open()
    p1 = doc.new_page()
    p1.insert_text((72, 72), "DOSAGE AND ADMINISTRATION", fontsize=12)
    p1.insert_text((72, 100), "The recommended dose is 10 mg once daily.", fontsize=12)
    p2 = doc.new_page()
    p2.insert_image(fitz.Rect(50, 50, 250, 200), stream=img_data)
    fd, path = tempfile.mkstemp(suffix=".pdf")
    os.close(fd)
    doc.save(path)
    doc.close()
    return path


# ---------------------------------------------------------------------------
# Native PDF end-to-end
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_pipeline_end_to_end():
    path = _create_test_pdf()
    try:
        result = await process_pdf(path, "doc-001")
        assert result["success"] is True
        assert result["document_id"] == "doc-001"
        assert len(result["pages"]) == 2
        assert len(result["chunks"]) == 2

        for page in result["pages"]:
            assert page["document_id"] == "doc-001"
            assert page["page_no"] in (1, 2)
            assert page["extraction_method"] == "pymupdf"
            assert page["ocr_confidence"] is None

        for chunk in result["chunks"]:
            assert chunk["document_id"] == "doc-001"
            assert chunk["page_no"] in (1, 2)
            assert chunk["section_title"] is not None
            assert chunk["chunk_id"]
            assert chunk["chunk_index"] is not None
            assert chunk["extraction_method"]
            assert "10 mg" in chunk["text"] or "hypersensitivity" in chunk["text"]
    finally:
        os.unlink(path)


# ---------------------------------------------------------------------------
# Image dispatch → page_no=1 with computed quality_score and ocr_confidence
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_pipeline_image_dispatch():
    path = _create_test_image()
    try:
        with patch("app.services.pdf.pipeline.get_ocr_service") as mock_get, \
             patch("app.services.pdf.pipeline.QualityChecker") as mock_qc:
            mock_svc = MagicMock()
            mock_svc.ocr_image.return_value = {
                "text": "Paracetamol 500 mg\nTake one tablet twice daily",
                "confidence": 0.90,
                "extraction_method": "paddleocr",
                "success": True,
            }
            mock_get.return_value = mock_svc

            mock_checker = MagicMock()
            mock_checker.check.return_value = {
                "quality_score": 0.85,
                "needs_ocr": False,
                "char_count": 50,
                "word_count": 10,
                "garble_ratio": 0.0,
            }
            mock_qc.return_value = mock_checker

            result = await process_document(path, "doc-img-001")

        assert result["success"] is True
        assert len(result["pages"]) == 1
        assert result["pages"][0]["page_no"] == 1
        assert result["pages"][0]["ocr_confidence"] == 0.90
        assert result["pages"][0]["quality_score"] == 0.85
        assert result["pages"][0]["extraction_method"] == "paddleocr"
    finally:
        os.unlink(path)


# ---------------------------------------------------------------------------
# Mixed PDF (native text + rendered image) with mocked OCR engine
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_pipeline_mixed_pdf_with_mocked_ocr():
    path = _create_mixed_pdf()
    try:
        with patch("app.services.pdf.ocr.OCRService.ocr_page") as mock_ocr:
            mock_ocr.return_value = {
                "text": "Image text content",
                "confidence": 0.92,
                "extraction_method": "paddleocr",
                "success": True,
            }
            result = await process_pdf(path, "doc-mixed-001")

        assert result["success"] is True
        assert len(result["pages"]) == 2

        # Page 1: native text only
        assert result["pages"][0]["extraction_method"] == "pymupdf"
        assert result["pages"][0]["ocr_confidence"] is None

        # Page 2: has image → OCR triggered → merge
        assert "paddleocr" in result["pages"][1]["extraction_method"]
        assert result["pages"][1]["ocr_confidence"] == 0.92
        assert "image text content" in result["pages"][1]["text"].lower()
    finally:
        os.unlink(path)


# ---------------------------------------------------------------------------
# Process document dispatch — unsupported extension
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_process_document_unsupported_extension():
    with pytest.raises(ValueError, match="Unsupported file extension"):
        await process_document("test.txt", "doc-001")
