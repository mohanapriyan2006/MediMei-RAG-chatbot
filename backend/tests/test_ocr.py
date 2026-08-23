import os
import tempfile
from unittest.mock import MagicMock, patch

import pytest
from PIL import Image

from app.services.pdf.ocr import (
    OCRService,
    _normalize_ocr_text,
    _reset_ocr_service,
    get_ocr_service,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_ocr_service(engine: str = "paddleocr"):
    """Create an OCRService with mocked engines for testing."""
    svc = OCRService.__new__(OCRService)
    svc.use_gpu = False
    svc.dpi = 300
    svc._engine = engine
    svc._ocr = MagicMock() if engine == "paddleocr" else None
    svc._easyocr = MagicMock() if engine == "easyocr" else None
    return svc


def _make_paddleocr_3x_result(texts, scores):
    return [{"rec_texts": texts, "rec_scores": scores}]


def _make_paddleocr_legacy_result(texts, scores):
    entries = [[[[0, 0], [10, 0], [10, 10], [0, 10]], (t, s)] for t, s in zip(texts, scores)]
    return [entries]


def _make_easyocr_result(texts, confs):
    return [([[0, 0], [10, 0], [10, 10], [0, 10]], t, c) for t, c in zip(texts, confs)]


# ---------------------------------------------------------------------------
# _normalize_ocr_text
# ---------------------------------------------------------------------------

class TestNormalizeText:
    def test_preserves_numbers_and_units(self):
        text = "Paracetamol  500 mg\n1.5  mL\ndose 0.5  mcg"
        result = _normalize_ocr_text(text)
        assert "500 mg" in result
        assert "1.5 mL" in result
        assert "0.5 mcg" in result

    def test_drops_blank_lines(self):
        result = _normalize_ocr_text("line1\n\n\nline2")
        assert result == "line1\nline2"

    def test_empty(self):
        assert _normalize_ocr_text("") == ""
        assert _normalize_ocr_text(None) == ""


# ---------------------------------------------------------------------------
# Engine unavailable
# ---------------------------------------------------------------------------

class TestEngineUnavailable:
    def test_both_unavailable(self):
        svc = _make_ocr_service(None)
        result = svc.ocr_page(None, page_no=1)
        assert result["success"] is False
        assert result["extraction_method"] == "ocr_unavailable"
        assert result["text"] == ""

    def test_image_unavailable(self):
        svc = _make_ocr_service(None)
        result = svc.ocr_image("/nonexistent/path.png")
        assert result["success"] is False
        assert result["extraction_method"] == "ocr_unavailable"


# ---------------------------------------------------------------------------
# PaddleOCR result parsing
# ---------------------------------------------------------------------------

class TestPaddleResultParsing:
    def test_3x_dict_format(self):
        svc = _make_ocr_service("paddleocr")
        result = svc._parse_paddle_result(
            _make_paddleocr_3x_result(["Paracetamol 500 mg", "Take twice daily"], [0.95, 0.88])
        )
        assert result["success"] is True
        assert "Paracetamol 500 mg" in result["text"]
        assert result["extraction_method"] == "paddleocr"
        assert 0.9 < result["confidence"] < 0.92

    def test_legacy_nested_list_format(self):
        svc = _make_ocr_service("paddleocr")
        result = svc._parse_paddle_result(
            _make_paddleocr_legacy_result(["Ibuprofen 200 mg", "Once daily"], [0.90, 0.85])
        )
        assert result["success"] is True
        assert "Ibuprofen 200 mg" in result["text"]
        assert result["extraction_method"] == "paddleocr"

    def test_empty_result(self):
        svc = _make_ocr_service("paddleocr")
        result = svc._parse_paddle_result([])
        assert result["success"] is False
        assert result["text"] == ""

    def test_none_text_lines(self):
        svc = _make_ocr_service("paddleocr")
        result = svc._parse_paddle_result([{"rec_texts": [], "rec_scores": []}])
        assert result["success"] is False

    def test_zero_confidence(self):
        svc = _make_ocr_service("paddleocr")
        result = svc._parse_paddle_result(
            _make_paddleocr_3x_result(["text"], [0.0])
        )
        assert result["success"] is True
        assert result["confidence"] == 0.0


# ---------------------------------------------------------------------------
# EasyOCR result parsing
# ---------------------------------------------------------------------------

class TestEasyOCRResultParsing:
    def test_tuple_format(self):
        svc = _make_ocr_service("easyocr")
        result = svc._parse_easyocr_result(
            _make_easyocr_result(["Aspirin 100 mg", "After meals"], [0.92, 0.78])
        )
        assert result["success"] is True
        assert "Aspirin 100 mg" in result["text"]
        assert result["extraction_method"] == "easyocr"

    def test_empty_result(self):
        svc = _make_ocr_service("easyocr")
        result = svc._parse_easyocr_result([])
        assert result["success"] is False

    def test_short_entries_skipped(self):
        svc = _make_ocr_service("easyocr")
        result = svc._parse_easyocr_result([([[0, 0]], "text")])
        assert result["success"] is False


# ---------------------------------------------------------------------------
# OCR page with mocked engine
# ---------------------------------------------------------------------------

class TestOcrPage:
    def test_paddleocr_success(self):
        svc = _make_ocr_service("paddleocr")
        svc._run_paddleocr = MagicMock(return_value={
            "text": "Paracetamol 500 mg",
            "confidence": 0.95,
            "extraction_method": "paddleocr",
            "success": True,
        })
        mock_page = MagicMock()
        mock_page.get_pixmap.return_value.tobytes.return_value = b"\x89PNG\r\n\x1a\n"
        with patch("PIL.Image.open") as mock_open:
            mock_open.return_value.convert.return_value = MagicMock()
            result = svc.ocr_page(mock_page, page_no=1)
        assert result["success"] is True
        assert result["text"] == "Paracetamol 500 mg"

    def test_paddleocr_fails_easyocr_fallback(self):
        svc = _make_ocr_service("paddleocr")
        svc._easyocr = MagicMock()
        svc._run_paddleocr = MagicMock(return_value={
            "text": "", "confidence": 0.0,
            "extraction_method": "ocr_failed", "success": False,
        })
        svc._run_easyocr = MagicMock(return_value={
            "text": "Fallback text",
            "confidence": 0.80,
            "extraction_method": "easyocr",
            "success": True,
        })
        mock_page = MagicMock()
        mock_page.get_pixmap.return_value.tobytes.return_value = b"\x89PNG\r\n\x1a\n"
        with patch("PIL.Image.open") as mock_open:
            mock_open.return_value.convert.return_value = MagicMock()
            result = svc.ocr_page(mock_page, page_no=1)
        assert result["success"] is True
        assert result["text"] == "Fallback text"
        assert result["extraction_method"] == "easyocr"

    def test_both_engines_fail(self):
        svc = _make_ocr_service("paddleocr")
        svc._easyocr = MagicMock()
        svc._run_paddleocr = MagicMock(return_value={
            "text": "", "confidence": 0.0,
            "extraction_method": "ocr_failed", "success": False,
        })
        svc._run_easyocr = MagicMock(return_value={
            "text": "", "confidence": 0.0,
            "extraction_method": "ocr_failed", "success": False,
        })
        mock_page = MagicMock()
        mock_page.get_pixmap.return_value.tobytes.return_value = b"\x89PNG\r\n\x1a\n"
        with patch("PIL.Image.open") as mock_open:
            mock_open.return_value.convert.return_value = MagicMock()
            result = svc.ocr_page(mock_page, page_no=1)
        assert result["success"] is False
        assert result["extraction_method"] == "ocr_failed"

    def test_engine_raises_exception(self):
        svc = _make_ocr_service("paddleocr")
        svc._run_paddleocr = MagicMock(side_effect=Exception("Engine crashed"))
        mock_page = MagicMock()
        mock_page.get_pixmap.return_value.tobytes.return_value = b"\x89PNG\r\n\x1a\n"
        with patch("PIL.Image.open") as mock_open:
            mock_open.return_value.convert.return_value = MagicMock()
            result = svc.ocr_page(mock_page, page_no=1)
        assert result["success"] is False


# ---------------------------------------------------------------------------
# OCR image with mocked engine
# ---------------------------------------------------------------------------

class TestOcrImage:
    @pytest.mark.parametrize("ext", [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff", ".tif"])
    def test_image_formats(self, ext, tmp_path):
        svc = _make_ocr_service("paddleocr")
        svc._run_paddleocr_path = MagicMock(return_value={
            "text": "Test text",
            "confidence": 0.90,
            "extraction_method": "paddleocr",
            "success": True,
        })
        img_path = tmp_path / f"test{ext}"
        img_path.write_bytes(b"fake image data")
        result = svc.ocr_image(str(img_path))
        assert result["success"] is True
        assert result["text"] == "Test text"

    def test_missing_file(self):
        svc = _make_ocr_service("paddleocr")
        result = svc.ocr_image("/nonexistent/path.png")
        assert result["success"] is False
        assert result["extraction_method"] == "ocr_failed"

    def test_paddleocr_fails_easyocr_fallback(self, tmp_path):
        svc = _make_ocr_service("paddleocr")
        svc._easyocr = MagicMock()
        svc._run_paddleocr_path = MagicMock(return_value={
            "text": "", "confidence": 0.0,
            "extraction_method": "ocr_failed", "success": False,
        })
        svc._run_easyocr_path = MagicMock(return_value={
            "text": "EasyOCR result",
            "confidence": 0.85,
            "extraction_method": "easyocr",
            "success": True,
        })
        img_path = tmp_path / "test.png"
        img_path.write_bytes(b"fake")
        result = svc.ocr_image(str(img_path))
        assert result["success"] is True
        assert result["extraction_method"] == "easyocr"


# ---------------------------------------------------------------------------
# _render_page returns RGB
# ---------------------------------------------------------------------------

class TestRenderPage:
    def test_returns_rgb_image(self):
        svc = _make_ocr_service("paddleocr")
        mock_page = MagicMock()
        mock_pix = MagicMock()
        mock_pix.tobytes.return_value = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
        mock_page.get_pixmap.return_value = mock_pix
        with patch("PIL.Image.open") as mock_open:
            mock_img = MagicMock()
            mock_open.return_value = mock_img
            mock_img.convert.return_value = mock_img
            mock_img.mode = "RGB"
            result = svc._render_page(mock_page)
        assert result is not None
        mock_img.convert.assert_called_once_with("RGB")


# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------

class TestSingleton:
    def test_get_ocr_service_caches(self):
        _reset_ocr_service()
        with patch("app.services.pdf.ocr.OCRService") as mock_cls:
            mock_cls.return_value = MagicMock()
            get_ocr_service()
            get_ocr_service()
        assert mock_cls.call_count == 1
        _reset_ocr_service()


# ---------------------------------------------------------------------------
# Opt-in real engine integration test
# ---------------------------------------------------------------------------

@pytest.mark.skipif(
    not os.environ.get("RUN_OCR_INTEGRATION"),
    reason="Set RUN_OCR_INTEGRATION=1 to run real OCR engine tests",
)
class TestRealEngineIntegration:
    def test_real_ocr_on_generated_image(self, tmp_path):
        img = Image.new("RGB", (400, 200), "white")
        from PIL import ImageDraw
        draw = ImageDraw.Draw(img)
        draw.text((50, 50), "Paracetamol 500 mg", fill="black")
        draw.text((50, 100), "Take one tablet twice daily", fill="black")
        img_path = tmp_path / "test_real.png"
        img.save(str(img_path))

        _reset_ocr_service()
        svc = OCRService(use_gpu=False)
        result = svc.ocr_image(str(img_path))
        assert result["success"] is True
        text = result["text"].lower()
        assert "paracetamol" in text
        assert "500" in text
        assert "mg" in text
        _reset_ocr_service()
