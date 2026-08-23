import hashlib
import logging
from typing import Any, Dict, List, Optional

from app.core.config import settings
from app.repositories.qdrant_repository import qdrant_repository
from app.services.embeddings.embedding_service import embedding_service

logger = logging.getLogger(__name__)


class IndexerService:
    """
    Service responsible for taking Part 1 structured chunks,
    generating BGE-M3 embeddings, and indexing them into Qdrant.
    """

    def __init__(
        self,
        embedding_svc=None,
        qdrant_repo=None,
        batch_size: int = None,
    ):
        self.embedding_service = embedding_svc or embedding_service
        self.qdrant_repository = qdrant_repo or qdrant_repository
        self.batch_size = batch_size or settings.EMBEDDING_BATCH_SIZE

    @staticmethod
    def _derive_text_hash(text: str) -> str:
        return hashlib.md5(text.encode("utf-8")).hexdigest()

    @staticmethod
    def _build_qdrant_chunk(chunk: Dict[str, Any], embedding: List[float]) -> Dict[str, Any]:
        text = chunk.get("text") or chunk.get("chunk_text") or ""
        text_hash = chunk.get("text_hash") or IndexerService._derive_text_hash(text)

        return {
            "chunk_id": chunk.get("chunk_id"),
            "document_id": chunk.get("document_id"),
            "document_name": chunk.get("document_name"),
            "page_no": chunk.get("page_no"),
            "section": chunk.get("section") or chunk.get("section_title"),
            "chunk_index": chunk.get("chunk_index"),
            "chunk_text": text,
            "text": text,
            "extraction_method": chunk.get("extraction_method"),
            "version": chunk.get("version"),
            "text_hash": text_hash,
            "quality_score": chunk.get("quality_score", 1.0),
            "ocr_confidence": chunk.get("ocr_confidence"),
            "embedding": embedding,
        }

    async def index_chunks(self, chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Embed a list of structured chunks and upsert them into Qdrant.
        Returns a summary including the count of indexed chunks and the vector size.
        """
        if not chunks:
            logger.warning("No chunks provided to IndexerService.index_chunks")
            return {"indexed_count": 0, "vector_size": None, "success": True}

        # 1. Make sure Qdrant collection is created with the real model dimension.
        vector_size = self.embedding_service.vector_size
        self.qdrant_repository.set_vector_size(vector_size)

        # 2. Extract texts and request aligned embeddings (empty/whitespace become None).
        texts = [c.get("text") or c.get("chunk_text") or "" for c in chunks]
        embeddings = self.embedding_service.embed_texts(texts)

        # 3. Build Qdrant point dicts only for chunks that were successfully embedded.
        qdrant_chunks = []
        for chunk, emb in zip(chunks, embeddings):
            if emb is None:
                logger.warning(
                    "Skipping chunk %s for document %s because embedding was None",
                    chunk.get("chunk_id"),
                    chunk.get("document_id"),
                )
                continue
            qdrant_chunks.append(self._build_qdrant_chunk(chunk, emb))

        if not qdrant_chunks:
            logger.warning("No valid chunks to index after embedding")
            return {"indexed_count": 0, "vector_size": vector_size, "success": True}

        # 4. Bulk upsert into Qdrant.
        await self.qdrant_repository.add_chunks(qdrant_chunks)
        logger.info(
            "Indexed %d chunks for document(s): %s",
            len(qdrant_chunks),
            {c["document_id"] for c in qdrant_chunks},
        )

        return {
            "indexed_count": len(qdrant_chunks),
            "vector_size": vector_size,
            "success": True,
        }

    async def verify_index(self, expected_count: int, document_id: Optional[str] = None) -> bool:
        """Basic verification that the expected number of vectors is present."""
        await self.qdrant_repository.ensure_collection_exists()

        filter_ = None
        if document_id:
            from qdrant_client.models import Filter, FieldCondition, MatchValue
            filter_ = Filter(
                must=[FieldCondition(key="document_id", match=MatchValue(value=document_id))]
            )

        count_result = await self.qdrant_repository.client.count(
            collection_name=self.qdrant_repository.collection_name,
            count_filter=filter_,
        )
        actual = count_result.count
        logger.info(
            "Index verification: expected=%s, actual=%s, document_id=%s",
            expected_count,
            actual,
            document_id,
        )
        return actual == expected_count
