import logging
from typing import Any, Dict, List, Optional

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.config import settings
from app.db.database import async_session_factory
from app.models.chunk import Chunk
from app.models.document import Document
from app.repositories.qdrant_repository import qdrant_repository
from app.services.embeddings.embedding_service import embedding_service

logger = logging.getLogger(__name__)

_QDRANT_FAILURE_KEYWORDS = (
    "connecttimeout", "connecterror", "connectionerror",
    "qdrant", "responsehandlingexception", "readerror",
    "readtimeout", "remoteprotocolerror", "pooltimeout",
)


def _is_qdrant_connection_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return any(kw in msg for kw in _QDRANT_FAILURE_KEYWORDS)


class SemanticSearchService:
    """
    Service that embeds a user query and retrieves the most relevant
    chunk evidence from Qdrant using cosine similarity.

    Falls back to a database text search when Qdrant is unreachable.
    """

    def __init__(self, embedding_svc=None, qdrant_repo=None, session_factory: async_sessionmaker = None):
        self.embedding_service = embedding_svc or embedding_service
        self.qdrant_repository = qdrant_repo or qdrant_repository
        self._session_factory = session_factory or async_session_factory

    async def search(
        self,
        query: str,
        top_k: int = None,
        document_ids: Optional[List[str]] = None,
        section: Optional[str] = None,
        version: Optional[str] = None,
        score_threshold: Optional[float] = None,
        rerank: Optional[bool] = None,
    ) -> List[Dict[str, Any]]:
        """
        Perform semantic search and return a list of RetrievalResult-like dicts.
        Falls back to database text search if Qdrant is unreachable.
        """
        if not query or not query.strip():
            raise ValueError("Search query cannot be empty.")

        top_k = top_k or settings.TOP_K
        if score_threshold is None:
            score_threshold = settings.MIN_RELEVANCE_SCORE

        if rerank is None:
            rerank = getattr(settings, "ENABLE_RERANKING", True)

        # Determine retrieval limit if reranking is enabled
        retrieval_limit = top_k
        if rerank:
            candidates_limit = getattr(settings, "RERANK_CANDIDATES_LIMIT", 25)
            retrieval_limit = max(min(top_k * 3, candidates_limit), top_k)

        try:
            # 1. Embed the query with the same model used for chunks.
            query_vector = self.embedding_service.embed_query(query)

            # 2. Search Qdrant with optional metadata filters.
            points = await self.qdrant_repository.search(
                query_vector=query_vector,
                limit=retrieval_limit,
                document_ids=document_ids,
                section=section,
                version=version,
                score_threshold=score_threshold,
            )

            # 3. Map points into a stable result shape.
            results = []
            for point in points:
                payload = point.payload or {}
                results.append({
                    "chunk_id": payload.get("chunk_id", str(point.id)),
                    "score": float(point.score),
                    "document_id": payload.get("document_id"),
                    "document_name": payload.get("document_name"),
                    "page_no": payload.get("page_no"),
                    "section_title": payload.get("section") or payload.get("section_title"),
                    "chunk_index": payload.get("chunk_index"),
                    "extraction_method": payload.get("extraction_method"),
                    "version": payload.get("version"),
                    "text_hash": payload.get("text_hash"),
                    "text": payload.get("text") or payload.get("chunk_text"),
                    "quality_score": payload.get("quality_score", 1.0),
                    "ocr_confidence": payload.get("ocr_confidence"),
                })
        except Exception as exc:
            if _is_qdrant_connection_error(exc):
                logger.warning(
                    "Qdrant unreachable, falling back to database text search: %s",
                    exc,
                )
                results = await self._db_fallback_search(
                    query=query,
                    limit=retrieval_limit,
                    document_ids=document_ids,
                    section=section,
                )
            else:
                raise

        # 4. Perform reranking if enabled
        if rerank and results:
            from app.services.retrieval.reranker import rerank_documents
            results = await rerank_documents(query=query, documents=results, limit=top_k)

        logger.info(
            "Semantic search: query='%s...' top_k=%s (retrieved=%s, reranked=%s) filters=%s returned=%s",
            query[:40],
            top_k,
            retrieval_limit,
            rerank,
            {"document_ids": document_ids, "section": section, "version": version},
            len(results),
        )

        return results

    async def _db_fallback_search(
        self,
        query: str,
        limit: int,
        document_ids: Optional[List[str]] = None,
        section: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Fallback: search the chunks table directly using SQL LIKE when Qdrant is down.
        Matches on section name and chunk_text content.
        """
        query_lower = query.lower().strip()
        # Build keyword list from the query label (e.g. "Dosage & Administration" -> ["dosage", "administration"])
        keywords = [w for w in query_lower.replace("&", " ").split() if len(w) > 2]

        async with self._session_factory() as db:
            stmt = select(Chunk, Document.file_name).join(
                Document, Chunk.document_id == Document.document_id
            )

            conditions = []
            if document_ids:
                conditions.append(Chunk.document_id.in_(document_ids))

            if keywords:
                keyword_conditions = []
                for kw in keywords:
                    keyword_conditions.append(Chunk.section.ilike(f"%{kw}%"))
                    keyword_conditions.append(Chunk.chunk_text.ilike(f"%{kw}%"))
                conditions.append(or_(*keyword_conditions))

            if conditions:
                stmt = stmt.where(*conditions)

            stmt = stmt.order_by(Chunk.chunk_index).limit(limit)
            result = await db.execute(stmt)
            rows = result.all()

        results = []
        for chunk, doc_name in rows:
            results.append({
                "chunk_id": str(chunk.chunk_id),
                "score": 0.5,
                "document_id": chunk.document_id,
                "document_name": doc_name,
                "page_no": chunk.page_no,
                "section_title": chunk.section,
                "chunk_index": chunk.chunk_index,
                "extraction_method": None,
                "version": None,
                "text_hash": chunk.text_hash,
                "text": chunk.chunk_text,
            })

        return results
