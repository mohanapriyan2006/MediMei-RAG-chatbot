import sys
import numpy as np
from unittest.mock import MagicMock, AsyncMock
from app.core.config import settings

settings.ENVIRONMENT = "test"

# 1. Mock SentenceTransformer
class MockSentenceTransformer:
    def __init__(self, model_name=None, **kwargs):
        self.model_name = model_name

    def encode(self, sentences, **kwargs):
        # BGE-M3 produces 1024-dimensional vectors
        if isinstance(sentences, str):
            return np.zeros(1024, dtype=np.float32).tolist()
        return np.zeros((len(sentences), 1024), dtype=np.float32).tolist()

sentence_transformers_mock = MagicMock()
sentence_transformers_mock.SentenceTransformer = MockSentenceTransformer
sys.modules['sentence_transformers'] = sentence_transformers_mock

# 2. Mock Qdrant Client
mock_qdrant_instance = MagicMock()

# Setup get_collections mock
mock_collections = MagicMock()
mock_collections.collections = []
mock_qdrant_instance.get_collections.return_value = mock_collections

# Setup search / query_points mock
mock_point = MagicMock()
mock_point.id = "point-uuid-1"
mock_point.payload = {
    "chunk_id": "chunk-rinvoq-dosage",
    "document_id": "doc-rinvoq",
    "document_name": "Rinvoq_PI.pdf",
    "page_no": 12,
    "section": "Dosage and Administration",
    "text": "The recommended dosage of RINVOQ is 15 mg once daily."
}
mock_point.score = 0.95

mock_search_results = MagicMock()
mock_search_results.points = [mock_point]
mock_qdrant_instance.query_points.return_value = mock_search_results

# Async client mock
mock_async_qdrant_instance = AsyncMock()
mock_async_qdrant_instance.search.return_value = [mock_point]
mock_async_qdrant_instance.close = AsyncMock()

# Create package-level mocks
qdrant_client_mock = MagicMock()
qdrant_client_mock.QdrantClient = MagicMock(return_value=mock_qdrant_instance)
qdrant_client_mock.AsyncQdrantClient = MagicMock(return_value=mock_async_qdrant_instance)

# Preserve models subpackage for conditions
from qdrant_client import models
qdrant_client_mock.models = models
sys.modules['qdrant_client'] = qdrant_client_mock

# 3. Mock llama-cpp-python to avoid loading local GGUFs
llama_cpp_mock = MagicMock()
mock_llama_inst = MagicMock()
mock_llama_inst.return_value = {
    "choices": [{"text": "The recommended dose of Rinvoq is 15 mg. [S1]"}]
}
llama_cpp_mock.Llama = MagicMock(return_value=mock_llama_inst)
sys.modules['llama_cpp'] = llama_cpp_mock

# 4. Mock fitz (PyMuPDF) globally if needed, though we test it in test_pdf.py with explicit patches
