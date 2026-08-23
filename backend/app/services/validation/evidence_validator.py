import re
import json
import logging
from typing import List, Dict, Any, Tuple
from app.dependencies.llm import get_llm_client

logger = logging.getLogger(__name__)

class EvidenceValidator:
    """
    Validates whether the generated answer claims are supported by retrieved document evidence.
    Splits the draft answer into sentences and uses the local LLM to verify support,
    falling back to a robust keyword-based string comparison if the LLM call fails.
    """

    def __init__(self):
        self._llm_client = None

    @property
    def llm_client(self):
        if self._llm_client is None:
            self._llm_client = get_llm_client()
        return self._llm_client

    def split_into_sentences(self, text: str) -> List[str]:
        """Splits draft answer text into sentences based on punctuation boundaries."""
        if not text:
            return []
        # Split by periods, question marks, and exclamation marks followed by spaces or end of string
        sentences = re.split(r'(?<=[.!?])\s+', text.strip())
        return [s.strip() for s in sentences if len(s.strip()) > 3]

    def _fallback_validation(self, claims: List[str], evidence_text: str) -> List[Dict[str, Any]]:
        """Fallback check that checks keyword overlaps if LLM is unavailable."""
        results = []
        evidence_lower = evidence_text.lower()
        for idx, claim in enumerate(claims):
            # Normalize claim words and check simple overlapping
            claim_words = [w for w in re.findall(r'\b\w+\b', claim.lower()) if len(w) > 3]
            if not claim_words:
                results.append({
                    "index": idx,
                    "claim": claim,
                    "supported": True,
                    "reason": "Claim is empty or non-substantial."
                })
                continue

            # Check if majority of important terms exist in evidence
            matches = sum(1 for word in claim_words if word in evidence_lower)
            match_ratio = matches / len(claim_words) if claim_words else 0
            
            # Simple threshold (e.g. 50% overlap for safety fallback)
            supported = match_ratio >= 0.50
            results.append({
                "index": idx,
                "claim": claim,
                "supported": supported,
                "reason": f"Fallback heuristic: {int(match_ratio * 100)}% terms matched."
            })
        return results

    def validate_evidence(
        self,
        draft_answer: str,
        evidence_chunks: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Parses draft answer and verifies sentence-by-sentence support against evidence.
        Returns validation details and a grounded boolean.
        """
        if not draft_answer or draft_answer.startswith("I couldn't find"):
            return {
                "grounded": True,
                "claims": [],
                "unsupported_count": 0
            }

        claims = self.split_into_sentences(draft_answer)
        if not claims:
            return {
                "grounded": True,
                "claims": [],
                "unsupported_count": 0
            }

        # Build evidence context block
        evidence_context = ""
        for i, chunk in enumerate(evidence_chunks):
            doc_name = chunk.get("document_name", "Unknown Document")
            page = chunk.get("page_no", "?")
            sec = chunk.get("section", "General")
            text = chunk.get("text", chunk.get("chunk_text", ""))
            evidence_context += f"Evidence [{i}]: {doc_name} (Page {page}, Section {sec}): {text}\n\n"

        # Construct batch evaluation prompt for LLM
        numbered_claims = "\n".join(f"{idx}. {claim}" for idx, claim in enumerate(claims))
        
        prompt = (
            "System: You are an expert medical information auditor. Your job is to verify if claims are directly supported by clinical evidence.\n"
            "Analyze each numbered claim below against the provided clinical evidence.\n"
            "For each claim, output whether it is supported (true/false) and a brief reason.\n"
            "Important: A claim is supported if it is semantically equivalent, paraphrased, or logically implied by the evidence. Do not require exact word matches. However, clinical values like dosages, frequencies, and specific safety hazards must be accurate.\n"
            "Format your output ONLY as a valid JSON list of objects.\n\n"
            "Example JSON Output Format:\n"
            "[\n"
            "  {\"index\": 0, \"claim\": \"Claim text\", \"supported\": true, \"reason\": \"Directly supported by paragraph 1\"},\n"
            "  {\"index\": 1, \"claim\": \"Another claim\", \"supported\": false, \"reason\": \"No mention of this dose in the evidence\"}\n"
            "]\n\n"
            f"Clinical Evidence:\n{evidence_context}\n"
            f"Claims to check:\n{numbered_claims}\n"
            "JSON Output:\n"
            "<think>\n\n</think>\n"
        )

        try:
            llm_response = self.llm_client(prompt, max_tokens=1024, temperature=0.0)
            
            # Extract response text
            if isinstance(llm_response, dict):
                response_text = llm_response["choices"][0]["text"].strip()
            else:
                response_text = str(llm_response).strip()

            if "</think>" in response_text:
                response_text = response_text.split("</think>")[-1].strip()

            # Attempt JSON parse
            # Find the starting [ and ending ] in case of conversational wrapper
            start_idx = response_text.find('[')
            end_idx = response_text.rfind(']') + 1
            if start_idx != -1 and end_idx > start_idx:
                json_str = response_text[start_idx:end_idx]
                results = json.loads(json_str)
            else:
                raise ValueError("JSON block not found in LLM response.")

            # Map the parsed JSON back to claim models
            claims_evaluation = []
            unsupported_count = 0
            for item in results:
                idx = item.get("index")
                claim_text = item.get("claim", claims[idx] if idx < len(claims) else "")
                supported = item.get("supported", False)
                reason = item.get("reason", "")
                
                claims_evaluation.append({
                    "index": idx,
                    "claim": claim_text,
                    "supported": supported,
                    "reason": reason
                })
                if not supported:
                    unsupported_count += 1

        except Exception as e:
            logger.warning(f"LLM evidence validation failed: {e}. Running fallback validator.")
            # Run fallback
            all_evidence_text = " ".join([c.get("text", c.get("chunk_text", "")) for c in evidence_chunks])
            claims_evaluation = self._fallback_validation(claims, all_evidence_text)
            unsupported_count = sum(1 for c in claims_evaluation if not c["supported"])

        # Decide overall groundedness (e.g. if any claim is unsupported, we mark grounded=False)
        grounded = unsupported_count == 0

        return {
            "grounded": grounded,
            "claims": claims_evaluation,
            "unsupported_count": unsupported_count
        }

# Singleton instance
evidence_validator = EvidenceValidator()
