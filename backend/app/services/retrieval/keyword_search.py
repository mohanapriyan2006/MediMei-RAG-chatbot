import re
from typing import List, Dict, Any, Optional
from app.repositories.qdrant_repository import qdrant_repository
from qdrant_client.models import Filter, FieldCondition, MatchText, MatchAny

# Common English stop words to exclude from local TF-IDF-like keyword matching
STOP_WORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "arent",
    "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by",
    "can", "cant", "cannot", "could", "couldnt", "did", "didnt", "do", "does", "doesnt", "doing", "dont",
    "down", "during", "each", "few", "for", "from", "further", "had", "hadnt", "has", "hasnt", "have",
    "havent", "having", "he", "hed", "hell", "hes", "her", "here", "heres", "hers", "herself", "him",
    "himself", "his", "how", "hows", "i", "id", "ill", "im", "ive", "if", "in", "into", "is", "isnt",
    "it", "its", "itself", "lets", "me", "more", "most", "mustnt", "my", "myself", "no", "nor", "not",
    "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over",
    "own", "same", "shant", "she", "shed", "shell", "shes", "should", "shouldnt", "so", "some", "such",
    "than", "that", "thats", "the", "their", "theirs", "them", "themselves", "then", "there", "theres",
    "these", "they", "theyd", "theyll", "theyre", "theyve", "this", "those", "through", "to", "too",
    "under", "until", "up", "very", "was", "wasnt", "we", "wed", "well", "were", "weve", "werent",
    "what", "whats", "when", "whens", "where", "wheres", "which", "while", "who", "whos", "whom", "why",
    "whys", "with", "wont", "would", "wouldnt", "you", "youd", "youll", "youre", "youve", "your", "yours",
    "yourself", "yourselves"
}

def clean_query_tokens(query: str) -> List[str]:
    """Clean query into individual lowercase alphanumeric tokens, filtering stop words."""
    words = re.findall(r"\b\w{2,}\b", query.lower())
    return [w for w in words if w not in STOP_WORDS]


async def keyword_search(
    query: str,
    document_ids: List[str],
    limit: int = 5
) -> List[Dict[str, Any]]:
    """
    Perform keyword-based full-text matching search on chunk texts using Qdrant text filtering.
    """
    # 1. Clean query to obtain search keywords
    query_terms = clean_query_tokens(query)
    if not query_terms:
        # Fallback to simple split if re.findall returns empty
        query_terms = [w.lower() for w in query.split() if w.lower() not in STOP_WORDS]
        if not query_terms:
            return []

    # 2. Build scroll filter with a MatchText condition (exact/stemmed matches via Qdrant's payload index)
    must_conditions = [
        FieldCondition(
            key="chunk_text",
            match=MatchText(text=query)
        )
    ]

    if document_ids:
        must_conditions.append(
            FieldCondition(
                key="document_id",
                match=MatchAny(any=document_ids)
            )
        )

    # 3. Retrieve matching candidate points asynchronously
    client = qdrant_repository.client
    scroll_result = await client.scroll(
        collection_name=qdrant_repository.collection_name,
        scroll_filter=Filter(must=must_conditions),
        limit=limit * 3,  # Fetch extra candidates to rank them in Python
        with_payload=True,
        with_vectors=False
    )
    points, _ = scroll_result

    # 4. Score matches in Python based on query term frequency and overlap
    results = []
    for point in points:
        text = (point.payload.get("text") or point.payload.get("chunk_text") or "").lower()
        
        # Calculate matching frequency score
        matches = sum(1 for term in query_terms if term in text)
        score = matches / len(query_terms) if query_terms else 0.0

        results.append({
            "chunk_id": point.payload.get("chunk_id", str(point.id)),
            "document_id": point.payload.get("document_id"),
            "document_name": point.payload.get("document_name"),
            "page_no": point.payload.get("page_no"),
            "section": point.payload.get("section"),
            "text": point.payload.get("text") or point.payload.get("chunk_text"),
            "score": score,
            "quality_score": point.payload.get("quality_score", 1.0)
        })

    # Sort candidates by Python computed score descending
    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:limit]
