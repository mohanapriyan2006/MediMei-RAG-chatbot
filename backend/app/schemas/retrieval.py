from typing import List, Optional
from pydantic import BaseModel, Field

from app.core.config import settings


class RetrievalResult(BaseModel):
    chunk_id: str
    score: float
    document_id: Optional[str] = None
    document_name: Optional[str] = None
    page_no: Optional[int] = None
    section_title: Optional[str] = None
    chunk_index: Optional[int] = None
    extraction_method: Optional[str] = None
    version: Optional[str] = None
    text_hash: Optional[str] = None
    text: Optional[str] = None
    quality_score: float = 1.0
    ocr_confidence: Optional[float] = None


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, description="User question or search phrase.")
    document_ids: Optional[List[str]] = None
    section: Optional[str] = None
    version: Optional[str] = None
    top_k: int = Field(default=settings.TOP_K, ge=1, le=100)
    score_threshold: Optional[float] = Field(default=settings.MIN_RELEVANCE_SCORE, ge=-1.0, le=1.0)
    rerank: Optional[bool] = Field(default=None, description="Whether to apply CrossEncoder reranking.")


class SearchResponse(BaseModel):
    query: str
    results: List[RetrievalResult]
