import logging
from typing import Any, Dict, Optional

import torch

from app.core.config import settings

logger = logging.getLogger(__name__)

# Cached model instance
_embedding_model_instance = None


class MockEmbeddingModel:
    """Fallback model used when sentence-transformers fails to load."""

    def __init__(self, dimension: int = 1024):
        self._dimension = dimension

    def get_embedding_dimension(self) -> int:
        return self._dimension

    # Keep the legacy name for older sentence-transformers callers
    get_sentence_embedding_dimension = get_embedding_dimension

    def encode(self, sentences, **kwargs):
        import numpy as np
        if isinstance(sentences, str):
            return np.zeros(self._dimension, dtype=np.float32).tolist()
        return np.zeros((len(sentences), self._dimension), dtype=np.float32).tolist()


def _resolve_device() -> str:
    """Pick the embedding device: explicit config > cuda > cpu."""
    if settings.EMBEDDING_DEVICE:
        return settings.EMBEDDING_DEVICE
    return "cuda" if torch.cuda.is_available() else "cpu"


def get_embedding_model():
    """
    Dependency injection helper for Embedding Model.
    Caches model loading to avoid expensive initialization on every request.
    Detects CUDA/GPU environment automatically for optimal hardware utilization.
    """
    global _embedding_model_instance
    if _embedding_model_instance is not None:
        return _embedding_model_instance

    try:
        from sentence_transformers import SentenceTransformer
        device = _resolve_device()
        logger.info(
            "Initializing SentenceTransformer model '%s' on device: %s",
            settings.EMBEDDING_MODEL,
            device,
        )
        _embedding_model_instance = SentenceTransformer(
            settings.EMBEDDING_MODEL,
            device=device,
        )
        logger.info("Successfully loaded embedding model: %s", settings.EMBEDDING_MODEL)
    except Exception as e:
        logger.error("Failed to load sentence-transformers model: %s. Returning mock embedding model.", e)
        _embedding_model_instance = MockEmbeddingModel()

    return _embedding_model_instance


def get_embedding_dimension() -> int:
    """Return the actual vector dimension produced by the loaded model."""
    model = get_embedding_model()
    get_dim = getattr(model, "get_embedding_dimension", None)
    if get_dim is None:
        get_dim = getattr(model, "get_sentence_embedding_dimension", None)
    if callable(get_dim):
        return get_dim()
    return getattr(model, "dimension", getattr(model, "vector_size", 1024))


def get_embedding_model_info() -> Dict[str, Any]:
    """Return metadata about the currently loaded embedding model."""
    return {
        "model_name": settings.EMBEDDING_MODEL,
        "device": _resolve_device(),
        "vector_size": get_embedding_dimension(),
    }
