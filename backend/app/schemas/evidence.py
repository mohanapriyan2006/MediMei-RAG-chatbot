from pydantic import BaseModel, ConfigDict, field_validator


class Citation(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    citation_id: str | None = None
    document_id: str = ""
    document_name: str = "Unknown Document"
    page: int = 1
    section: str | None = None
    chunk_id: str = ""
    text: str | None = None
    score: float | None = None

    @field_validator("chunk_id", "document_id", "citation_id", mode="before")
    @classmethod
    def coerce_to_str(cls, v):
        if v is None:
            return ""
        return str(v)

    @field_validator("document_name", mode="before")
    @classmethod
    def coerce_doc_name(cls, v):
        if not v:
            return "Official Reference Document"
        return str(v)

    @field_validator("page", mode="before")
    @classmethod
    def coerce_to_int(cls, v):
        if v is None:
            return 1
        try:
            return int(v)
        except (ValueError, TypeError):
            return 1

    @field_validator("score", mode="before")
    @classmethod
    def coerce_to_float(cls, v):
        if v is None:
            return None
        try:
            return float(v)
        except (ValueError, TypeError):
            return None
