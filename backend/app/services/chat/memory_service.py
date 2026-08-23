import logging
import json
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.memory import UserMemory
from app.services.llm.llm_service import LLMService

logger = logging.getLogger(__name__)

DEFAULT_MEMORY_CONTENT = (
    "If the user greets me with 'hi', 'hey', 'hello', or asks who I am "
    "or about the chatbot, I should respond warmly and briefly introduce myself "
    "as MediMei, a clinical assistant."
)


class MemoryService:
    """
    Manages chatbot memory extraction and persistence.
    Dynamically learns profile details, specialties, patient facts, and user preferences.
    """

    def __init__(self, llm_service: LLMService = None):
        self.llm_service = llm_service or LLMService()

    async def get_memories_as_string(self, user_id: str, db: AsyncSession) -> str:
        """
        Retrieves user memories from the database and returns a formatted bulleted list.
        """
        result = await db.execute(
            select(UserMemory)
            .filter(UserMemory.user_id == user_id)
            .order_by(UserMemory.created_at.desc())
        )
        memories = result.scalars().all()
        if not memories:
            return ""
        return "\n".join(f"- {m.content}" for m in memories)

    async def get_memories_as_records(
        self,
        user_id: str,
        db: AsyncSession
    ) -> List[Dict[str, Any]]:
        """
        Retrieve user memories in the same shape as document retrieval results
        so they can be fed into the RAG evidence context and cited.
        """
        result = await db.execute(
            select(UserMemory)
            .filter(UserMemory.user_id == user_id)
            .order_by(UserMemory.created_at.desc())
        )
        records = []
        for m in result.scalars().all():
            if isinstance(m, str):
                records.append({
                    "chunk_id": "USER_MEMORY",
                    "document_id": "USER_MEMORY",
                    "document_name": "User Memory",
                    "page_no": 1,
                    "section_title": "User Profile",
                    "text": m,
                    "score": 0.1,
                })
            else:
                records.append({
                    "chunk_id": str(getattr(m, "memory_id", "USER_MEMORY")),
                    "document_id": "USER_MEMORY",
                    "document_name": "User Memory",
                    "page_no": 1,
                    "section_title": "User Profile",
                    "text": getattr(m, "content", "") or "",
                    "score": 0.1,
                })
        return records

    async def extract_and_update_memories(
        self,
        user_id: str,
        user_message: str,
        assistant_message: str,
        db: AsyncSession
    ) -> List[str]:
        """
        Uses LLM to analyze the conversational turn, compare it to existing memories,
        and dynamically write/remove entries from the database.
        Returns a list of newly learned (added) memory contents.
        """
        if not user_message or not assistant_message:
            return []

        # 1. Fetch current memories to provide context to the manager
        result = await db.execute(
            select(UserMemory)
            .filter(UserMemory.user_id == user_id)
        )
        existing_memories = result.scalars().all()
        existing_memories_content = [getattr(m, "content", str(m)) for m in existing_memories]
        existing_str = "\n".join(f"- {c}" for c in existing_memories_content) if existing_memories_content else "[No memories stored yet]"

        # 2. Compile instructions prompt
        prompt = (
            "System: You are an AI assistant that manages user memory for a personalized clinical assistant.\n"
            "Analyze the conversation below and decide what facts or preferences to ADD, UPDATE, or REMOVE from the user's profile memory.\n"
            "Memories should be concise, long-term facts or preferences about the user, their medical specialties, their patients, or preferred formatting (e.g., 'User is a pediatrician', 'User prefers bulleted summaries', 'User is looking for Rinvoq side effects').\n"
            "Do not remember specific, one-off questions unless they establish a pattern. Do not store conversational details like greetings.\n\n"
            f"Current memories for the user:\n{existing_str}\n\n"
            "Latest conversation:\n"
            f"User: {user_message}\n"
            f"Assistant: {assistant_message}\n\n"
            "To change the memories, output instructions in the following format (one per line):\n"
            "ADD: <fact to remember>\n"
            "REMOVE: <exact fact to remove>\n\n"
            "If no changes are needed, output 'NO CHANGE'. Do not output anything else."
        )

        try:
            response_text = self.llm_service.generate(prompt, max_new_tokens=256, temperature=0.0)
            
            if "no change" in response_text.lower() or not response_text.strip():
                return []

            added_memories = []
            removed_memories = []
            
            lines = response_text.strip().split("\n")
            for line in lines:
                line = line.strip()
                if line.lower().startswith("add:"):
                    content = line[4:].strip()
                    if content.startswith('"') and content.endswith('"'):
                        content = content[1:-1]
                    if content and content not in existing_memories_content and content not in added_memories:
                        added_memories.append(content)
                elif line.lower().startswith("remove:"):
                    content = line[7:].strip()
                    if content.startswith('"') and content.endswith('"'):
                        content = content[1:-1]
                    if content and content in existing_memories_content and content not in removed_memories:
                        removed_memories.append(content)

            # Apply updates
            for content in removed_memories:
                for m in existing_memories:
                    if getattr(m, "is_default", False):
                        continue
                    if getattr(m, "content", None) == content:
                        await db.delete(m)
            
            for content in added_memories:
                new_mem = UserMemory(user_id=user_id, content=content, is_default=False)
                db.add(new_mem)

            if added_memories or removed_memories:
                await db.commit()
                logger.info(f"Updated user {user_id} memories: Added {added_memories}, Removed {removed_memories}")
            
            return added_memories

        except Exception as e:
            logger.error(f"Failed to extract and update memories: {e}")
            return []

    async def ensure_default_memory(self, user_id: str, db: AsyncSession):
        """Create the non-deletable greeting default memory for a user if absent."""
        result = await db.execute(
            select(UserMemory)
            .filter(UserMemory.user_id == user_id)
            .filter(UserMemory.is_default.is_(True))
        )
        if not result.scalar_one_or_none():
            default = UserMemory(
                user_id=user_id,
                content=DEFAULT_MEMORY_CONTENT,
                citations="[]",
                is_default=True,
            )
            db.add(default)
            await db.commit()

    async def save_qa_to_memory(
        self,
        user_id: str,
        question: str,
        answer: str,
        db: AsyncSession,
        citations: List[Dict[str, Any]] = None
    ):
        """
        Saves a conversation turn (question and answer) directly into the user's memories,
        including sources and citations.
        Ensures no duplicate entries for the same question.
        """
        if not question or not answer:
            return

        normalized_q = question.strip().lower()

        # Build clean citation list
        cit_list = []
        if citations:
            for cit in citations:
                # cit can be Citation model or dictionary
                if hasattr(cit, "dict") or hasattr(cit, "model_dump"):
                    c_dict = cit.model_dump() if hasattr(cit, "model_dump") else cit.dict()
                elif isinstance(cit, dict):
                    c_dict = cit
                else:
                    # SQLAlchemy/Pydantic class fallback
                    c_dict = {
                        "document_id": getattr(cit, "document_id", ""),
                        "document_name": getattr(cit, "document_name", "Unknown Document"),
                        "page_no": getattr(cit, "page_no", getattr(cit, "page", 1)),
                        "chunk_id": getattr(cit, "chunk_id", ""),
                        "text": getattr(cit, "text", ""),
                        "score": getattr(cit, "score", None),
                        "section": getattr(cit, "section", "")
                    }
                
                cit_list.append({
                    "document_id": c_dict.get("document_id") or "",
                    "document_name": c_dict.get("document_name") or "Unknown Document",
                    "page_no": c_dict.get("page_no") or c_dict.get("page") or 1,
                    "chunk_id": c_dict.get("chunk_id") or "",
                    "text": c_dict.get("text") or "",
                    "score": c_dict.get("score"),
                    "section": c_dict.get("section")
                })

        citations_json = json.dumps(cit_list)
        memory_content = f"Q: {question.strip()} | A: {answer.strip()} | Citations: {citations_json}"

        # Parse existing memories to find if we already have this question
        result = await db.execute(
            select(UserMemory)
            .filter(UserMemory.user_id == user_id)
        )
        memories = result.scalars().all()

        for m in memories:
            m_content = getattr(m, "content", None) or (m if isinstance(m, str) else "")
            if m_content.startswith("Q: ") and " | A: " in m_content:
                parts = m_content.split(" | A: ", 1)
                stored_q = parts[0][3:].strip().lower()
                if stored_q == normalized_q:
                    if hasattr(m, "content"):
                        m.content = memory_content
                        m.citations = citations_json
                        await db.commit()
                    return

        # If not found, add a new one
        new_memory = UserMemory(
            user_id=user_id,
            content=memory_content,
            citations=citations_json,
            is_default=False
        )
        db.add(new_memory)
        await db.commit()


# Singleton service
memory_service = MemoryService()
