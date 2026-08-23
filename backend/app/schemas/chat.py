from datetime import datetime
from typing import List
from pydantic import BaseModel
from app.schemas.evidence import Citation


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None
    document_ids: List[str] = []


class ChatResponse(BaseModel):
    message_id: str
    session_id: str
    answer: str
    thinking: str | None = None
    grounded: bool
    evidence_count: int
    citations: List[Citation]
    memories_updated: List[str] | None = None
    memories_used: List[str] | None = None


class MessageResponse(BaseModel):
    message_id: str
    session_id: str
    role: str
    content: str
    thinking: str | None = None
    timestamp: datetime | None = None
    citations: List[Citation] = []
    memories_updated: List[str] | None = None
    memories_used: List[str] | None = None


class SessionResponse(BaseModel):
    session_id: str
    started_at: datetime | None = None
    summary: str | None = None
    messages: List[MessageResponse] = []


class SessionCreate(BaseModel):
    summary: str | None = None


class SessionUpdate(BaseModel):
    summary: str
