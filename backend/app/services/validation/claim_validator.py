import re
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

FREQUENCY_GROUPS = {
    "once daily": ["once daily", "1x daily", "qd", "once-daily", "daily", "once a day", "15 mg once daily"],
    "twice daily": ["twice daily", "2x daily", "bid", "twice-daily", "twice a day"],
    "three times daily": ["three times daily", "3x daily", "tid", "three times a day"],
    "four times daily": ["four times daily", "4x daily", "qid", "four times a day"],
    "weekly": ["weekly", "once weekly", "once-weekly", "once a week"],
}

CONTRAINDICATION_SYNONYMS = [
    "contraindicated", "must not", "do not use", "avoid", "should not", 
    "not recommended", "warnings", "precaution", "risk", "harmful", "unsafe",
    "serious risk", "boxed warning", "adverse", "contraindication"
]

class ClaimValidator:
    """
    Performs strict checks on high-risk medical values (dosages, strengths, frequencies,
    and key warnings) in the generated answer against the retrieved evidence text.
    """

    def __init__(self):
        # Match digits followed by units like mg, mcg, g, ml, mL, %
        self.dosage_pattern = re.compile(
            r'\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|mL|%)\b',
            re.IGNORECASE
        )
        
        # Match common frequency indicators
        self.frequency_patterns = [
            r'\bonce\s+daily\b',
            r'\btwice\s+daily\b',
            r'\bweekly\b',
            r'\bevery\s+\d+\s+weeks\b',
            r'\bQD\b',
            r'\bBID\b',
            r'\bTID\b',
            r'\bQID\b',
            r'\bthree\s+times\s+daily\b'
        ]
        self.frequency_regex = re.compile(
            "|".join(self.frequency_patterns),
            re.IGNORECASE
        )

    def extract_dosages(self, text: str) -> List[str]:
        """Extracts dosages like '15 mg' or '150 mg' from text, normalizing whitespace and casing."""
        matches = self.dosage_pattern.findall(text)
        # Normalize: '15  mg' -> '15 mg', 'ML' -> 'ml'
        normalized = []
        for m in matches:
            norm = re.sub(r'\s+', ' ', m.strip().lower())
            normalized.append(norm)
        return list(set(normalized))

    def extract_frequencies(self, text: str) -> List[str]:
        """Extracts dosing frequencies from text."""
        matches = self.frequency_regex.findall(text)
        return list(set([m.strip().lower() for m in matches]))

    def validate_claims(
        self,
        draft_answer: str,
        evidence_chunks: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Validates high-risk claims (dosages, frequencies) in draft_answer against retrieved evidence.
        Returns a list of failed checks and a valid boolean.
        """
        if not draft_answer or draft_answer.startswith("I couldn't find"):
            return {
                "valid": True,
                "failed_checks": []
            }

        # Combine all evidence text
        evidence_texts = [c.get("text", c.get("chunk_text", "")) for c in evidence_chunks]
        combined_evidence = " ".join(evidence_texts)

        # 1. Dosage Validation
        answer_dosages = self.extract_dosages(draft_answer)
        evidence_dosages = self.extract_dosages(combined_evidence)
        
        failed_checks = []

        for dosage in answer_dosages:
            # Verify if dosage is present in the evidence
            # We check both verbatim and without unit space (e.g. '15mg' vs '15 mg')
            val, unit = re.findall(r'(\d+(?:\.\d+)?)\s*(.*)', dosage)[0]
            alternative = f"{val}{unit}"
            alternative_space = f"{val} {unit}"
            
            if alternative not in combined_evidence.lower() and alternative_space not in combined_evidence.lower():
                failed_checks.append({
                    "type": "unsupported_dosage",
                    "value": dosage,
                    "detail": f"Dosage '{dosage}' mentioned in the answer is not present in the retrieved evidence."
                })

        # 2. Frequency Validation
        answer_frequencies = self.extract_frequencies(draft_answer)
        for freq in answer_frequencies:
            # Find matching group
            matched_group = [freq]
            for g_key, g_vals in FREQUENCY_GROUPS.items():
                if freq in g_vals:
                    matched_group = g_vals
                    break
            
            # Check if any synonym in the group is in evidence
            if not any(val in combined_evidence.lower() for val in matched_group):
                failed_checks.append({
                    "type": "unsupported_frequency",
                    "value": freq,
                    "detail": f"Dosing frequency '{freq}' mentioned in the answer is not present in the retrieved evidence."
                })

        # 3. Severe Negative Contraindications Warnings check (basic sanity check)
        contra_keywords = ["contraindicated", "must not", "do not use", "avoid"]
        for kw in contra_keywords:
            if kw in draft_answer.lower():
                # Check if any contraindication synonym/keyword exists in the evidence
                if not any(syn in combined_evidence.lower() for syn in CONTRAINDICATION_SYNONYMS):
                    failed_checks.append({
                        "type": "fabricated_contraindication",
                        "value": kw,
                        "detail": f"Safety constraint keyword '{kw}' appears in the answer but is not found in the evidence."
                    })

        valid = len(failed_checks) == 0

        return {
            "valid": valid,
            "failed_checks": failed_checks
        }

# Singleton instance
claim_validator = ClaimValidator()
