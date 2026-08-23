import logging
import json
from typing import List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db.database import get_db_session
from app.models.chat import ChatSession, ChatMessage
from app.models.citation import Citation as CitationModel
from app.models.document import Document
from app.schemas.chat import ChatRequest, ChatResponse, SessionResponse, MessageResponse, SessionCreate, SessionUpdate
from app.schemas.evidence import Citation
from app.services.chat.rag_service import RAGService
from app.core.task_manager import TaskCancelledError
from app.dependencies.embeddings import get_embedding_model
from app.dependencies.qdrant import get_qdrant_client
from app.repositories.qdrant_repository import qdrant_repository
from app.services.chat.memory_service import memory_service
from app.services.pdf.cleaner import clean_text

def get_rag_service() -> RAGService:
    return RAGService()

from app.dependencies.auth import get_current_user
from app.models.user import User

try:
    from app.config import settings
except ImportError:
    from app.core.config import settings


logger = logging.getLogger(__name__)

router = APIRouter(tags=["chat"])
sessions_router = APIRouter(tags=["sessions"])


async def mock_evidence_retrieval(
    query: str,
    document_ids: List[str] | None,
    db: AsyncSession
) -> List[Dict[str, Any]]:
    from app.models.chunk import Chunk

    retrieved = []

    # 1. Fetch active documents
    if document_ids and len(document_ids) > 0:
        doc_stmt = select(Document).filter(
            Document.document_id.in_(document_ids),
            Document.is_active == True
        )
    else:
        doc_stmt = select(Document).filter(Document.is_active == True)

    doc_res = await db.execute(doc_stmt)
    docs = doc_res.scalars().all()
    if not docs:
        return []

    doc_map = {doc.document_id: doc.file_name for doc in docs}
    target_ids = list(doc_map.keys())

    # 2. Fetch chunks from database
    chunk_stmt = select(Chunk).filter(Chunk.document_id.in_(target_ids))
    chunk_res = await db.execute(chunk_stmt)
    all_chunks = chunk_res.scalars().all()
    if not all_chunks:
        return []

    # 3. Simple keyword & summary ranking
    query_lower = query.lower()
    query_tokens = [w for w in query_lower.split() if len(w) > 2]
    is_summary = any(k in query_lower for k in ["summar", "overview", "about", "explain", "what is", "tell me"])

    scored_chunks = []
    for c in all_chunks:
        text = (c.chunk_text or "").lower()
        sec = (c.section or "").lower()
        score = 0.0

        matches = sum(1 for tok in query_tokens if tok in text or tok in sec)
        if query_tokens:
            score += (matches / len(query_tokens)) * 0.8

        if is_summary:
            if c.page_no in (1, 2, 3):
                score += 0.45
            if any(k in sec for k in ["indication", "description", "overview", "dosage", "summary", "warning"]):
                score += 0.35

        if score > 0.15 or is_summary:
            scored_chunks.append((max(score, 0.78 if is_summary else 0.5), c))

    scored_chunks.sort(key=lambda x: x[0], reverse=True)
    top_chunks = scored_chunks[:6]

    for sc, c in top_chunks:
        retrieved.append({
            "chunk_id": str(c.chunk_id),
            "document_id": c.document_id,
            "document_name": doc_map.get(c.document_id, "Official Reference Document"),
            "page_no": c.page_no or 1,
            "section": c.section or "Prescribing Information",
            "text": c.chunk_text or "",
            "score": round(sc, 3)
        })

    return retrieved


@router.post("", response_model=ChatResponse)
async def post_chat_message(
    request: ChatRequest,
    x_task_id: str = Header(default=""),
    db: AsyncSession = Depends(get_db_session),
    embedding_model: Any = Depends(get_embedding_model),
    qdrant_client: Any = Depends(get_qdrant_client),
    rag_service: RAGService = Depends(get_rag_service),
    current_user: User = Depends(get_current_user)
):

    try:
        return await _post_chat_message_impl(
            request, x_task_id, db, embedding_model, qdrant_client, rag_service, current_user
        )
    except TaskCancelledError:
        raise HTTPException(
            status_code=499,
            detail="Chat cancelled by user."
        )


async def _post_chat_message_impl(
    request: ChatRequest,
    x_task_id: str,
    db: AsyncSession,
    embedding_model: Any,
    qdrant_client: Any,
    rag_service: RAGService,
    current_user: User,
):
    if request.message:
        request.message = request.message.strip().lower()
    logger.info("[CHAT] Step 0: message=%r, session_id=%s, document_ids=%s", request.message, request.session_id, request.document_ids)

    # ---------------------------------------------------------
    # 1. Get existing session
    # ---------------------------------------------------------

    if not request.session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="session_id is required."
        )

    try:
        session_id = int(request.session_id)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="session_id must be a valid number."
        )

    result = await db.execute(
        select(ChatSession).filter(
            ChatSession.session_id == session_id
        )
    )

    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found."
        )

    # ---------------------------------------------------------
    # 1.5. Fetch Memories (if enabled) & Check for Match
    # ---------------------------------------------------------
    memories_str = ""
    memory_records = []
    matched_citations = []
    memories_used = []
    if current_user.memory_enabled:
        try:
            await memory_service.ensure_default_memory(current_user.user_id, db)
        except Exception:
            pass
        memories_str = await memory_service.get_memories_as_string(current_user.user_id, db)
        memory_records = await memory_service.get_memories_as_records(current_user.user_id, db)
        memories_used = [m["text"] for m in memory_records if isinstance(m, dict) and "text" in m]
        if not memories_used and memories_str:
            memories_used = [line[2:].strip() for line in memories_str.split("\n") if line.startswith("- ")]

        # Check if user message has a stored memory match (Q&A memory)
        matched_answer = None
        matched_memory_content = None

        # A. Case-insensitive exact match
        query_clean = request.message.strip().lower()
        for m_content in memories_used:
            if m_content.startswith("Q: ") and " | A: " in m_content:
                parts = m_content.split(" | A: ", 1)
                stored_q = parts[0][3:].strip()
                rest = parts[1].strip()
                
                # Split off Citations if present
                stored_a = rest
                citations_json = None
                if " | Citations: " in rest:
                    a_parts = rest.split(" | Citations: ", 1)
                    stored_a = a_parts[0].strip()
                    citations_json = a_parts[1].strip()

                if stored_q.lower() == query_clean:
                    matched_answer = stored_a
                    matched_memory_content = m_content
                    if citations_json:
                        try:
                            matched_citations = json.loads(citations_json)
                        except Exception:
                            matched_citations = []
                    break

        # B. Semantic match (cosine similarity using embedding model)
        if not matched_answer and memories_used:
            stored_pairs = []
            for m_content in memories_used:
                if m_content.startswith("Q: ") and " | A: " in m_content:
                    parts = m_content.split(" | A: ", 1)
                    stored_q = parts[0][3:].strip()
                    rest = parts[1].strip()
                    
                    stored_a = rest
                    citations_json = None
                    if " | Citations: " in rest:
                        a_parts = rest.split(" | Citations: ", 1)
                        stored_a = a_parts[0].strip()
                        citations_json = a_parts[1].strip()
                        
                    stored_pairs.append((stored_q, stored_a, m_content, citations_json))

            if stored_pairs:
                try:
                    import numpy as np
                    # Encode current query
                    raw_vec = embedding_model.encode(request.message, normalize_embeddings=True)
                    query_vector = np.array(raw_vec.tolist() if hasattr(raw_vec, "tolist") else list(raw_vec))

                    # Encode all stored queries
                    stored_qs = [pair[0] for pair in stored_pairs]
                    stored_vecs = embedding_model.encode(stored_qs, normalize_embeddings=True)

                    best_score = -1.0
                    best_index = -1

                    for idx, raw_stored_vec in enumerate(stored_vecs):
                        stored_vector = np.array(raw_stored_vec.tolist() if hasattr(raw_stored_vec, "tolist") else list(raw_stored_vec))

                        # Cosine similarity
                        dot_product = np.dot(query_vector, stored_vector)
                        norm_q = np.linalg.norm(query_vector)
                        norm_s = np.linalg.norm(stored_vector)
                        if norm_q > 0 and norm_s > 0:
                            score = float(dot_product / (norm_q * norm_s))
                            if score > best_score:
                                best_score = score
                                best_index = idx

                    # Threshold: 0.88
                    if best_index != -1 and best_score >= 0.88:
                        matched_answer = stored_pairs[best_index][1]
                        matched_memory_content = stored_pairs[best_index][2]
                        citations_json = stored_pairs[best_index][3]
                        if citations_json:
                            try:
                                matched_citations = json.loads(citations_json)
                            except Exception:
                                matched_citations = []
                        logger.info(f"Semantic memory match found (score: {best_score:.4f}) for question: '{request.message}'")
                except Exception as ex:
                    logger.warning(f"Failed semantic memory matching: {ex}")

        # If a match was found, return immediately
        if matched_answer is not None:
            logger.info("[CHAT] Step 1.5: Memory match found, returning cached answer (len=%d)", len(matched_answer))
            user_msg = ChatMessage(
                session_id=session_id,
                role="user",
                content=request.message
            )
            assistant_msg = ChatMessage(
                session_id=session_id,
                role="assistant",
                content=matched_answer,
                memories_used=json.dumps([matched_memory_content])
            )
            db.add(user_msg)
            db.add(assistant_msg)
            await db.flush()

            # Save parsed citations to database
            if matched_citations:
                doc_ids_to_check = {cit.get("document_id") for cit in matched_citations if cit.get("document_id")}
                valid_doc_ids = set()
                if doc_ids_to_check:
                    doc_stmt = select(Document.document_id).where(Document.document_id.in_(doc_ids_to_check))
                    doc_res = await db.execute(doc_stmt)
                    valid_doc_ids = set(doc_res.scalars().all())
                
                for idx, cit in enumerate(matched_citations):
                    doc_id = cit.get("document_id")
                    if not doc_id or doc_id not in valid_doc_ids:
                        continue
                    
                    unique_cit_id = f"{assistant_msg.message_id}_{cit.get('chunk_id') or idx}_{idx}"
                    db.add(
                        CitationModel(
                            citation_id=unique_cit_id,
                            message_id=assistant_msg.message_id,
                            document_id=doc_id,
                            document_name=cit.get("document_name") or "Unknown Document",
                            page_no=cit.get("page_no") or cit.get("page") or 1,
                            chunk_id=str(cit.get("chunk_id") or ""),
                            text=cit.get("text") or "",
                            score=cit.get("score"),
                            section=cit.get("section")
                        )
                    )

            await db.commit()
            await db.refresh(assistant_msg)

            # Map to response schema
            response_citations = [
                Citation(
                    citation_id=str(c.get("citation_id") or c.get("chunk_id") or ""),
                    chunk_id=str(c.get("chunk_id") or ""),
                    document_id=str(c.get("document_id") or ""),
                    document_name=str(c.get("document_name") or "Official Reference Document"),
                    page=int(c.get("page_no") or c.get("page") or 1),
                    section=c.get("section") or c.get("section_title"),
                    text=c.get("text") or "",
                    score=float(c.get("score")) if c.get("score") is not None else None
                )
                for c in matched_citations
            ]

            return ChatResponse(
                message_id=str(assistant_msg.message_id),
                session_id=str(session_id),
                answer=matched_answer,
                grounded=True,
                evidence_count=len(response_citations),
                citations=response_citations,
                memories_used=[matched_memory_content],
                memories_updated=None
            )

    # ---------------------------------------------------------
    # 1.6. Greeting / identity handler (memory-driven small talk)
    # ---------------------------------------------------------

    evidence_chunks = []

    try:
        # Use SemanticSearchService for retrieval — it applies CrossEncoder
        # reranking by default, retrieving top_k*3 candidates from Qdrant
        # then reranking to top_k.  This significantly improves relevance
        # for non-drug documents (e.g. novels, general text) where raw
        # cosine similarity alone often surfaces wrong chunks.
        search_results = await rag_service.search_service.search(
            query=request.message,
            document_ids=request.document_ids,
            score_threshold=settings.MIN_RELEVANCE_SCORE,
        )
        # Normalize field names: SemanticSearchService returns "section_title"
        # but the prompt builder and citation code below expect "section".
        for r in search_results:
            if "section" not in r:
                r["section"] = r.get("section_title") or "Unknown"
        evidence_chunks = search_results

    except Exception as e:
        logger.warning(
            f"Semantic search failed: {e}. "
            "Using database retrieval fallback."
        )
        evidence_chunks = await mock_evidence_retrieval(
            request.message,
            request.document_ids,
            db
        )

    logger.info("[CHAT] Step 2: Qdrant returned %d evidence chunks", len(evidence_chunks))
    if not evidence_chunks:
        logger.info("[CHAT] Step 2: No Qdrant results, using DB fallback")
        evidence_chunks = await mock_evidence_retrieval(
            request.message,
            request.document_ids,
            db
        )
        logger.info("[CHAT] Step 2: DB fallback returned %d chunks", len(evidence_chunks))

    # ---------------------------------------------------------
    # 3. Safe abstention
    # ---------------------------------------------------------

    if not evidence_chunks:
        logger.info("[CHAT] Step 3: No evidence found at all -> ABSTAINING")
        abstaining_answer = (
            "I couldn't find sufficient information "
            "in the provided document. I don't want to guess."
        )

        user_msg = ChatMessage(
            session_id=session_id,
            role="user",
            content=request.message
        )

        assistant_msg = ChatMessage(
            session_id=session_id,
            role="assistant",
            content=abstaining_answer,
            memories_used=None
        )

        db.add(user_msg)
        db.add(assistant_msg)
        await db.commit()
        await db.refresh(assistant_msg)

        return ChatResponse(
            message_id=str(assistant_msg.message_id),
            session_id=str(session_id),
            answer=abstaining_answer,
            grounded=False,
            evidence_count=0,
            citations=[],
            memories_used=None,
            memories_updated=None
        )

    # ---------------------------------------------------------
    # 4. Build grounded prompt
    # ---------------------------------------------------------

    context_str = "\n\n".join(
        [
            f"Document: {chunk['document_name']} "
            f"(Page {chunk['page_no']}, "
            f"Section: {chunk['section']})\n"
            f"Text: {chunk['text']}"
            for chunk in evidence_chunks
        ]
    )

    prompt = (
        "System: You are MediMei, a clinical assistant. "
        "Answer the question using ONLY the provided evidence. "
        "Do not use external knowledge or guess. "
        "If the answer is not in the text, abstain.\n\n"
        f"Evidence:\n{context_str}\n\n"
        f"Question: {request.message}\n"
        "Answer:"
    )

    # ---------------------------------------------------------
    # 5. Call LLM
    # ---------------------------------------------------------

    # Limit memories passed to LLM to avoid prompt overflow
    llm_memories = None
    if current_user.memory_enabled and memory_records:
        llm_memories = memory_records[:5]

    rag_result = await rag_service.answer_with_evidence(
        request.message,
        evidence_chunks,
        memories=llm_memories,
        task_id=x_task_id,
    )
    answer_text = rag_result["answer"]
    grounded = rag_result["grounded"]
    evidence_count = rag_result["sources_used"]
    logger.info("[CHAT] Step 5: LLM returned answer_text (len=%d, empty=%s), grounded=%s, sources_used=%d",
                len(answer_text) if answer_text else 0, not bool(answer_text), grounded, evidence_count)
    logger.info("[CHAT] Step 5: answer_text first 300 chars: %r", (answer_text[:300] if answer_text else "<EMPTY>"))
    if rag_result.get("error"):
        logger.error("[CHAT] Step 5: RAG error: %s", rag_result["error"])

    # ---------------------------------------------------------
    # 5.5. Extract & Update Memories (if enabled)
    # ---------------------------------------------------------
    memories_updated = []
    if current_user.memory_enabled and answer_text:
        memories_updated = await memory_service.extract_and_update_memories(
            user_id=current_user.user_id,
            user_message=request.message,
            assistant_message=answer_text,
            db=db
        )
        # Also store the exact Q&A turn into memory along with citations
        await memory_service.save_qa_to_memory(
            user_id=current_user.user_id,
            question=request.message,
            answer=answer_text,
            citations=rag_result.get("citations") or [],
            db=db
        )
        # Add the stored Q&A to the list of memories updated for the UI notification
        qa_memory_str = f"Q: {request.message.strip()} | A: {answer_text.strip()}"
        memories_updated.append(qa_memory_str)

    # ---------------------------------------------------------
    # 6. Build citations
    # ---------------------------------------------------------

    raw_citations = rag_result.get("citations") or []
    logger.info("[CHAT] Step 6: RAG returned %d citations", len(raw_citations))
    if not raw_citations and evidence_chunks and answer_text:
        logger.info("[CHAT] Step 6: No RAG citations but evidence exists -> using evidence as citations")
        raw_citations = evidence_chunks[:min(4, len(evidence_chunks))]
        grounded = True
        evidence_count = len(raw_citations)

    citations = [
        Citation(
            document_id=cit.get("document_id") or "",
            document_name=cit.get("document_name") or "Official Reference Document",
            page=cit.get("page_no") or cit.get("page") or 1,
            section=cit.get("section_title") or cit.get("section") or "Prescribing Information",
            chunk_id=str(cit.get("chunk_id") or ""),
            text=cit.get("text") or cit.get("chunk_text") or "",
            score=cit.get("score") or 0.85
        )
        for cit in raw_citations
    ]

    # ---------------------------------------------------------
    # 7. Save user message
    # ---------------------------------------------------------

    user_msg = ChatMessage(
        session_id=session_id,
        role="user",
        content=request.message
    )

    # ---------------------------------------------------------
    # 8. Save assistant message
    # ---------------------------------------------------------

    assistant_msg = ChatMessage(
        session_id=session_id,
        role="assistant",
        content=answer_text,
        memories_updated=json.dumps(memories_updated) if memories_updated else None,
        memories_used=json.dumps(rag_result.get("memories_used")) if rag_result.get("memories_used") else None
    )

    db.add(user_msg)
    db.add(assistant_msg)

    await db.flush()

    # ---------------------------------------------------------
    # 9. Save citations
    # ---------------------------------------------------------

    doc_ids_to_check = {cit.document_id for cit in citations if cit.document_id}
    valid_doc_ids = set()
    if doc_ids_to_check:
        doc_stmt = select(Document.document_id).where(Document.document_id.in_(doc_ids_to_check))
        doc_res = await db.execute(doc_stmt)
        valid_doc_ids = set(doc_res.scalars().all())

    for idx, cit in enumerate(citations):
        doc_id = cit.document_id
        if not doc_id or doc_id not in valid_doc_ids:
            logger.warning(
                "Skipping citation save for document_id '%s' (not found in documents table).",
                doc_id
            )
            continue

        unique_cit_id = f"{assistant_msg.message_id}_{cit.chunk_id or idx}_{idx}"
        cit.citation_id = unique_cit_id
        db.add(
            CitationModel(
                citation_id=unique_cit_id,
                message_id=assistant_msg.message_id,
                document_id=doc_id,
                document_name=cit.document_name,
                page_no=cit.page,
                chunk_id=str(cit.chunk_id or ""),
                text=cit.text,
                score=cit.score,
                section=cit.section
            )
        )

    try:
        await db.commit()
        await db.refresh(assistant_msg)
    except Exception as e:
        logger.error("Error committing message citations: %s", e)
        await db.rollback()

    # ---------------------------------------------------------
    # 10. Return response
    # ---------------------------------------------------------

    logger.info("[CHAT] Step 10: Returning response. answer_len=%d, grounded=%s, citations=%d, memories_updated=%d",
                len(answer_text) if answer_text else 0, grounded, len(citations), len(memories_updated) if memories_updated else 0)
    return ChatResponse(
        message_id=str(assistant_msg.message_id),
        session_id=str(session_id),
        answer=answer_text,
        thinking=rag_result.get("thinking"),
        grounded=grounded,
        evidence_count=evidence_count,
        citations=citations,
        memories_updated=memories_updated if memories_updated else None,
        memories_used=rag_result.get("memories_used") or None
    )


# =============================================================
# CREATE CHAT SESSION
# =============================================================

@sessions_router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_chat_session(
    request: SessionCreate = SessionCreate(),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    new_session = ChatSession(
        user_id=current_user.user_id,
        summary=request.summary or "New Chat"
    )
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    
    return SessionResponse(
        session_id=str(new_session.session_id),
        started_at=new_session.started_at,
        summary=new_session.summary,
        messages=[]
    )


# =============================================================
# LIST CHAT SESSIONS
# =============================================================

@sessions_router.get("", response_model=List[SessionResponse])
async def list_chat_sessions(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(ChatSession)
        .filter(ChatSession.user_id == current_user.user_id)
        .order_by(ChatSession.started_at.desc())
    )
    sessions = result.scalars().all()
    
    return [
        SessionResponse(
            session_id=str(session.session_id),
            started_at=session.started_at,
            summary=session.summary,
            messages=[
                MessageResponse(
                    message_id=str(msg.message_id),
                    session_id=str(msg.session_id),
                    role=msg.role,
                    content=msg.content,
                    timestamp=msg.created_at,
                    citations=[
                        Citation(
                            citation_id=cit.citation_id,
                            document_id=cit.document_id,
                            document_name=cit.document_name or "Unknown Document",
                            page=cit.page_no,
                            section=cit.section,
                            chunk_id=cit.chunk_id,
                            text=cit.text,
                            score=cit.score
                        )
                        for cit in msg.citations
                    ],
                    memories_updated=json.loads(msg.memories_updated) if msg.memories_updated else None,
                    memories_used=json.loads(msg.memories_used) if msg.memories_used else None
                )
                for msg in session.messages
            ]
        )
        for session in sessions
    ]


# =============================================================
# DELETE CHAT SESSION
# =============================================================

@sessions_router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chat_session(
    session_id: int,
    db: AsyncSession = Depends(get_db_session)
):
    result = await db.execute(
        select(ChatSession).filter(
            ChatSession.session_id == session_id
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found."
        )
    await db.delete(session)
    await db.commit()
    return


# =============================================================
# GET CHAT SESSION
# =============================================================

@sessions_router.get(
    "/{session_id}",
    response_model=SessionResponse
)
async def get_chat_session(
    session_id: int,
    db: AsyncSession = Depends(get_db_session)
):

    result = await db.execute(
        select(ChatSession).filter(
            ChatSession.session_id == session_id
        )
    )

    session = result.scalar_one_or_none()

    if not session:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found."
        )

    return SessionResponse(
        session_id=str(session.session_id),
        started_at=session.started_at,
        summary=session.summary,
        messages=[
            MessageResponse(
                message_id=str(msg.message_id),
                session_id=str(msg.session_id),
                role=msg.role,
                content=msg.content,
                timestamp=msg.created_at,
                citations=[
                    Citation(
                        citation_id=cit.citation_id,
                        document_id=cit.document_id,
                        document_name=cit.document_name or "Unknown Document",
                        page=cit.page_no,
                        section=cit.section,
                        chunk_id=cit.chunk_id,
                        text=cit.text,
                        score=cit.score,
                    )
                    for cit in msg.citations
                ],
                memories_updated=json.loads(msg.memories_updated) if msg.memories_updated else None,
                memories_used=json.loads(msg.memories_used) if msg.memories_used else None
            )
            for msg in session.messages
        ]
    )


# =============================================================
# GET SESSION MESSAGES
# =============================================================

@sessions_router.get(
    "/{session_id}/messages",
    response_model=List[MessageResponse]
)
async def get_session_messages(
    session_id: int,
    db: AsyncSession = Depends(get_db_session)
):

    result = await db.execute(
        select(ChatSession).filter(
            ChatSession.session_id == session_id
        )
    )

    session = result.scalar_one_or_none()

    if not session:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found."
        )

    return [
        MessageResponse(
            message_id=str(msg.message_id),
            session_id=str(msg.session_id),
            role=msg.role,
            content=msg.content,
            timestamp=msg.created_at,
            citations=[
                Citation(
                    citation_id=cit.citation_id,
                    document_id=cit.document_id,
                    document_name=cit.document_name or "Unknown Document",
                    page=cit.page_no,
                    section=cit.section,
                    chunk_id=cit.chunk_id,
                    text=cit.text,
                    score=cit.score,
                )
                for cit in msg.citations
            ],
            memories_updated=json.loads(msg.memories_updated) if msg.memories_updated else None,
            memories_used=json.loads(msg.memories_used) if msg.memories_used else None
        )
        for msg in session.messages
    ]


# =============================================================
# UPDATE CHAT SESSION
# =============================================================

@sessions_router.patch(
    "/{session_id}",
    response_model=SessionResponse
)
async def update_chat_session(
    session_id: int,
    update: SessionUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(ChatSession).filter(
            ChatSession.session_id == session_id,
            ChatSession.user_id == current_user.user_id
        )
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found."
        )

    session.summary = update.summary
    await db.commit()
    await db.refresh(session)

    return SessionResponse(
        session_id=str(session.session_id),
        started_at=session.started_at,
        summary=session.summary,
        messages=[
            MessageResponse(
                message_id=str(msg.message_id),
                session_id=str(msg.session_id),
                role=msg.role,
                content=msg.content,
                timestamp=msg.created_at,
                citations=[
                    Citation(
                        citation_id=cit.citation_id,
                        document_id=cit.document_id,
                        document_name=cit.document_name or "Unknown Document",
                        page=cit.page_no,
                        section=cit.section,
                        chunk_id=cit.chunk_id,
                        text=cit.text,
                        score=cit.score,
                    )
                    for cit in msg.citations
                ],
                memories_updated=json.loads(msg.memories_updated) if msg.memories_updated else None,
                memories_used=json.loads(msg.memories_used) if msg.memories_used else None
            )
            for msg in session.messages
        ]
    )