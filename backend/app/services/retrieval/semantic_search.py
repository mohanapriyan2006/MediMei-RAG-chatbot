from typing import List, Dict, Any, Optional
from app.services.embeddings.embedding_service import embedding_service
from app.repositories.qdrant_repository import qdrant_repository


async def semantic_search(
    query: str,
    document_ids: List[str],
    limit: int = 5
) -> List[Dict[str, Any]]:
    """
    Perform semantic search using vector similarity in Qdrant.
    Retrieves the closest chunks in meaning to the input query.
    """
    # 1. Generate query embedding vector
    query_vector = embedding_service.create_embedding(query)

    # 2. Search in Qdrant asynchronously
    points = await qdrant_repository.search(
        query_vector=query_vector,
        limit=limit,
        document_ids=document_ids
    )

    # 3. Format results into structured dictionary matching schema expectations
    results = []
    for point in points:
        results.append({
            "chunk_id": point.payload.get("chunk_id", str(point.id)),
            "document_id": point.payload.get("document_id"),
            "document_name": point.payload.get("document_name"),
            "page_no": point.payload.get("page_no"),
            "section": point.payload.get("section"),
            "text": point.payload.get("text") or point.payload.get("chunk_text"),
            "score": point.score,
            "quality_score": point.payload.get("quality_score", 1.0)
        })

    return results
