import logging
import re
from typing import Any, Dict, List, Tuple

logger = logging.getLogger(__name__)

CITATION_PATTERN = re.compile(r"\[([A-Z]\d+)\]")


class CitationMapper:
    """Maps [S1], [S2] markers in the model output to backend citation metadata."""

    def extract_citations(
        self,
        answer: str,
        citation_map: Dict[str, Dict[str, Any]],
    ) -> Tuple[str, List[Dict[str, Any]], List[str]]:
        """
        Returns:
          - cleaned_answer: answer with invalid markers stripped.
          - valid_citations: list of citation metadata dicts.
          - invalid: list of citation ids the model made up.
        """
        raw_ids = CITATION_PATTERN.findall(answer)
        found = []
        seen = set()
        for cid in raw_ids:
            if cid not in seen:
                seen.add(cid)
                found.append(cid)

        valid_citations = []
        invalid = []

        for cid in found:
            if cid in citation_map:
                meta = citation_map[cid]
                valid_citations.append({
                    "citation_id": cid,
                    "chunk_id": meta.get("chunk_id"),
                    "document_id": meta.get("document_id"),
                    "document_name": meta.get("document_name"),
                    "page_no": meta.get("page_no"),
                    "section_title": meta.get("section_title") or meta.get("section"),
                    "version": meta.get("version"),
                    "score": meta.get("score"),
                    "text": meta.get("text") or meta.get("chunk_text"),
                })
            else:
                invalid.append(cid)
                # Strip the bogus marker and surrounding whitespace.
                answer = re.sub(rf"\s*\[{re.escape(cid)}\]\s*", " ", answer)

        # Remove stray spaces before punctuation and collapse consecutive horizontal spaces without destroying newlines.
        answer = re.sub(r"[ \t]+([.,;:!?])", r"\1", answer)
        answer = re.sub(r"[ \t]+", " ", answer)
        answer = re.sub(r"\n{3,}", "\n\n", answer).strip()

        if invalid:
            logger.warning("Model produced invalid citation markers: %s", invalid)

        return answer, valid_citations, invalid
