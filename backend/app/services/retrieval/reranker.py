import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

# Cached CrossEncoder instance
_reranker_model_instance = None

def get_reranker_model():
    """
    Load CrossEncoder reranker model lazily and cache it to avoid startup overhead.
    Uses 'cross-encoder/ms-marco-MiniLM-L-6-v2' (lightweight, highly efficient).
    """
    global _reranker_model_instance
    if _reranker_model_instance is not None:
        return _reranker_model_instance

    try:
        from sentence_transformers import CrossEncoder
        import torch
        device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Initializing CrossEncoder reranker on device: {device}")
        
        # Initialize CrossEncoder
        _reranker_model_instance = CrossEncoder(
            "cross-encoder/ms-marco-MiniLM-L-6-v2",
            device=device
        )
        logger.info("Successfully loaded CrossEncoder reranker model.")
    except Exception as e:
        logger.warning(
            f"Failed to load sentence-transformers CrossEncoder: {e}. "
            "Reranking will fall back gracefully to original retriever scores."
        )
        _reranker_model_instance = None

    return _reranker_model_instance


async def rerank_documents(
    query: str,
    documents: List[Dict[str, Any]],
    limit: int = 5
) -> List[Dict[str, Any]]:
    """
    Rerank a set of retrieved documents against a query using a Cross-Encoder.
    Falls back to returning the original documents list if the model is unavailable.
    """
    if not documents:
        return []

    model = get_reranker_model()
    if model is None:
        # Fallback to returning original top-K list
        return documents[:limit]

    try:
        # Construct query-passage pairs for CrossEncoder prediction
        pairs = [[query, doc.get("text") or doc.get("chunk_text") or ""] for doc in documents]
        
        # Predict relevance scores
        scores = model.predict(pairs)
        
        # Attach rerank score and sort documents
        for doc, score in zip(documents, scores):
            doc["rerank_score"] = float(score)
            if "score" in doc and "vector_score" not in doc:
                doc["vector_score"] = doc["score"]
            doc["score"] = float(score)

        # Sort based on cross-encoder rerank score descending
        ranked_docs = sorted(documents, key=lambda x: x["rerank_score"], reverse=True)
        return ranked_docs[:limit]
    except Exception as e:
        logger.error(f"Error during cross-encoder reranking: {e}. Falling back to original retrieval order.")
        return documents[:limit]
