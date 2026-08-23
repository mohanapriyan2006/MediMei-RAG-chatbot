import pytest
from unittest.mock import AsyncMock, MagicMock

from app.services.chat.citation_mapper import CitationMapper
from app.services.chat.evidence_context_builder import EvidenceContextBuilder
from app.services.chat.rag_service import RAGService
from app.services.llm.prompt_builder import PromptBuilder
from app.services.validation.grounding_validator import GroundingValidator


def test_evidence_context_builder():
    builder = EvidenceContextBuilder()
    results = [
        {
            "chunk_id": "c1",
            "document_id": "doc-1",
            "document_name": "drug.pdf",
            "page_no": 7,
            "section_title": "DOSAGE AND ADMINISTRATION",
            "text": "Take 10 mg once daily.",
            "score": 0.91,
        },
        {
            "chunk_id": "c2",
            "document_id": "doc-1",
            "document_name": "drug.pdf",
            "page_no": 8,
            "section_title": "CONTRAINDICATIONS",
            "text": "Do not use in hypersensitivity.",
            "score": 0.88,
        },
    ]

    context, cmap = builder.build(results)

    assert "[S1] drug.pdf — Page 7 — DOSAGE AND ADMINISTRATION" in context
    assert "[S2] drug.pdf — Page 8 — CONTRAINDICATIONS" in context
    assert cmap["S1"]["chunk_id"] == "c1"
    assert cmap["S2"]["chunk_id"] == "c2"


def test_prompt_builder_contains_grounding_rules():
    prompt = PromptBuilder.build(
        question="What is the dosage?",
        evidence_context="[S1] Some evidence",
    )

    assert "MediMei" in prompt
    assert "ONLY the evidence" in prompt
    assert "I don't know based on the provided documents" in prompt
    assert "What is the dosage?" in prompt
    assert "[S1] Some evidence" in prompt


def test_citation_mapper_extracts_valid_and_strips_invalid():
    mapper = CitationMapper()
    citation_map = {
        "S1": {
            "chunk_id": "c1",
            "document_id": "doc-1",
            "document_name": "drug.pdf",
            "page_no": 7,
            "section_title": "DOSAGE AND ADMINISTRATION",
            "score": 0.91,
        }
    }

    answer, citations, invalid = mapper.extract_citations(
        "Take 10 mg daily. [S1] Also see [S9].",
        citation_map,
    )

    assert answer == "Take 10 mg daily. [S1] Also see."
    assert len(citations) == 1
    assert citations[0]["citation_id"] == "S1"
    assert citations[0]["page_no"] == 7
    assert "S9" in invalid


def test_grounding_validator():
    validator = GroundingValidator()

    assert validator.validate("", [], 0) == {
        "grounded": False,
        "reason": "no_retrieved_evidence",
    }

    assert validator.validate(
        "I don't know based on the provided documents.",
        [],
        3,
    ) == {"grounded": True, "reason": "explicit_abstention"}

    assert validator.validate(
        "Some answer without citations.",
        [],
        3,
    ) == {"grounded": False, "reason": "insufficient_citations"}

    assert validator.validate(
        "Take 10 mg. [S1]",
        [{"citation_id": "S1"}],
        3,
    ) == {"grounded": True, "reason": "citations_present"}


@pytest.mark.asyncio
async def test_rag_service_no_evidence():
    mock_search = MagicMock()
    mock_search.search = AsyncMock(return_value=[])

    rag = RAGService(search_service=mock_search)
    result = await rag.ask("What is the dosage?")

    assert result["answer"] == "I don't know based on the provided documents."
    assert result["grounded"] is False
    assert result["sources_used"] == 0
    assert result["citations"] == []


@pytest.mark.asyncio
async def test_rag_service_answer_with_citations():
    evidence = [
        {
            "chunk_id": "c1",
            "document_id": "doc-1",
            "document_name": "drug.pdf",
            "page_no": 7,
            "section_title": "DOSAGE AND ADMINISTRATION",
            "text": "Take 10 mg once daily.",
            "score": 0.91,
        }
    ]

    mock_llm = MagicMock()
    mock_llm.generate_async = AsyncMock(return_value="The dosage is 10 mg once daily. [S1]")

    rag = RAGService(llm_service=mock_llm)
    result = await rag.answer_with_evidence("What is the dosage?", evidence)

    assert result["answer"] == "The dosage is 10 mg once daily. [S1]"
    assert result["grounded"] is True
    assert result["sources_used"] == 1
    assert len(result["citations"]) == 1
    assert result["citations"][0]["citation_id"] == "S1"
    assert result["citations"][0]["page_no"] == 7


@pytest.mark.asyncio
async def test_rag_service_rejects_fabricated_citation():
    evidence = [
        {
            "chunk_id": "c1",
            "document_id": "doc-1",
            "document_name": "drug.pdf",
            "page_no": 7,
            "section_title": "DOSAGE AND ADMINISTRATION",
            "text": "Take 10 mg once daily.",
            "score": 0.91,
        }
    ]

    mock_llm = MagicMock()
    # S2 does not exist, so it should be stripped and the answer marked ungrounded.
    mock_llm.generate_async = AsyncMock(return_value="Take 10 mg. [S2]")

    rag = RAGService(llm_service=mock_llm)
    result = await rag.answer_with_evidence("What is the dosage?", evidence)

    assert result["answer"] == "Take 10 mg."
    assert result["grounded"] is False
    assert result["sources_used"] == 0


