import logging
from fastapi import APIRouter, HTTPException, status

from app.schemas.retrieval import SearchRequest, SearchResponse
from app.services.retrieval.semantic_search_service import SemanticSearchService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["retrieval"])

# Default service instance (model + Qdrant client are cached)
_search_service = SemanticSearchService()


@router.post("/", response_model=SearchResponse, status_code=status.HTTP_200_OK)
async def search(request: SearchRequest) -> SearchResponse:
    """
    Semantic search over indexed drug document chunks.

    Returns the most relevant evidence chunks for a user query.
    """
    try:
        results = await _search_service.search(
            query=request.query,
            top_k=request.top_k,
            document_ids=request.document_ids,
            section=request.section,
            version=request.version,
            score_threshold=request.score_threshold,
            rerank=request.rerank,
        )
        return SearchResponse(query=request.query, results=results)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        logger.error("Search failed for query '%s...': %s", request.query[:40], exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Search failed. Please try again later.",
        )
