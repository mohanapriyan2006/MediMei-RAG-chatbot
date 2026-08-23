import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.retrieval.indexer_service import IndexerService
from app.services.retrieval.semantic_search_service import SemanticSearchService


@pytest.mark.asyncio
async def test_indexer_service_embeds_and_upserts():
    mock_emb = MagicMock()
    mock_emb.vector_size = 1024
    mock_emb.embed_texts.return_value = [[0.1] * 1024, [0.2] * 1024]

    mock_qdrant = MagicMock()
    mock_qdrant.set_vector_size = MagicMock()
    mock_qdrant.add_chunks = AsyncMock()

    indexer = IndexerService(embedding_svc=mock_emb, qdrant_repo=mock_qdrant)
    chunks = [
        {
            "chunk_id": "c1",
            "document_id": "doc-1",
            "document_name": "drug.pdf",
            "page_no": 1,
            "section_title": "DOSAGE AND ADMINISTRATION",
            "chunk_index": 0,
            "text": "Take 10 mg once daily.",
            "extraction_method": "pymupdf",
        },
        {
            "chunk_id": "c2",
            "document_id": "doc-1",
            "document_name": "drug.pdf",
            "page_no": 2,
            "section_title": "CONTRAINDICATIONS",
            "chunk_index": 1,
            "text": "Do not use in hypersensitivity.",
            "extraction_method": "pymupdf",
        },
    ]

    result = await indexer.index_chunks(chunks)

    assert result["indexed_count"] == 2
    assert result["vector_size"] == 1024
    assert result["success"] is True
    mock_qdrant.set_vector_size.assert_called_once_with(1024)
    mock_qdrant.add_chunks.assert_awaited_once()

    call_args = mock_qdrant.add_chunks.await_args[0][0]
    assert len(call_args) == 2
    assert call_args[0]["chunk_id"] == "c1"
    assert call_args[0]["document_id"] == "doc-1"
    assert call_args[0]["section"] == "DOSAGE AND ADMINISTRATION"
    assert call_args[0]["chunk_text"] == "Take 10 mg once daily."
    assert call_args[0]["text_hash"] is not None


@pytest.mark.asyncio
async def test_indexer_service_skips_empty_chunks():
    mock_emb = MagicMock()
    mock_emb.vector_size = 1024
    mock_emb.embed_texts.return_value = [None]

    mock_qdrant = MagicMock()
    mock_qdrant.set_vector_size = MagicMock()
    mock_qdrant.add_chunks = AsyncMock()

    indexer = IndexerService(embedding_svc=mock_emb, qdrant_repo=mock_qdrant)
    chunks = [
        {
            "chunk_id": "c1",
            "document_id": "doc-1",
            "text": "   ",
        }
    ]

    result = await indexer.index_chunks(chunks)

    assert result["indexed_count"] == 0
    mock_qdrant.add_chunks.assert_not_awaited()


@pytest.mark.asyncio
async def test_semantic_search_returns_structured_results():
    mock_emb = MagicMock()
    mock_emb.embed_query.return_value = [0.1] * 1024

    mock_point = MagicMock()
    mock_point.id = "p1"
    mock_point.score = 0.87
    mock_point.payload = {
        "chunk_id": "c1",
        "document_id": "doc-1",
        "document_name": "drug.pdf",
        "page_no": 5,
        "section": "DOSAGE AND ADMINISTRATION",
        "chunk_index": 2,
        "text": "Take 10 mg once daily.",
        "extraction_method": "pymupdf",
        "version": "v1",
    }

    mock_qdrant = MagicMock()
    mock_qdrant.search = AsyncMock(return_value=[mock_point])

    service = SemanticSearchService(embedding_svc=mock_emb, qdrant_repo=mock_qdrant)
    results = await service.search("What is the dose?", top_k=3, rerank=False)

    assert len(results) == 1
    assert results[0]["chunk_id"] == "c1"
    assert results[0]["score"] == 0.87
    assert results[0]["document_id"] == "doc-1"
    assert results[0]["page_no"] == 5
    assert results[0]["section_title"] == "DOSAGE AND ADMINISTRATION"
    assert results[0]["text"] == "Take 10 mg once daily."


@pytest.mark.asyncio
async def test_semantic_search_passes_filters():
    mock_emb = MagicMock()
    mock_emb.embed_query.return_value = [0.1] * 1024

    mock_qdrant = MagicMock()
    mock_qdrant.search = AsyncMock(return_value=[])

    service = SemanticSearchService(embedding_svc=mock_emb, qdrant_repo=mock_qdrant)
    await service.search(
        "What is the dose?",
        top_k=5,
        document_ids=["doc-1"],
        section="DOSAGE AND ADMINISTRATION",
        version="v1",
        score_threshold=0.5,
        rerank=False,
    )

    _, kwargs = mock_qdrant.search.await_args
    assert kwargs["document_ids"] == ["doc-1"]
    assert kwargs["section"] == "DOSAGE AND ADMINISTRATION"
    assert kwargs["version"] == "v1"
    assert kwargs["score_threshold"] == 0.5
    assert kwargs["limit"] == 5
