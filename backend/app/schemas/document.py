from datetime import datetime
from pydantic import BaseModel, ConfigDict


class DocumentResponse(BaseModel):
    document_id: str
    file_name: str
    storage_key: str
    source: str | None = None
    version: str | None = None
    status: str | None = None
    stage: str | None = None
    progress: int | None = None
    progress_detail: str | None = None
    created_at: datetime | None = None
    is_active: bool | None = None
    file_size: int | None = None
    page_count: int | None = None

    model_config = ConfigDict(from_attributes=True)


class DocumentUploadResponse(BaseModel):
    document: DocumentResponse
    message: str


class DocumentProcessResponse(BaseModel):
    document_id: str
    job_id: str
    stage: str
    status: str
    message: str


class DocumentUpdate(BaseModel):
    source: str | None = None
    version: str | None = None
    file_name: str | None = None


class DocumentStatusResponse(BaseModel):
    document_id: str
    status: str | None = None
    stage: str | None = None
    progress: int | None = None
    progress_detail: str | None = None
    message: str
