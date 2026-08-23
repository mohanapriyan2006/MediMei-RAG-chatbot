# Backend Testing Guide

This document describes how the `backend` test suite is organized, how to run it, and how to add new tests.

## Test Framework

- **pytest** — main test runner
- **pytest-asyncio** — async test support for FastAPI/SQLAlchemy async code

Configuration is in `pytest.ini`:

```ini
[pytest]
pythonpath = .
asyncio_mode = auto
asyncio_default_fixture_loop_scope = function
```

Dependencies are listed in `requirements.txt`:

```
pytest
pytest-asyncio
```

## Test Layout

All tests live in `backend/tests/`:

| File | Coverage |
|------|----------|
| `conftest.py` | Global fixtures and mocks (embedding model, Qdrant, LLM) |
| `test_auth.py` | Register, login, `/me` endpoints |
| `test_chat.py` | Chat Q&A endpoint and response validation |
| `test_chat_services.py` | Chat service/business logic |
| `test_chunk_builder.py` | Chunk builder utilities |
| `test_chunking.py` | PDF chunking pipeline |
| `test_citations.py` | Citation extraction and formatting |
| `test_cleaner.py` | Text cleaning helpers |
| `test_compare.py` | Drug comparison logic |
| `test_core.py` | Core config and security |
| `test_documents.py` | Document upload/list/delete |
| `test_llm.py` | LLM client/prompts |
| `test_memory.py` | Conversation memory |
| `test_ocr.py` | OCR fallback (PaddleOCR/EasyOCR) |
| `test_part2.py`, `test_part3.py` | Pipeline stage tests |
| `test_pdf.py` | PDF text extraction with PyMuPDF |
| `test_pipeline.py` | End-to-end document/chat pipeline |
| `test_quality.py` | Output quality validators |
| `test_reranker.py` | Reranking service |
| `test_retrieval.py` | Hybrid search (semantic + keyword) |
| `test_search_api.py` | Search API routes |
| `test_section.py` | Section detection |
| `test_sessions.py` | Session management |
| `test_validation.py` | Claim, evidence, and safety validators |

## Running Tests

From the `backend/` directory with the virtual environment activated:

```bash
# Run all tests
pytest

# Run a specific test file
pytest tests/test_auth.py

# Run with verbose output
pytest -v

# Run a single test
pytest tests/test_auth.py::test_register_user -v

# Run with coverage (requires pytest-cov)
pytest --cov=app --cov-report=term-missing
```

## Global Mocks (`conftest.py`)

`conftest.py` sets `ENVIRONMENT=test` and mocks heavy external dependencies so unit tests run quickly without real models or services:

- `sentence_transformers.SentenceTransformer` — returns 1024-d zero vectors
- `qdrant_client.QdrantClient` / `AsyncQdrantClient` — returns a single mock point
- `llama_cpp.Llama` — returns a deterministic JSON response

These mocks are applied at import time via `sys.modules` so the application code under test uses the fake implementations.

## Writing a New Test

1. Add a file named `tests/test_<feature>.py`.
2. Use `async def` for async tests; `pytest-asyncio` will pick them up automatically.
3. Import the module/function you want to test from `app.*`.
4. Use `monkeypatch` or `unittest.mock` for additional external dependencies.

Example:

```python
# tests/test_example.py
import pytest
from app.core.security import hash_password, verify_password

def test_password_hash_roundtrip():
    plain = "my-secret-password"
    hashed = hash_password(plain)
    assert verify_password(plain, hashed) is True
    assert verify_password("wrong-password", hashed) is False
```

## CI / Automation

A minimal CI step for the backend:

```bash
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
pytest
```

## Notes

- Keep tests isolated and avoid relying on a real MySQL/LLM/Qdrant instance unless running integration tests.
- Integration tests that need real services should be marked with a custom `pytest.mark.integration` marker and skipped in standard runs.
