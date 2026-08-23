# ---------------------------------------------------------------------------
# MKLDNN / oneDNN flags MUST be set before PaddlePaddle is imported.
# PaddleOCR 3.x + PaddlePaddle 3.x on CPU crashes with
#   NotImplementedError: ConvertPirAttribute2RuntimeAttribute not support
#   [pir::ArrayAttribute<pir::DoubleAttribute>]
# when oneDNN is enabled.  Setting these env vars at the very top of this
# module (which is the first place paddle is transitively imported) prevents
# the crash.  Do NOT move this block below any paddle/torch import.
# ---------------------------------------------------------------------------
import os

os.environ.setdefault("FLAGS_use_mkldnn", "0")
os.environ.setdefault("PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT", "0")

import io
import logging
import re
from pathlib import Path
from typing import Any, Dict, Optional, Union

logger = logging.getLogger(__name__)

DEFAULT_DPI = 300

IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff", ".tif")

_ocr_service_instance: Optional["OCRService"] = None


def get_ocr_service(use_gpu: bool = False, dpi: int = DEFAULT_DPI) -> "OCRService":
    """Return a cached OCRService singleton so OCR models are loaded once."""
    global _ocr_service_instance
    if _ocr_service_instance is None:
        _ocr_service_instance = OCRService(use_gpu=use_gpu, dpi=dpi)
    return _ocr_service_instance


def _reset_ocr_service():
    """Reset the singleton — used by tests."""
    global _ocr_service_instance
    _ocr_service_instance = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_cuda_available() -> bool:
    """Return True only when *both* torch and paddle report CUDA availability."""
    torch_cuda = False
    try:
        import torch
        torch_cuda = torch.cuda.is_available()
    except Exception:
        pass

    paddle_cuda = False
    try:
        import paddle
        paddle_cuda = paddle.device.is_compiled_with_cuda()
    except Exception:
        pass

    return torch_cuda or paddle_cuda


def _normalize_ocr_text(text: str) -> str:
    """Light whitespace normalisation that preserves medical values.

    - Collapse runs of spaces/tabs into a single space.
    - Strip trailing whitespace per line.
    - Drop empty lines.
    - Preserve numbers, units (mg, mcg, mL, %, IU), dosage values, and
      line breaks exactly as recognised.
    """
    if not text:
        return ""
    lines = []
    for raw_line in text.splitlines():
        line = re.sub(r"[ \t]+", " ", raw_line).strip()
        if line:
            lines.append(line)
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# OCR service
# ---------------------------------------------------------------------------

class OCRService:
    """Robust OCR engine abstraction.

    Priority: PaddleOCR → EasyOCR → graceful unavailable state.

    The service is designed so that *no* OCR engine being available never
    crashes the calling pipeline.  Every public method returns a consistent
    result dict::

        {
            "text": "...",
            "confidence": 0.0,
            "extraction_method": "paddleocr" | "easyocr" | "ocr_failed" | "ocr_unavailable",
            "success": True | False,
        }
    """

    def __init__(self, use_gpu: bool = False, dpi: int = DEFAULT_DPI):
        self.use_gpu = use_gpu
        self.dpi = dpi
        self._engine: Optional[str] = None
        self._ocr: Any = None        # PaddleOCR instance
        self._easyocr: Any = None    # EasyOCR Reader instance

        cuda_available = _is_cuda_available()
        effective_gpu = use_gpu and cuda_available
        if use_gpu and not cuda_available:
            logger.info(
                "GPU requested but CUDA not available; falling back to CPU for OCR."
            )

        self._init_paddleocr(effective_gpu)
        if self._engine is None:
            self._init_easyocr(effective_gpu)

        if self._engine is not None:
            logger.info("OCR engine initialized: %s", self._engine)
        else:
            logger.warning("OCR engine unavailable — no OCR backend could be initialized.")

    # ------------------------------------------------------------------
    # Engine initialisation
    # ------------------------------------------------------------------

    def _init_paddleocr(self, use_gpu: bool) -> None:
        """Try to initialise PaddleOCR (3.x then legacy kwargs)."""
        try:
            import paddle
            from paddleocr import PaddleOCR
        except Exception as exc:
            logger.warning("PaddleOCR import failed: %s", exc)
            return

        paddle_gpu = use_gpu and paddle.device.is_compiled_with_cuda()
        device_str = "gpu" if paddle_gpu else "cpu"

        # --- PaddleOCR 3.x style ---
        try:
            self._ocr = PaddleOCR(lang="en", device=device_str)
            self._engine = "paddleocr"
            logger.info("PaddleOCR 3.x initialized with device=%s", device_str)
            return
        except Exception as exc:
            logger.warning("PaddleOCR 3.x initialization failed (device=%s): %s", device_str, exc)

        # --- Legacy style ---
        try:
            self._ocr = PaddleOCR(
                use_angle_cls=True,
                lang="en",
                use_gpu=paddle_gpu,
                show_log=False,
            )
            self._engine = "paddleocr"
            logger.info("PaddleOCR legacy initialized with use_gpu=%s", paddle_gpu)
            return
        except Exception as exc:
            logger.warning("PaddleOCR legacy initialization failed: %s", exc)

        # --- CPU retry when GPU was requested ---
        if paddle_gpu:
            try:
                self._ocr = PaddleOCR(lang="en", device="cpu")
                self._engine = "paddleocr"
                logger.info("PaddleOCR initialized on CPU after GPU failure.")
            except Exception as exc:
                logger.warning("PaddleOCR CPU fallback initialization failed: %s", exc)

    def _init_easyocr(self, use_gpu: bool) -> None:
        """Try to initialise EasyOCR as a fallback."""
        try:
            import easyocr
        except Exception as exc:
            logger.warning("EasyOCR import failed: %s", exc)
            return

        try:
            self._easyocr = easyocr.Reader(["en"], gpu=use_gpu)
            self._engine = "easyocr"
            logger.info("EasyOCR initialized with gpu=%s", use_gpu)
        except Exception as exc:
            logger.warning("EasyOCR initialization failed (gpu=%s): %s", use_gpu, exc)
            if use_gpu:
                try:
                    self._easyocr = easyocr.Reader(["en"], gpu=False)
                    self._engine = "easyocr"
                    logger.info("EasyOCR initialized on CPU after GPU failure.")
                except Exception as exc2:
                    logger.warning("EasyOCR CPU fallback initialization failed: %s", exc2)

    # ------------------------------------------------------------------
    # Public properties
    # ------------------------------------------------------------------

    @property
    def engine(self) -> Optional[str]:
        return self._engine

    @property
    def available(self) -> bool:
        return self._engine is not None

    # ------------------------------------------------------------------
    # Result helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _success_result(text: str, confidence: float, method: str) -> Dict[str, Any]:
        cleaned = _normalize_ocr_text(text)
        return {
            "text": cleaned,
            "confidence": round(float(confidence), 4) if confidence is not None else 0.0,
            "extraction_method": method,
            "success": bool(cleaned),
        }

    @staticmethod
    def _fail_result(method: str = "ocr_failed") -> Dict[str, Any]:
        return {"text": "", "confidence": 0.0, "extraction_method": method, "success": False}

    @staticmethod
    def _unavailable_result() -> Dict[str, Any]:
        return {"text": "", "confidence": 0.0, "extraction_method": "ocr_unavailable", "success": False}

    # ------------------------------------------------------------------
    # PDF page rendering
    # ------------------------------------------------------------------

    def _render_page(self, page: Any, dpi: Optional[int] = None) -> Any:
        """Render a PyMuPDF page to a PIL RGB Image at the given DPI.

        Uses ``get_pixmap(alpha=False)`` then converts via PNG bytes to avoid
        colourspace issues (e.g. CMYK, grey-scale) that break
        ``Image.frombytes``.
        """
        if dpi is None:
            dpi = self.dpi
        from PIL import Image

        pix = page.get_pixmap(dpi=dpi, alpha=False)
        png_bytes = pix.tobytes("png")
        return Image.open(io.BytesIO(png_bytes)).convert("RGB")

    # ------------------------------------------------------------------
    # PaddleOCR runners
    # ------------------------------------------------------------------

    def _run_paddleocr(self, image: Any) -> Dict[str, Any]:
        """Run PaddleOCR on a PIL Image / numpy array."""
        if self._ocr is None:
            return self._unavailable_result()
        try:
            import numpy as np

            if hasattr(image, "convert"):
                arr = np.array(image)
            else:
                arr = image

            if hasattr(self._ocr, "predict"):
                result = self._ocr.predict(arr)
            else:
                result = self._ocr.ocr(arr, cls=True, max_side_limit=5000)

            return self._parse_paddle_result(list(result) if result is not None else [])
        except Exception as exc:
            logger.warning("PaddleOCR failed: %s", exc)
            return self._fail_result("ocr_failed")

    def _run_paddleocr_path(self, path: str) -> Dict[str, Any]:
        """Run PaddleOCR on a file path."""
        if self._ocr is None:
            return self._unavailable_result()
        try:
            if hasattr(self._ocr, "predict"):
                result = self._ocr.predict(path)
            else:
                result = self._ocr.ocr(path, cls=True, max_side_limit=5000)
            return self._parse_paddle_result(list(result) if result is not None else [])
        except Exception as exc:
            logger.warning("PaddleOCR failed on %s: %s", path, exc)
            return self._fail_result("ocr_failed")

    def _parse_paddle_result(self, result: list) -> Dict[str, Any]:
        """Defensively parse PaddleOCR 3.x dict or legacy nested-list output."""
        if not result:
            return self._success_result("", 0.0, "paddleocr")

        first = result[0]

        # --- PaddleOCR 3.x dict style ---
        if isinstance(first, dict):
            lines = first.get("rec_texts", [])
            confidences = first.get("rec_scores", [])
            if not lines:
                return self._success_result("", 0.0, "paddleocr")
            text = "\n".join(str(l) for l in lines)
            avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
            return self._success_result(text, avg_conf, "paddleocr")

        # --- Legacy nested-list style: [[[bbox, (text, conf)], ...]] ---
        try:
            if not first:
                return self._success_result("", 0.0, "paddleocr")
            lines = []
            confidences = []
            for entry in first:
                if not entry:
                    continue
                if isinstance(entry, (list, tuple)) and len(entry) == 2:
                    _bbox, text_tuple = entry
                    if isinstance(text_tuple, (list, tuple)) and len(text_tuple) == 2:
                        text, conf = text_tuple
                        lines.append(str(text))
                        confidences.append(float(conf))
            text = "\n".join(lines)
            avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
            return self._success_result(text, avg_conf, "paddleocr")
        except Exception as exc:
            logger.error("Failed to parse PaddleOCR legacy result: %s", exc)
            return self._success_result("", 0.0, "paddleocr")

    # ------------------------------------------------------------------
    # EasyOCR runners
    # ------------------------------------------------------------------

    def _run_easyocr(self, image: Any) -> Dict[str, Any]:
        """Run EasyOCR on a PIL Image / numpy array."""
        if self._easyocr is None:
            return self._unavailable_result()
        try:
            import numpy as np

            if hasattr(image, "convert"):
                arr = np.array(image)
            else:
                arr = image
            result = self._easyocr.readtext(arr)
            return self._parse_easyocr_result(result)
        except Exception as exc:
            logger.warning("EasyOCR failed: %s", exc)
            return self._fail_result("ocr_failed")

    def _run_easyocr_path(self, path: str) -> Dict[str, Any]:
        """Run EasyOCR on a file path."""
        if self._easyocr is None:
            return self._unavailable_result()
        try:
            result = self._easyocr.readtext(path)
            return self._parse_easyocr_result(result)
        except Exception as exc:
            logger.warning("EasyOCR failed on %s: %s", path, exc)
            return self._fail_result("ocr_failed")

    def _parse_easyocr_result(self, result: list) -> Dict[str, Any]:
        """Parse EasyOCR ``[(bbox, text, confidence), ...]`` output."""
        if not result:
            return self._success_result("", 0.0, "easyocr")
        lines = []
        confidences = []
        for entry in result:
            if not entry or len(entry) < 3:
                continue
            text = entry[1]
            conf = entry[2]
            if text:
                lines.append(str(text))
                confidences.append(float(conf))
        text = "\n".join(lines)
        avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
        return self._success_result(text, avg_conf, "easyocr")

    # ------------------------------------------------------------------
    # Public OCR methods
    # ------------------------------------------------------------------

    def ocr_page(
        self,
        page: Any,
        page_no: int,
        document_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Run OCR on a single PyMuPDF page, with PaddleOCR→EasyOCR fallback."""
        if self._engine is None:
            logger.warning("OCR unavailable for document_id=%s page=%s", document_id, page_no)
            return self._unavailable_result()

        logger.info("Processing image page %s (document %s) with %s", page_no, document_id, self._engine)

        try:
            image = self._render_page(page)
        except Exception as exc:
            logger.warning("Failed to render page %s: %s", page_no, exc)
            return self._fail_result("ocr_failed")

        try:
            if self._engine == "paddleocr":
                result = self._run_paddleocr(image)
                if result["success"]:
                    logger.info("OCR completed for page %s. Confidence: %s", page_no, result["confidence"])
                    return result
                logger.warning("PaddleOCR returned no text for page %s; trying EasyOCR.", page_no)
                if self._easyocr is not None:
                    result = self._run_easyocr(image)
                    if result["success"]:
                        logger.info("EasyOCR fallback succeeded for page %s. Confidence: %s", page_no, result["confidence"])
                        return result
                logger.warning("OCR failed for page %s; retaining native text if available.", page_no)
                return self._fail_result("ocr_failed")

            if self._engine == "easyocr":
                result = self._run_easyocr(image)
                if result["success"]:
                    logger.info("OCR completed for page %s. Confidence: %s", page_no, result["confidence"])
                    return result
                logger.warning("EasyOCR returned no text for page %s.", page_no)
                return self._fail_result("ocr_failed")
        except Exception as exc:
            logger.warning("OCR engine raised exception for page %s: %s", page_no, exc)
            return self._fail_result("ocr_failed")

        return self._unavailable_result()

    def ocr_image(self, image_path: Union[str, Path]) -> Dict[str, Any]:
        """OCR a standalone image file (PNG, JPG, JPEG, WEBP, BMP, TIFF, TIF)."""
        path = str(image_path)

        if self._engine is None:
            logger.warning("OCR unavailable for image %s", path)
            return self._unavailable_result()

        if not os.path.isfile(path):
            logger.error("Image file not found: %s", path)
            return self._fail_result("ocr_failed")

        logger.info("Processing image: %s with %s", path, self._engine)

        if self._engine == "paddleocr":
            result = self._run_paddleocr_path(path)
            if result["success"]:
                logger.info("OCR completed for image %s. Confidence: %s", path, result["confidence"])
                return result
            logger.warning("PaddleOCR returned no text for %s; trying EasyOCR.", path)
            if self._easyocr is not None:
                result = self._run_easyocr_path(path)
                if result["success"]:
                    logger.info("EasyOCR fallback succeeded for %s. Confidence: %s", path, result["confidence"])
                    return result
            logger.warning("OCR failed for image %s.", path)
            return self._fail_result("ocr_failed")

        if self._engine == "easyocr":
            result = self._run_easyocr_path(path)
            if result["success"]:
                logger.info("OCR completed for image %s. Confidence: %s", path, result["confidence"])
                return result
            logger.warning("EasyOCR returned no text for %s.", path)
            return self._fail_result("ocr_failed")

        return self._unavailable_result()

