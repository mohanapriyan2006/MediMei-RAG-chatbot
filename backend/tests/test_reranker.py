import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from typing import List, Dict, Any

from app.services.retrieval.reranker import rerank_documents
from app.services.retrieval.semantic_search_service import SemanticSearchService


@pytest.mark.asyncio
async def test_reranker_success():
    # Setup sample documents
    documents = [
        {"chunk_id": "c1", "score": 0.9, "text": "Document 1 content"},
        {"chunk_id": "c2", "score": 0.8, "text": "Document 2 content"},
        {"chunk_id": "c3", "score": 0.7, "text": "Document 3 content"},
    ]

    mock_model = MagicMock()
    # Assume CrossEncoder predicts higher score for the 3rd document, then 1st, then 2nd
    mock_model.predict.return_value = [0.5, 0.4, 0.9]

    with patch("app.services.retrieval.reranker.get_reranker_model", return_value=mock_model):
        results = await rerank_documents("query", documents, limit=2)

        # Should return top 2 documents
        assert len(results) == 2

        # 3rd document (index 2) had highest prediction (0.9), should be first
        assert results[0]["chunk_id"] == "c3"
        assert results[0]["rerank_score"] == 0.9
        assert results[0]["score"] == 0.9
        assert results[0]["vector_score"] == 0.7

        # 1st document (index 0) had next highest prediction (0.5), should be second
        assert results[1]["chunk_id"] == "c1"
        assert results[1]["rerank_score"] == 0.5
        assert results[1]["score"] == 0.5
        assert results[1]["vector_score"] == 0.9


@pytest.mark.asyncio
async def test_reranker_fallback_on_no_model():
    documents = [
        {"chunk_id": "c1", "score": 0.9, "text": "Document 1"},
        {"chunk_id": "c2", "score": 0.8, "text": "Document 2"},
    ]

    with patch("app.services.retrieval.reranker.get_reranker_model", return_value=None):
        # When model is None, it should fall back to original documents limited to limit
        results = await rerank_documents("query", documents, limit=1)
        assert len(results) == 1
        assert results[0]["chunk_id"] == "c1"


@pytest.mark.asyncio
async def test_reranker_fallback_on_exception():
    documents = [
        {"chunk_id": "c1", "score": 0.9, "text": "Document 1"},
        {"chunk_id": "c2", "score": 0.8, "text": "Document 2"},
    ]

    mock_model = MagicMock()
    mock_model.predict.side_effect = Exception("Model inference error")

    with patch("app.services.retrieval.reranker.get_reranker_model", return_value=mock_model):
        # Should gracefully fall back to original list
        results = await rerank_documents("query", documents, limit=1)
        assert len(results) == 1
        assert results[0]["chunk_id"] == "c1"


@pytest.mark.asyncio
async def test_semantic_search_with_rerank_integration():
    mock_emb = MagicMock()
    mock_emb.embed_query.return_value = [0.1] * 1024

    mock_point_1 = MagicMock()
    mock_point_1.id = "p1"
    mock_point_1.score = 0.85
    mock_point_1.payload = {"chunk_id": "c1", "text": "First chunk content"}

    mock_point_2 = MagicMock()
    mock_point_2.id = "p2"
    mock_point_2.score = 0.75
    mock_point_2.payload = {"chunk_id": "c2", "text": "Second chunk content"}

    mock_qdrant = MagicMock()
    mock_qdrant.search = AsyncMock(return_value=[mock_point_1, mock_point_2])

    service = SemanticSearchService(embedding_svc=mock_emb, qdrant_repo=mock_qdrant)

    # Mock the reranker call inside semantic search
    mock_reranked = [
        {"chunk_id": "c2", "score": 0.98, "rerank_score": 0.98, "vector_score": 0.75, "text": "Second chunk content"},
        {"chunk_id": "c1", "score": 0.92, "rerank_score": 0.92, "vector_score": 0.85, "text": "First chunk content"},
    ]

    # Patch the config settings
    with patch("app.services.retrieval.semantic_search_service.settings") as mock_settings:
        mock_settings.TOP_K = 2
        mock_settings.MIN_RELEVANCE_SCORE = 0.2
        mock_settings.ENABLE_RERANKING = True
        mock_settings.RERANK_CANDIDATES_LIMIT = 25

        with patch("app.services.retrieval.reranker.rerank_documents", return_value=mock_reranked) as mock_rerank_fn:
            results = await service.search("query text", top_k=2, rerank=True)

            # Check that Qdrant search was queried with a larger limit (top_k * 3 = 6)
            mock_qdrant.search.assert_called_once()
            _, kwargs = mock_qdrant.search.call_args
            assert kwargs["limit"] == 6

            # Check that reranker was called
            mock_rerank_fn.assert_called_once()
            _, args_kwargs = mock_rerank_fn.call_args
            assert args_kwargs["query"] == "query text"
            assert len(args_kwargs["documents"]) == 2
            assert args_kwargs["limit"] == 2

            # Check that we got the reranked list
            assert len(results) == 2
            assert results[0]["chunk_id"] == "c2"
            assert results[0]["score"] == 0.98


@pytest.mark.asyncio
async def test_semantic_search_without_rerank_integration():
    mock_emb = MagicMock()
    mock_emb.embed_query.return_value = [0.1] * 1024

    mock_point = MagicMock()
    mock_point.id = "p1"
    mock_point.score = 0.85
    mock_point.payload = {"chunk_id": "c1", "text": "First chunk content"}

    mock_qdrant = MagicMock()
    mock_qdrant.search = AsyncMock(return_value=[mock_point])

    service = SemanticSearchService(embedding_svc=mock_emb, qdrant_repo=mock_qdrant)

    with patch("app.services.retrieval.semantic_search_service.settings") as mock_settings:
        mock_settings.TOP_K = 2
        mock_settings.MIN_RELEVANCE_SCORE = 0.2
        mock_settings.ENABLE_RERANKING = False

        with patch("app.services.retrieval.reranker.rerank_documents") as mock_rerank_fn:
            results = await service.search("query text", top_k=2, rerank=False)

            # Check that Qdrant search was queried with limit = top_k (2)
            mock_qdrant.search.assert_called_once()
            _, kwargs = mock_qdrant.search.call_args
            assert kwargs["limit"] == 2

            # Check that reranker was NOT called
            mock_rerank_fn.assert_not_called()

            assert len(results) == 1
            assert results[0]["chunk_id"] == "c1"
