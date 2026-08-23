import logging
import time
from typing import Any, Dict, List, Optional

from app.core.config import settings
from app.core.task_manager import task_manager, TaskCancelledError
from app.services.chat.citation_mapper import CitationMapper
from app.services.chat.evidence_context_builder import EvidenceContextBuilder
from app.services.llm.llm_service import LLMService
from app.services.llm.prompt_builder import PromptBuilder
from app.services.retrieval.semantic_search_service import SemanticSearchService
from app.services.validation.grounding_validator import GroundingValidator

logger = logging.getLogger(__name__)


class RAGService:
    """
    End-to-end retrieval-augmented generation orchestrator for drug-label Q&A.
    """

    def __init__(
        self,
        search_service=None,
        context_builder=None,
        prompt_builder=None,
        llm_service=None,
        citation_mapper=None,
        grounding_validator=None,
    ):
        self.search_service = search_service or SemanticSearchService()
        self.context_builder = context_builder or EvidenceContextBuilder()
        self.prompt_builder = prompt_builder or PromptBuilder()
        self.llm_service = llm_service or LLMService()
        self.citation_mapper = citation_mapper or CitationMapper()
        self.grounding_validator = grounding_validator or GroundingValidator()

    async def ask(
        self,
        question: str,
        document_ids: Optional[List[str]] = None,
        top_k: Optional[int] = None,
        section: Optional[str] = None,
        version: Optional[str] = None,
        score_threshold: Optional[float] = None,
        memories: Optional[List[Dict[str, Any]]] = None,
        task_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        await task_manager.raise_if_cancelled(task_id)
        """
        Orchestrate retrieval, context preparation, prompting, generation,
        citation mapping, and grounding validation.
        """
        if not question or not question.strip():
            raise ValueError("Question cannot be empty.")

        start = time.perf_counter()
        top_k = top_k or settings.TOP_K
        if score_threshold is None:
            score_threshold = settings.MIN_RELEVANCE_SCORE

        # 1. Retrieve relevant evidence.
        results = await self.search_service.search(
            query=question,
            top_k=top_k,
            document_ids=document_ids,
            section=section,
            version=version,
            score_threshold=score_threshold,
        )
        retrieval_latency = time.perf_counter() - start

        if not results:
            return self._no_evidence_response(question, retrieval_latency)

        # 2. Build a citation-tagged evidence context.
        # Include user memory records as citable sources alongside document evidence.
        all_results = results
        if memories:
            all_results = all_results + memories
        evidence_context, citation_map = self.context_builder.build(all_results)

        # 3. Build a grounded, injection-resistant prompt.
        prompt = self.prompt_builder.build(question, evidence_context)

        # 4. Generate an answer with Qwen.
        await task_manager.raise_if_cancelled(task_id)
        gen_start = time.perf_counter()
        try:
            llm_res = await self.llm_service.generate_async(prompt, task_id=task_id)
            if isinstance(llm_res, dict):
                answer = llm_res.get("text", "")
                thinking = llm_res.get("thinking", "")
            else:
                answer = str(llm_res)
                thinking = ""
            await task_manager.raise_if_cancelled(task_id)
        except TaskCancelledError:
            raise
        except Exception as exc:
            logger.error("LLM generation failed: %s", exc)
            return {
                "query": question,
                "answer": "I don't know based on the provided documents.",
                "thinking": "",
                "citations": [],
                "grounded": False,
                "sources_used": 0,
                "retrieval_latency_ms": retrieval_latency * 1000,
                "generation_latency_ms": 0,
                "total_latency_ms": (time.perf_counter() - start) * 1000,
                "error": str(exc),
            }
        generation_latency = time.perf_counter() - gen_start

        # 5. Map and validate citations.
        answer, citations, invalid = self.citation_mapper.extract_citations(answer, citation_map)

        # Identify which user memory sources the model actually cited.
        memory_texts_used = [
            c.get("text")
            for c in citations
            if c.get("document_id") == "USER_MEMORY" and c.get("text")
        ]

        validation = self.grounding_validator.validate(answer, citations, len(all_results))
        grounded = validation["grounded"]

        total_latency = time.perf_counter() - start

        logger.info(
            "RAG: query='%s...' results=%d citations=%d grounded=%s total_ms=%.1f",
            question[:40],
            len(citations),
            grounded,
            total_latency * 1000,
        )

        return {
            "query": question,
            "answer": answer,
            "thinking": thinking,
            "citations": citations,
            "grounded": grounded,
            "sources_used": len(citations),
            "retrieval_latency_ms": retrieval_latency * 1000,
            "generation_latency_ms": generation_latency * 1000,
            "total_latency_ms": total_latency * 1000,
            "memories_used": memory_texts_used,
        }

    async def answer_with_evidence(
        self,
        question: str,
        evidence: List[Dict[str, Any]],
        memories: Optional[List[Dict[str, Any]]] = None,
        task_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        await task_manager.raise_if_cancelled(task_id)
        """
        Generate an answer from already-retrieved evidence.
        Useful when the retrieval is performed by another route or service.
        """
        if not evidence:
            return self._no_evidence_response(question)

        start = time.perf_counter()

        all_evidence = evidence
        if memories:
            all_evidence = all_evidence + memories
        evidence_context, citation_map = self.context_builder.build(all_evidence)
        prompt = self.prompt_builder.build(question, evidence_context)

        await task_manager.raise_if_cancelled(task_id)
        gen_start = time.perf_counter()
        try:
            llm_res = await self.llm_service.generate_async(prompt, task_id=task_id)
            if isinstance(llm_res, dict):
                answer = llm_res.get("text", "")
                thinking = llm_res.get("thinking", "")
            else:
                answer = str(llm_res)
                thinking = ""
            await task_manager.raise_if_cancelled(task_id)
        except TaskCancelledError:
            raise
        except Exception as exc:
            logger.error("LLM generation failed: %s", exc)
            return {
                "query": question,
                "answer": "I don't know based on the provided documents.",
                "thinking": "",
                "citations": [],
                "grounded": False,
                "sources_used": 0,
                "generation_latency_ms": 0,
                "total_latency_ms": (time.perf_counter() - start) * 1000,
                "error": str(exc),
            }
        generation_latency = time.perf_counter() - gen_start
        logger.info("RAG raw LLM answer (first 500 chars): %s", repr(answer[:500]) if answer else "<EMPTY>")

        answer, citations, invalid = self.citation_mapper.extract_citations(answer, citation_map)
        logger.info("RAG post-citation answer (first 500 chars): %s", repr(answer[:500]) if answer else "<EMPTY>")

        if invalid:
            logger.warning("Model produced invalid citation markers: %s", invalid)

        # Identify which user memory sources the model actually cited.
        memory_texts_used = [
            c.get("text")
            for c in citations
            if c.get("document_id") == "USER_MEMORY" and c.get("text")
        ]

        validation = self.grounding_validator.validate(answer, citations, len(all_evidence))
        grounded = validation["grounded"]

        total_latency = time.perf_counter() - start

        return {
            "query": question,
            "answer": answer,
            "thinking": thinking,
            "citations": citations,
            "grounded": grounded,
            "sources_used": len(citations),
            "generation_latency_ms": generation_latency * 1000,
            "total_latency_ms": total_latency * 1000,
            "memories_used": memory_texts_used,
        }

    @staticmethod
    def _no_evidence_response(question: str, retrieval_latency: float = 0.0) -> Dict[str, Any]:
        return {
            "query": question,
            "answer": "I don't know based on the provided documents.",
            "citations": [],
            "grounded": False,
            "sources_used": 0,
            "retrieval_latency_ms": retrieval_latency * 1000,
            "generation_latency_ms": 0,
            "total_latency_ms": retrieval_latency * 1000,
        }
