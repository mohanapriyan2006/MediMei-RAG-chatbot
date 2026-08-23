from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class ComparisonRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    drug1_id: str = Field(..., validation_alias="drug1Id", serialization_alias="drug1Id")
    drug2_id: str = Field(..., validation_alias="drug2Id", serialization_alias="drug2Id")


class ComparisonCitation(BaseModel):
    citation_id: str = Field(..., serialization_alias="citationId")
    document_id: str = Field(..., serialization_alias="documentId")
    document_name: str = Field(..., serialization_alias="documentName")
    page: int = 0
    section: Optional[str] = None
    text: Optional[str] = None
    score: Optional[float] = None


class ComparisonCell(BaseModel):
    content: str
    citations: List[ComparisonCitation] = []
    status: str = "normal"


class ComparisonAttribute(BaseModel):
    key: str
    label: str
    drug1: ComparisonCell
    drug2: ComparisonCell


class DrugInfo(BaseModel):
    id: str
    name: str
    generic_name: Optional[str] = Field(default=None, serialization_alias="genericName")
    drug_class: Optional[str] = Field(default=None, serialization_alias="drugClass")
    document_name: str = Field(..., serialization_alias="documentName")
    page_count: int = Field(..., serialization_alias="pageCount")


class ComparisonSummary(BaseModel):
    total_attributes: int = Field(..., serialization_alias="totalAttributes")
    warning_count: int = Field(..., serialization_alias="warningCount")
    highlight_count: int = Field(..., serialization_alias="highlightCount")
    unavailable_count: int = Field(..., serialization_alias="unavailableCount")
    both_unavailable_count: int = Field(..., serialization_alias="bothUnavailableCount")


class ComparisonResult(BaseModel):
    drug1: DrugInfo
    drug2: DrugInfo
    attributes: List[ComparisonAttribute]
    summary: ComparisonSummary
