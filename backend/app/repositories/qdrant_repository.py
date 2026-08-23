import asyncio
import logging
import uuid
from typing import List, Dict, Any, Optional

from qdrant_client import AsyncQdrantClient
from qdrant_client.http.exceptions import ResponseHandlingException
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
    TextIndexParams,
    TokenizerType,
    Filter,
    FieldCondition,
    MatchAny,
    MatchValue
)
from app.core.config import settings

logger = logging.getLogger(__name__)

QDRANT_TIMEOUT = 30
QDRANT_MAX_RETRIES = 2
QDRANT_RETRY_DELAY = 1.0


class QdrantRepository:
    """
    Repository for interacting asynchronously with Qdrant Vector Database.
    Implements collection creation, payload indexing, batch upserts, and filtered search.
    """

    def __init__(self, client: Optional[AsyncQdrantClient] = None):
        self._client = client
        self.collection_name = settings.QDRANT_COLLECTION
        self._collection_verified = False
        self._vector_size: Optional[int] = None
        self._lock = asyncio.Lock()

    @property
    def client(self) -> AsyncQdrantClient:
        if self._client is None:
            api_key = getattr(settings, "QDRANT_API_KEY", None)
            self._client = AsyncQdrantClient(
                url=settings.QDRANT_URL,
                api_key=api_key,
                timeout=QDRANT_TIMEOUT,
            )
        return self._client

    def _reset_client(self):
        """Reset the cached client so the next access creates a fresh connection."""
        self._client = None
        self._collection_verified = False

    def set_vector_size(self, vector_size: int):
        """Set the collection vector size from the actual embedding model."""
        self._vector_size = vector_size

    async def ensure_collection_exists(self, vector_size: Optional[int] = None):
        """
        Asynchronously checks if the collection exists, creating it and configuring
        the optimized payload indexes (keyword, full-text) if missing.
        """
        if vector_size is not None:
            self._vector_size = vector_size

        if self._collection_verified:
            return

        async with self._lock:
            if self._collection_verified:
                return

            try:
                collections = await self.client.get_collections()
                exists = any(c.name == self.collection_name for c in collections.collections)

                size = self._vector_size or 1024  # Safe default until verified by the model

                if not exists:
                    logger.info(f"Creating Qdrant collection: {self.collection_name}")
                    await self.client.create_collection(
                        collection_name=self.collection_name,
                        vectors_config=VectorParams(
                            size=size,
                            distance=Distance.COSINE
                        )
                    )

                    # Payload indexes for filtering and keyword retrieval
                    keyword_fields = ["document_id", "section", "version", "extraction_method"]
                    for field in keyword_fields:
                        await self.client.create_payload_index(
                            collection_name=self.collection_name,
                            field_name=field,
                            field_schema="keyword"
                        )

                    await self.client.create_payload_index(
                        collection_name=self.collection_name,
                        field_name="chunk_text",
                        field_schema=TextIndexParams(
                            type="text",
                            tokenizer=TokenizerType.WORD,
                            lowercase=True
                        )
                    )
                    logger.info("Successfully configured Qdrant collection and indexes.")

                self._collection_verified = True
            except Exception as e:
                logger.error(f"Failed to verify/create Qdrant collection: {e}")

    async def add_chunk(
        self,
        chunk_id: int,
        document_id: str,
        document_name: str,
        page_no: int,
        section: Optional[str],
        chunk_index: int,
        chunk_text: str,
        embedding: List[float],
        quality_score: float = 1.0,
        ocr_confidence: Optional[float] = None,
        extraction_method: Optional[str] = None,
    ):
        """Index a single document chunk with both text and metadata payload."""
        await self.ensure_collection_exists()

        point = PointStruct(
            id=chunk_id,
            vector=embedding,
            payload={
                "chunk_id": chunk_id,
                "document_id": document_id,
                "document_name": document_name,
                "page_no": page_no,
                "section": section,
                "chunk_index": chunk_index,
                "chunk_text": chunk_text,
                "text": chunk_text,  # Added for backwards/alternate schema compatibility
                "quality_score": quality_score,
                "ocr_confidence": ocr_confidence,
                "extraction_method": extraction_method,
            }
        )

        await self.client.upsert(
            collection_name=self.collection_name,
            points=[point]
        )

    async def add_chunks(self, chunks: List[Dict[str, Any]]):
        """Index a batch of chunks into Qdrant in a single bulk operation."""
        if not chunks:
            return

        await self.ensure_collection_exists()
        points = []

        for chunk in chunks:
            # Fallback to UUID string if chunk_id is not integer or not present
            point_id = chunk.get("chunk_id")
            if point_id is None:
                point_id = str(uuid.uuid4())

            point = PointStruct(
                id=point_id,
                vector=chunk["embedding"],
                payload={
                    "chunk_id": chunk.get("chunk_id"),
                    "document_id": chunk["document_id"],
                    "document_name": chunk.get("document_name"),
                    "page_no": chunk.get("page_no"),
                    "section": chunk.get("section") or chunk.get("section_title"),
                    "chunk_index": chunk.get("chunk_index"),
                    "chunk_text": chunk.get("chunk_text") or chunk.get("text"),
                    "text": chunk.get("chunk_text") or chunk.get("text"),
                    "extraction_method": chunk.get("extraction_method"),
                    "version": chunk.get("version"),
                    "text_hash": chunk.get("text_hash"),
                    "quality_score": chunk.get("quality_score", 1.0),
                    "ocr_confidence": chunk.get("ocr_confidence"),
                }
            )
            points.append(point)

        await self.client.upsert(
            collection_name=self.collection_name,
            points=points
        )

    async def search(
        self,
        query_vector: List[float],
        limit: int = 5,
        document_ids: Optional[List[str]] = None,
        section: Optional[str] = None,
        version: Optional[str] = None,
        score_threshold: Optional[float] = None,
    ) -> List[Any]:
        """Perform semantic search using vector similarity in Qdrant with optional filters."""
        await self.ensure_collection_exists()

        must_conditions = []
        if document_ids:
            must_conditions.append(
                FieldCondition(key="document_id", match=MatchAny(any=document_ids))
            )
        if section:
            must_conditions.append(
                FieldCondition(key="section", match=MatchValue(value=section))
            )
        if version:
            must_conditions.append(
                FieldCondition(key="version", match=MatchValue(value=version))
            )

        query_filter = Filter(must=must_conditions) if must_conditions else None

        last_exc = None
        for attempt in range(QDRANT_MAX_RETRIES + 1):
            try:
                results = await self.client.query_points(
                    collection_name=self.collection_name,
                    query=query_vector,
                    query_filter=query_filter,
                    limit=limit,
                    score_threshold=score_threshold,
                )
                return results.points
            except Exception as exc:
                last_exc = exc
                logger.warning(
                    "Qdrant search attempt %d/%d failed: %s",
                    attempt + 1,
                    QDRANT_MAX_RETRIES + 1,
                    exc,
                )
                if attempt < QDRANT_MAX_RETRIES:
                    self._reset_client()
                    await self.ensure_collection_exists()
                    await asyncio.sleep(QDRANT_RETRY_DELAY)

        raise last_exc

    async def delete_document_chunks(self, document_id: str):
        """Delete all vectors and payload associated with a specific document ID from Qdrant."""
        await self.ensure_collection_exists()
        
        await self.client.delete(
            collection_name=self.collection_name,
            points_selector=Filter(
                must=[
                    FieldCondition(
                        key="document_id",
                        match=MatchValue(value=document_id)
                    )
                ]
            )
        )


# Singleton instance of repository
qdrant_repository = QdrantRepository()