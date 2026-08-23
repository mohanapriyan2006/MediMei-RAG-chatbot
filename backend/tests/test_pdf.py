import asyncio
import pytest
from unittest.mock import MagicMock, patch
from app.services.pdf.extractor import extract_pdf_pages, _merge_texts


def _make_mock_page(text, images=None):
    page = MagicMock()
    page.get_text.return_value = text
    page.get_images.return_value = images or []
    page.rect = MagicMock(width=612.0, height=792.0)
    return page


def _ocr_result(text, confidence=0.95, method="paddleocr", success=True):
    return {
        "text": text,
        "confidence": confidence,
        "extraction_method": method,
        "success": success and bool(text),
    }


# ---------------------------------------------------------------------------
# Merge helper
# ---------------------------------------------------------------------------

class TestMergeTexts:
    def test_merge_unique_lines(self):
        result = _merge_texts("line1\nline2", "line3\nline4")
        assert "line1" in result
        assert "line2" in result
        assert "line3" in result
        assert "line4" in result

    def test_merge_deduplicates(self):
        result = _merge_texts("line1\nline2", "line1\nline3")
        assert result.count("line1") == 1
        assert "line3" in result

    def test_merge_empty_ocr(self):
        assert _merge_texts("native", "") == "native"

    def test_merge_empty_native(self):
        assert _merge_texts("", "ocr") == "ocr"


# ---------------------------------------------------------------------------
# Native-only PDF (no OCR needed)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_extract_pdf_pages_native_only():
    mock_page = _make_mock_page(
        "This is page 1 content that is long enough to pass quality checker without OCR."
    )
    mock_doc = MagicMock()
    mock_doc.__iter__.return_value = iter([mock_page])

    with patch("fitz.open") as mock_open:
        mock_open.return_value = mock_doc
        pages = await extract_pdf_pages("fake_path.pdf")

    assert len(pages) == 1
    assert pages[0]["extraction_method"] == "pymupdf"
    assert pages[0]["quality_score"] == 1.0
    assert pages[0]["ocr_confidence"] is None
    assert pages[0]["image_count"] == 0


# ---------------------------------------------------------------------------
# Poor native text → OCR replaces
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_extract_pdf_pages_poor_native_replaced_by_ocr():
    mock_page = _make_mock_page("")
    mock_doc = MagicMock()
    mock_doc.__iter__.return_value = iter([mock_page])

    with patch("fitz.open") as mock_open, \
         patch("app.services.pdf.ocr.OCRService.ocr_page") as mock_ocr:
        mock_open.return_value = mock_doc
        mock_ocr.return_value = _ocr_result(
            "Extracted OCR text that is long enough to pass quality check."
        )
        pages = await extract_pdf_pages("fake_path.pdf", document_id="doc-001")

    assert len(pages) == 1
    assert pages[0]["text"] == "Extracted OCR text that is long enough to pass quality check."
    assert pages[0]["extraction_method"] == "paddleocr"
    assert pages[0]["ocr_confidence"] == 0.95


# ---------------------------------------------------------------------------
# Good native + images → merge
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_extract_pdf_pages_good_native_with_images_merges():
    native_text = "This is a clean page with plenty of characters and words for quality."
    mock_page = _make_mock_page(
        native_text,
        images=[("dummy_xref", 0, 0, 0, 0, "img", "DCTDecode", 0)],
    )
    mock_doc = MagicMock()
    mock_doc.__iter__.return_value = iter([mock_page])

    with patch("fitz.open") as mock_open, \
         patch("app.services.pdf.ocr.OCRService.ocr_page") as mock_ocr:
        mock_open.return_value = mock_doc
        mock_ocr.return_value = _ocr_result(
            "Additional text from image content.",
            confidence=0.88,
        )
        pages = await extract_pdf_pages("fake_path.pdf", document_id="doc-001")

    assert len(pages) == 1
    assert pages[0]["extraction_method"] == "pymupdf+paddleocr"
    assert native_text in pages[0]["text"]
    assert "Additional text from image content." in pages[0]["text"]
    assert pages[0]["ocr_confidence"] == 0.88
    assert pages[0]["image_count"] == 1


# ---------------------------------------------------------------------------
# OCR failure → retains native text
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_extract_pdf_pages_ocr_failure_retains_native():
    mock_page = _make_mock_page("Standard PyMuPDF text fallback content here.")
    mock_page.get_images.return_value = [("dummy_xref", 0, 0, 0, 0, "img", "DCTDecode", 0)]
    mock_doc = MagicMock()
    mock_doc.__iter__.return_value = iter([mock_page])

    with patch("fitz.open") as mock_open, \
         patch("app.services.pdf.ocr.OCRService.ocr_page") as mock_ocr:
        mock_open.return_value = mock_doc
        mock_ocr.return_value = {
            "text": "", "confidence": 0.0,
            "extraction_method": "ocr_failed", "success": False,
        }
        pages = await extract_pdf_pages("fake_path.pdf", document_id="doc-001")

    assert len(pages) == 1
    assert pages[0]["text"] == "Standard PyMuPDF text fallback content here."
    assert pages[0]["extraction_method"] == "pymupdf"
    assert pages[0]["ocr_confidence"] is None


# ---------------------------------------------------------------------------
# OCR timeout → retains native text
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_extract_pdf_pages_ocr_timeout_retains_native():
    mock_page = _make_mock_page("Native text that is good enough to keep.")
    mock_page.get_images.return_value = [("dummy_xref", 0, 0, 0, 0, "img", "DCTDecode", 0)]
    mock_doc = MagicMock()
    mock_doc.__iter__.return_value = iter([mock_page])

    with patch("fitz.open") as mock_open, \
         patch("app.services.pdf.ocr.OCRService.ocr_page") as mock_ocr:
        mock_open.return_value = mock_doc
        mock_ocr.side_effect = asyncio.TimeoutError()
        pages = await extract_pdf_pages("fake_path.pdf", document_id="doc-001")

    assert len(pages) == 1
    assert pages[0]["text"] == "Native text that is good enough to keep."
    assert pages[0]["extraction_method"] == "pymupdf"


# ---------------------------------------------------------------------------
# OCR returns empty → retains native text
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_extract_pdf_pages_ocr_empty_retains_native():
    mock_page = _make_mock_page("Good native text that should be retained fully.")
    mock_page.get_images.return_value = [("dummy_xref", 0, 0, 0, 0, "img", "DCTDecode", 0)]
    mock_doc = MagicMock()
    mock_doc.__iter__.return_value = iter([mock_page])

    with patch("fitz.open") as mock_open, \
         patch("app.services.pdf.ocr.OCRService.ocr_page") as mock_ocr:
        mock_open.return_value = mock_doc
        mock_ocr.return_value = _ocr_result("", success=False)
        pages = await extract_pdf_pages("fake_path.pdf", document_id="doc-001")

    assert len(pages) == 1
    assert pages[0]["text"] == "Good native text that should be retained fully."
    assert pages[0]["extraction_method"] == "pymupdf"


# ---------------------------------------------------------------------------
# OCR unavailable → retains native text
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_extract_pdf_pages_ocr_unavailable_retains_native():
    mock_page = _make_mock_page("Good native text that should be retained fully.")
    mock_page.get_images.return_value = [("dummy_xref", 0, 0, 0, 0, "img", "DCTDecode", 0)]
    mock_doc = MagicMock()
    mock_doc.__iter__.return_value = iter([mock_page])

    with patch("fitz.open") as mock_open, \
         patch("app.services.pdf.ocr.OCRService.ocr_page") as mock_ocr:
        mock_open.return_value = mock_doc
        mock_ocr.return_value = {
            "text": "", "confidence": 0.0,
            "extraction_method": "ocr_unavailable", "success": False,
        }
        pages = await extract_pdf_pages("fake_path.pdf", document_id="doc-001")

    assert len(pages) == 1
    assert pages[0]["text"] == "Good native text that should be retained fully."
    assert pages[0]["extraction_method"] == "pymupdf"


# ---------------------------------------------------------------------------
# Multi-page document
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_extract_pdf_pages_multi_page():
    mock_page_1 = _make_mock_page(
        "This is page 1 content that is long enough to pass quality checker without OCR."
    )
    mock_page_2 = _make_mock_page(
        "This is page 2 content that is also long enough to pass quality checker."
    )
    mock_doc = MagicMock()
    mock_doc.__iter__.return_value = iter([mock_page_1, mock_page_2])

    with patch("fitz.open") as mock_open:
        mock_open.return_value = mock_doc
        pages = await extract_pdf_pages("fake_path.pdf", document_id="doc-001")

    assert len(pages) == 2
    assert pages[0]["page_no"] == 1
    assert pages[1]["page_no"] == 2
    assert all(p["extraction_method"] == "pymupdf" for p in pages)
    assert all(p["ocr_confidence"] is None for p in pages)


@pytest.mark.asyncio
async def test_extract_pdf_pages_with_poor_text_but_no_images_skips_ocr():
    # Make a mock page with poor text, but no images. Should not trigger OCR.
    mock_page = _make_mock_page("Bad")
    mock_page.get_images.return_value = []

    mock_doc = MagicMock()
    mock_doc.__iter__.return_value = iter([mock_page])

    with patch("fitz.open") as mock_open, \
         patch("app.services.pdf.ocr.OCRService.ocr_page") as mock_ocr_page:

        mock_open.return_value = mock_doc

        pages = await extract_pdf_pages("fake_path.pdf", document_id="doc-001")

        assert len(pages) == 1
        assert pages[0]["document_id"] == "doc-001"
        assert pages[0]["page_no"] == 1
        assert pages[0]["text"] == "Bad"
        assert pages[0]["extraction_method"] == "pymupdf"
        assert pages[0]["image_count"] == 0
        mock_ocr_page.assert_not_called()



