from datetime import datetime
import json
from pydantic import BaseModel, ConfigDict, field_validator


class MemoryBase(BaseModel):
    content: str


class MemoryCreate(MemoryBase):
    pass


class MemoryResponse(MemoryBase):
    model_config = ConfigDict(from_attributes=True)

    memory_id: str
    user_id: str
    created_at: datetime | None = None
    updated_at: datetime | None = None
    citations: list[dict] | None = None
    is_default: bool = False

    @field_validator("citations", mode="before")
    @classmethod
    def parse_citations(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return []
        return v

    @field_validator("is_default", mode="before")
    @classmethod
    def parse_is_default(cls, v):
        if v is None:
            return False
        return bool(v)


class MemoryToggle(BaseModel):
    memory_enabled: bool
