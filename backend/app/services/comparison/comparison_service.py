import asyncio
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.core.task_manager import task_manager, TaskCancelledError
from app.models.document import Document
from app.models.document_page import DocumentPage
from app.schemas.comparison import (
    ComparisonAttribute,
    ComparisonCell,
    ComparisonCitation,
    ComparisonRequest,
    ComparisonResult,
    ComparisonSummary,
    DrugInfo,
)
from app.services.chat.citation_mapper import CitationMapper
from app.services.chat.evidence_context_builder import EvidenceContextBuilder
from app.services.llm.llm_service import LLMService
from app.services.retrieval.semantic_search_service import SemanticSearchService

logger = logging.getLogger(__name__)

ATTRIBUTE_LABELS: List[Tuple[str, str]] = [
    ("indications", "Indications"),
    ("dosage_administration", "Dosage & Administration"),
    ("warnings", "Warnings"),
    ("contraindications", "Contraindications"),
    ("drug_interactions", "Drug Interactions"),
    ("adverse_reactions", "Adverse Reactions"),
    ("use_in_specific_populations", "Use in Specific Populations"),
    ("pregnancy", "Pregnancy"),
    ("pediatric_use", "Pediatric Use"),
    ("geriatric_use", "Geriatric Use"),
    ("renal_impairment", "Renal Impairment"),
    ("hepatic_impairment", "Hepatic Impairment"),
    ("storage", "Storage"),
]

WARNING_KEYS = {"warnings", "contraindications", "pregnancy"}
HIGHLIGHT_KEYS = {"dosage_administration"}

ATTRIBUTE_BATCH_SIZE = 1


class ComparisonInputError(Exception):
    """Raised for invalid comparison requests (maps to an HTTPException in the route)."""

    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class ComparisonService:
    """Generates side-by-side drug-label comparisons using the existing RAG pipeline."""

    def __init__(
        self,
        search_service: Optional[SemanticSearchService] = None,
        context_builder: Optional[EvidenceContextBuilder] = None,
        llm_service: Optional[LLMService] = None,
        citation_mapper: Optional[CitationMapper] = None,
        batch_size: Optional[int] = None,
    ):
        self.search_service = search_service or SemanticSearchService()
        self.context_builder = context_builder or EvidenceContextBuilder()
        self.llm_service = llm_service or LLMService()
        self.citation_mapper = citation_mapper or CitationMapper()
        self.batch_size = batch_size or ATTRIBUTE_BATCH_SIZE

    async def compare(
        self,
        request: ComparisonRequest,
        db: AsyncSession,
        task_id: Optional[str] = None,
    ) -> ComparisonResult:
        drug1_id = request.drug1_id
        drug2_id = request.drug2_id

        if drug1_id == drug2_id:
            raise ComparisonInputError(
                "Cannot compare the same document with itself.",
                status_code=400,
            )

        result = await db.execute(
            select(Document).where(Document.document_id.in_([drug1_id, drug2_id]))
        )
        docs = {d.document_id: d for d in result.scalars().all()}

        for doc_id in (drug1_id, drug2_id):
            if doc_id not in docs:
                raise ComparisonInputError(
                    f"Document not found: {doc_id}",
                    status_code=404,
                )

        for doc_id, doc in docs.items():
            if doc.status not in ("completed", "ready"):
                raise ComparisonInputError(
                    f"Document is not ready for comparison: {doc_id}",
                    status_code=409,
                )

        drug1_info = await self._build_drug_info(db, docs[drug1_id])
        drug2_info = await self._build_drug_info(db, docs[drug2_id])

        attributes = await self._build_attributes(
            drug1_id,
            drug2_id,
            drug1_info.name,
            drug2_info.name,
            task_id=task_id,
        )

        summary = self._build_summary(attributes)

        return ComparisonResult(
            drug1=drug1_info,
            drug2=drug2_info,
            attributes=attributes,
            summary=summary,
        )

    @staticmethod
    def _build_summary(attributes: List[ComparisonAttribute]) -> ComparisonSummary:
        all_cells = [cell for attr in attributes for cell in (attr.drug1, attr.drug2)]
        statuses = [cell.status for cell in all_cells]

        return ComparisonSummary(
            total_attributes=len(attributes),
            warning_count=statuses.count("warning"),
            highlight_count=statuses.count("highlight"),
            unavailable_count=statuses.count("unavailable"),
            both_unavailable_count=sum(
                1 for attr in attributes if attr.drug1.status == "unavailable" and attr.drug2.status == "unavailable"
            ),
        )

    async def _build_drug_info(self, db: AsyncSession, doc: Document) -> DrugInfo:
        page_count_result = await db.execute(
            select(func.count())
            .select_from(DocumentPage)
            .where(DocumentPage.document_id == doc.document_id)
        )
        page_count = page_count_result.scalar() or 0
        name = doc.source or doc.file_name

        return DrugInfo(
            id=doc.document_id,
            name=name,
            document_name=doc.file_name,
            page_count=page_count,
        )

    async def _build_attributes(
        self,
        drug1_id: str,
        drug2_id: str,
        drug1_name: str,
        drug2_name: str,
        task_id: Optional[str] = None,
    ) -> List[ComparisonAttribute]:
        await task_manager.raise_if_cancelled(task_id)

        # 1. Gather evidence with bounded concurrency to avoid overwhelming Qdrant.
        sem = asyncio.Semaphore(4)

        async def _limited_gather(key, label):
            async with sem:
                return await self._gather_evidence(key, label, drug1_id, drug2_id, task_id=task_id)

        tasks = [
            _limited_gather(key, label)
            for key, label in ATTRIBUTE_LABELS
        ]
        evidence_list = await asyncio.gather(*tasks)

        # 2. Keep only sections present in at least one document.
        present_evidence = [
            (key, label, results1, results2)
            for key, label, results1, results2 in evidence_list
            if results1 or results2
        ]

        if not present_evidence:
            return []

        # 3. Generate comparison cells in batches.
        attributes: List[ComparisonAttribute] = []
        for i in range(0, len(present_evidence), self.batch_size):
            batch = present_evidence[i : i + self.batch_size]
            batch_attrs = await self._generate_batch(
                batch,
                drug1_name,
                drug2_name,
                task_id=task_id,
            )
            attributes.extend(batch_attrs)

        # 4. Hide rows where both drugs have no useful information.
        before_filter = len(attributes)
        attributes = [
            attr
            for attr in attributes
            if not (attr.drug1.status == "unavailable" and attr.drug2.status == "unavailable")
        ]
        if before_filter != len(attributes):
            logger.info(
                "Filtered %d attributes where both drugs unavailable",
                before_filter - len(attributes),
            )

        return attributes

    async def _gather_evidence(
        self,
        key: str,
        label: str,
        drug1_id: str,
        drug2_id: str,
        task_id: Optional[str] = None,
    ) -> Tuple[str, str, List[Dict[str, Any]], List[Dict[str, Any]]]:
        await task_manager.raise_if_cancelled(task_id)
        results1, results2 = await asyncio.gather(
            self.search_service.search(
                query=label,
                top_k=5,
                document_ids=[drug1_id],
                score_threshold=max(0.15, settings.MIN_RELEVANCE_SCORE),
            ),
            self.search_service.search(
                query=label,
                top_k=5,
                document_ids=[drug2_id],
                score_threshold=max(0.15, settings.MIN_RELEVANCE_SCORE),
            ),
        )
        logger.info(
            "Evidence for '%s': drug1=%d results, drug2=%d results",
            label, len(results1), len(results2),
        )
        return key, label, results1, results2

    async def _generate_batch(
        self,
        batch: List[Tuple[str, str, List[Dict[str, Any]], List[Dict[str, Any]]]],
        drug1_name: str,
        drug2_name: str,
        task_id: Optional[str] = None,
    ) -> List[ComparisonAttribute]:
        await task_manager.raise_if_cancelled(task_id)
        evidence: List[Tuple[str, str, str, str, Dict[str, Dict[str, Any]]]] = []

        for key, label, results1, results2 in batch:
            if not results1 and not results2:
                continue

            context1, citation_map1 = self.context_builder.build(results1)
            context2, citation_map2 = self.context_builder.build(results2)

            # Renumber citation IDs in context2 to avoid conflicts with context1
            offset = len(citation_map1)
            if context2 and offset > 0:
                context2 = re.sub(
                    r"\[S(\d+)\]",
                    lambda m: f"[S{int(m.group(1)) + offset}]",
                    context2,
                )
            citation_map2 = {
                f"S{int(k[1:]) + offset}": v for k, v in citation_map2.items()
            }

            merged_citation_map = {**citation_map1, **citation_map2}
            evidence.append((key, label, context1, context2, merged_citation_map))

        if not evidence:
            return []

        prompt = self._build_batch_prompt(evidence, drug1_name, drug2_name)

        await task_manager.raise_if_cancelled(task_id)

        try:
            llm_result = await self.llm_service.generate_async(
                prompt,
                task_id=task_id,
                max_new_tokens=min(1024, 256 * len(evidence)),
                temperature=0.1,
                stop=["</think>", "<|im_end|>"],
            )
            await task_manager.raise_if_cancelled(task_id)
        except TaskCancelledError:
            raise
        except Exception as exc:
            logger.warning("LLM batch generation failed: %s", exc)
            return [
                ComparisonAttribute(
                    key=key,
                    label=label,
                    drug1=ComparisonCell(
                        content="Not available in source document.",
                        citations=[],
                        status="unavailable",
                    ),
                    drug2=ComparisonCell(
                        content="Not available in source document.",
                        citations=[],
                        status="unavailable",
                    ),
                )
                for key, label, _, _, _ in evidence
            ]

        # generate_async returns {"text": ..., "thinking": ...}
        if isinstance(llm_result, dict):
            answer = llm_result.get("text", "")
        else:
            answer = str(llm_result)

        logger.info("LLM batch answer length: %d chars for %d sections", len(answer), len(evidence))
        cell_texts = self._parse_batch_answer(answer, len(evidence))

        attributes: List[ComparisonAttribute] = []
        for (key, label, context1, context2, citation_map), (drug1_text, drug2_text) in zip(
            evidence, cell_texts
        ):
            cell1 = self._build_cell(drug1_text, citation_map, key)
            cell2 = self._build_cell(drug2_text, citation_map, key)
            attributes.append(
                ComparisonAttribute(
                    key=key,
                    label=label,
                    drug1=cell1,
                    drug2=cell2,
                )
            )

        return attributes

    @staticmethod
    def _build_batch_prompt(
        evidence: List[Tuple[str, str, str, str, Dict[str, Dict[str, Any]]]],
        drug1_name: str,
        drug2_name: str,
    ) -> str:
        blocks = []
        for i, (key, label, context1, context2, _) in enumerate(evidence, 1):
            block = (
                f"Section {i}: {label}\n"
                f"=== Evidence for {drug1_name} ===\n"
                f"{context1 or 'No evidence found.'}\n\n"
                f"=== Evidence for {drug2_name} ===\n"
                f"{context2 or 'No evidence found.'}"
            )
            blocks.append(block)

        return (
            "You are MediMei, a clinical assistant. Compare the following sections of two drug labels. "
            "Use ONLY the evidence under each section. Do not use outside knowledge, do not infer unsupported dosages, "
            "and do not fabricate citations. Cite relevant sources using the [S1], [S2], etc. markers from that section. "
            "Be concise: 1-2 short sentences per drug. "
            "If the evidence does not contain information for a drug, write exactly: 'Not available in source document.'\n\n"
            "IMPORTANT: Format your answer exactly as shown below. Start each section with 'Section N:' and use 'DRUG1:' and 'DRUG2:' labels.\n"
            "Separate sections with a line containing only '---'.\n\n"
            "Example:\n"
            "Section 1: Indications\n"
            "DRUG1: Used for rheumatoid arthritis [S1].\n"
            "DRUG2: Used for plaque psoriasis [S2].\n"
            "---\n"
            "Section 2: Dosage & Administration\n"
            "DRUG1: 15 mg once daily [S1].\n"
            "DRUG2: 150 mg injection every 12 weeks [S3].\n\n"
            + "\n---\n".join(blocks)
            + "\n\n=== Answer ===\n<think>\n\n</think>\n\n"
        )

    @staticmethod
    def _parse_batch_answer(
        answer: str,
        expected_count: int,
    ) -> List[Tuple[str, str]]:
        answer = answer.strip()

        # Strip any leading thinking block if present.
        if answer.startswith("<think"):
            think_end = answer.find(">")
            if think_end != -1:
                think_close = answer.find("</think>", think_end)
                if think_close != -1:
                    answer = answer[think_close + len("</think>"):].strip()
                else:
                    answer = answer[think_end + 1:].strip()

        # Strip "=== Answer ===" prefix if the model echoed it.
        answer = re.sub(r"^=+\s*Answer\s*=+\s*\n", "", answer, flags=re.IGNORECASE)

        # Try splitting by '---' separators first.
        parts = re.split(r"\n-+\s*\n", answer)

        # If that didn't yield the right number of parts, try splitting on "Section N:" headers.
        if len(parts) != expected_count:
            section_splits = re.split(r"\n(?=Section\s*\d+\s*:)", answer, flags=re.IGNORECASE)
            if len(section_splits) == expected_count:
                parts = section_splits
            elif len(section_splits) > 1:
                parts = section_splits

        # If still wrong count, try splitting on blank lines.
        if len(parts) != expected_count:
            parts = re.split(r"\n\s*\n", answer)

        results: List[Tuple[str, str]] = []

        if len(parts) == expected_count:
            for part in parts:
                drug1, drug2 = ComparisonService._split_answer(part)
                if not drug1.strip():
                    drug1 = "Not available in source document."
                if not drug2.strip():
                    drug2 = "Not available in source document."
                results.append((drug1, drug2))
        else:
            # Step 3: Granular regex extract for each Section {i}
            for i in range(1, expected_count + 1):
                pattern = rf"(?i)Section\s*{i}\b(.*?)(?=\n\s*Section\s*{i+1}\b|\s+Section\s*{i+1}\b|$)"
                match = re.search(pattern, answer, re.DOTALL)
                if match:
                    drug1, drug2 = ComparisonService._split_answer(match.group(1))
                else:
                    drug1, drug2 = "", ""

                if not drug1.strip():
                    drug1 = "Not available in source document."
                if not drug2.strip():
                    drug2 = "Not available in source document."
                results.append((drug1, drug2))

        # Pad if we somehow have fewer blocks than expected (should not happen, but safe to keep)
        while len(results) < expected_count:
            results.append(("Not available in source document.", "Not available in source document."))

        return results

    @staticmethod
    def _split_answer(answer: str) -> Tuple[str, str]:
        # Strip Qwen control tokens if present.
        answer = re.sub(r"<think(?:ing)?>.*?</think(?:ing)?>", "", answer, flags=re.DOTALL | re.IGNORECASE)
        if " thinking" in answer.lower():
            answer = answer.split(" thinking")[-1].strip()

        # Strip leading "Section N:" header if present.
        answer = re.sub(r"^Section\s*\d+\s*:\s*[^\n]*\n", "", answer, flags=re.IGNORECASE)

        answer = answer.strip()

        drug1_match = re.search(
            r"DRUG1:\s*(.*?)(?=DRUG2:|$)",
            answer,
            re.DOTALL | re.IGNORECASE,
        )
        drug2_match = re.search(
            r"DRUG2:\s*(.*?)(?=DRUG1:|$)",
            answer,
            re.DOTALL | re.IGNORECASE,
        )

        drug1 = drug1_match.group(1).strip() if drug1_match else ""
        drug2 = drug2_match.group(1).strip() if drug2_match else ""

        if not drug1 and not drug2:
            drug1_match = re.search(
                r"Drug\s*1:\s*(.*?)(?=Drug\s*2:|$)",
                answer,
                re.DOTALL | re.IGNORECASE,
            )
            drug2_match = re.search(
                r"Drug\s*2:\s*(.*?)(?=Drug\s*1:|$)",
                answer,
                re.DOTALL | re.IGNORECASE,
            )
            drug1 = drug1_match.group(1).strip() if drug1_match else ""
            drug2 = drug2_match.group(1).strip() if drug2_match else ""

        # Fallback: if still empty, try line-based splitting (first non-empty line = drug1, second = drug2)
        if not drug1 and not drug2:
            lines = [l.strip() for l in answer.split("\n") if l.strip()]
            # Skip any "Section N:" header lines
            content_lines = [l for l in lines if not re.match(r"^Section\s*\d+", l, re.IGNORECASE)]
            if len(content_lines) >= 2:
                drug1 = content_lines[0]
                drug2 = content_lines[1]
            elif len(content_lines) == 1:
                drug1 = content_lines[0]

        # Clean any remaining placeholder artifacts
        def clean_placeholder(t: str) -> str:
            t = re.sub(r"^<[^>]+sentence[^>]*>\s*", "", t, flags=re.IGNORECASE)
            t = re.sub(r"^\[summary of drug \d+ with citations\]\s*", "", t, flags=re.IGNORECASE)
            return t.strip()

        return clean_placeholder(drug1), clean_placeholder(drug2)

    def _build_cell(
        self,
        text: str,
        citation_map: Dict[str, Dict[str, Any]],
        key: str,
    ) -> ComparisonCell:
        if "not available in source document" in text.lower():
            return ComparisonCell(
                content="Not available in source document.",
                citations=[],
                status="unavailable",
            )

        cleaned, citations, invalid = self.citation_mapper.extract_citations(
            text,
            citation_map,
        )

        if not cleaned:
            return ComparisonCell(
                content="Not available in source document.",
                citations=[],
                status="unavailable",
            )

        if invalid:
            logger.warning("Invalid citation markers in comparison answer: %s", invalid)

        comp_citations = [
            ComparisonCitation(
                citation_id=str(cit.get("chunk_id") or cit.get("citation_id", "")),
                document_id=cit.get("document_id"),
                document_name=cit.get("document_name"),
                page=cit.get("page_no") or 0,
                section=cit.get("section_title") or cit.get("section"),
                text=cit.get("text") or cit.get("chunk_text"),
                score=cit.get("score"),
            )
            for cit in citations
        ]

        status = "warning" if key in WARNING_KEYS else ("highlight" if key in HIGHLIGHT_KEYS else "normal")

        return ComparisonCell(
            content=cleaned,
            citations=comp_citations,
            status=status,
        )
