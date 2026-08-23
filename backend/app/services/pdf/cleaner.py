import logging
import re

logger = logging.getLogger(__name__)

# Control characters we never want to keep, except \n and \t (handled separately).
_CONTROL_NOISE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\uFFFD]")

# Horizontal whitespace run: spaces and tabs only, NOT newlines.
_HSPACE_RUN = re.compile(r"[ \t]+")

# Three or more consecutive line breaks collapse to a double line break.
_MULTIPLE_BREAKS = re.compile(r"\n{3,}")

# Medical-safe stop words that filter grammatical filler without losing clinical details.
MEDICAL_SAFE_STOP_WORDS = {
    "a", "an", "the", "and", "but", "or", "of", "at", "by", "for", "with", 
    "about", "to", "from", "in", "on", "that", "this", "these", "those", 
    "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
    "having", "do", "does", "did", "doing", "i", "me", "my", "myself", 
    "we", "our", "ours", "ourselves", "you", "your", "yours", "yourself", "yourselves",
    "he", "him", "his", "himself", "she", "her", "hers", "herself", "it", "its", "itself",
    "they", "them", "their", "theirs", "themselves", "am"
}


def clean_text(text: str) -> str:
    """Clean text by:
    1. Converting to lowercase.
    2. Removing control/replacement noise.
    3. Filtering emojis and unwanted decorative symbols.
    4. Removing medical-safe stop words.
    5. Normalizing spacing and line breaks.
    """
    if not text:
        return ""

    # 1. Convert to lowercase
    text = text.lower()

    # 2. Normalize line endings to \n.
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    # 3. Remove control / replacement noise.
    text = _CONTROL_NOISE.sub("", text)

    # 4. Remove emojis and decorative symbols.
    # Keep alphanumeric characters, whitespace, standard punctuation, and medical units/symbols (degree, micro, greek letters).
    text = re.sub(r'[^\w\s.,;:!?%/\-_()\[\]+*=<>°µαβ]', '', text)

    # Collapse horizontal whitespace runs to a single space, and trim lines.
    text = _HSPACE_RUN.sub(" ", text)
    text = "\n".join(line.strip() for line in text.split("\n"))

    # 5. Stop word removal
    lines = text.split("\n")
    cleaned_lines = []
    for line in lines:
        words = line.split(" ")
        cleaned_words = []
        for word in words:
            if not word:
                continue
            # Normalize word to check against stop words list
            norm_word = re.sub(r'[^a-z0-9]', '', word)
            if norm_word in MEDICAL_SAFE_STOP_WORDS:
                continue
            cleaned_words.append(word)
        cleaned_lines.append(" ".join(cleaned_words))
    text = "\n".join(cleaned_lines)

    # 6. Collapse 3+ consecutive blank lines to a double blank line.
    text = _MULTIPLE_BREAKS.sub("\n\n", text)

    return text.strip()
