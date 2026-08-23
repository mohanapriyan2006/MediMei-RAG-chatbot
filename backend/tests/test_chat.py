import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, MagicMock, patch
from app.main import app
from app.db.database import get_db_session
from app.dependencies.embeddings import get_embedding_model
from app.dependencies.qdrant import get_qdrant_client
from app.dependencies.llm import get_llm_client
from app.models.chat import ChatSession, ChatMessage

@pytest.fixture
def mock_db():
    db = AsyncMock()
    db.add = MagicMock()
    return db

@pytest.fixture
def mock_embeddings():
    mock = MagicMock()
    mock.encode.return_value = [0.1] * 1024
    return mock

@pytest.fixture
def mock_qdrant():
    mock = AsyncMock()
    
    mock_point = MagicMock()
    mock_point.id = "point-1"
    mock_point.score = 0.95
    mock_point.payload = {
        "chunk_id": "chunk-123",
        "document_id": "doc-abc",
        "document_name": "Rinvoq.pdf",
        "page_no": 12,
        "section": "Dosage",
        "text": "This is dosage text."
    }
    
    mock.search.return_value = [mock_point]
    mock.query_points.return_value = MagicMock(points=[mock_point])
    return mock

@pytest.fixture
def mock_llm():
    mock = MagicMock()
    mock.return_value = {
        "choices": [
            {"text": "The recommended dose of Rinvoq is 15 mg. [S1]"}
        ]
    }
    return mock

@pytest.fixture
def client(mock_db, mock_embeddings, mock_qdrant, mock_llm):
    from app.repositories.qdrant_repository import qdrant_repository
    old_qdrant_client = qdrant_repository._client
    qdrant_repository._client = mock_qdrant

    async def override_db():
        yield mock_db
    def override_embeddings():
        return mock_embeddings
    async def override_qdrant():
        return mock_qdrant
    def override_llm():
        return mock_llm
    from app.dependencies.auth import get_current_user
    from app.models.user import User
    
    app.dependency_overrides[get_db_session] = override_db
    app.dependency_overrides[get_embedding_model] = override_embeddings
    app.dependency_overrides[get_qdrant_client] = override_qdrant
    app.dependency_overrides[get_llm_client] = override_llm
    app.dependency_overrides[get_current_user] = lambda: User(
        user_id="test-user-id", email="test@example.com", hashed_password="x", role="user", memory_enabled=True
    )
    
    with patch("app.services.llm.llm_service.get_llm_client", return_value=mock_llm):
        yield TestClient(app)
    
    qdrant_repository._client = old_qdrant_client
    app.dependency_overrides.pop(get_db_session, None)
    app.dependency_overrides.pop(get_embedding_model, None)
    app.dependency_overrides.pop(get_qdrant_client, None)
    app.dependency_overrides.pop(get_llm_client, None)
    app.dependency_overrides.pop(get_current_user, None)

# =====================================================================
# POST CHAT TESTS
# =====================================================================

def test_post_chat_message_missing_session_id(client):
    payload = {
        "message": "What is the dose?",
        "document_ids": ["doc-123"]
    }
    response = client.post("/api/v1/chat", json=payload)
    assert response.status_code == 400
    assert "session_id is required" in response.json()["detail"]

def test_post_chat_message_invalid_session_id(client):
    payload = {
        "session_id": "abc",
        "message": "What is the dose?",
        "document_ids": ["doc-123"]
    }
    response = client.post("/api/v1/chat", json=payload)
    assert response.status_code == 400
    assert "session_id must be a valid number" in response.json()["detail"]

def test_post_chat_message_session_not_found(client, mock_db):
    payload = {
        "session_id": "999",
        "message": "What is the dose?",
        "document_ids": ["doc-123"]
    }
    
    # Mocking select(ChatSession) returning None
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_result
    
    response = client.post("/api/v1/chat", json=payload)
    assert response.status_code == 404
    assert "Session not found" in response.json()["detail"]

@patch("app.services.chat.conversation.hybrid_search")
def test_post_chat_message_success(mock_hybrid_search, client, mock_db, mock_llm):
    mock_hybrid_search.return_value = [
        {
            "chunk_id": "chunk-123",
            "document_id": "doc-abc",
            "document_name": "Rinvoq.pdf",
            "page_no": 12,
            "section": "Dosage",
            "text": "The recommended dose of Rinvoq is 15 mg.",
            "score": 0.95
        }
    ]
    payload = {
        "session_id": "1",
        "message": "What is the dose of Rinvoq?",
        "document_ids": ["doc-abc"]
    }
    
    session = ChatSession(session_id=1, user_id=10, started_at=datetime.utcnow(), summary="")
    
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = session
    mock_db.execute.return_value = mock_result
    
    response = client.post("/api/v1/chat", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    assert data["session_id"] == "1"
    assert data["answer"] == "The recommended dose of Rinvoq is 15 mg. [S1]"
    assert data["grounded"] is True
    assert len(data["citations"]) == 1
    assert data["citations"][0]["chunk_id"] == "chunk-123"


@patch("app.services.retrieval.semantic_search_service.SemanticSearchService.search")
def test_post_chat_message_non_drug_document_retrieval(mock_search, client, mock_db, mock_llm):
    """Verify that a non-drug document (e.g. a novel) is correctly retrieved
    and its content reaches the LLM — not Rinvoq or other drug chunks."""
    mock_search.return_value = [
        {
            "chunk_id": "chunk-novel-42",
            "document_id": "doc-jekyll",
            "document_name": "Jekyll_and_Hyde.pdf",
            "page_no": 48,
            "section_title": "Chapter 6",
            "section": "Chapter 6",
            "text": "Dr. Lanyon replied that he had seen something so impossible, so dreadful, "
                    "that he could not speak of it. He begged Utterson not to mention the matter again.",
            "score": 0.88,
        }
    ]
    # Override LLM to echo back evidence so we can verify it received the novel chunk
    mock_llm.return_value = {
        "choices": [
            {"text": "Dr. Lanyon replied that he saw something impossible and dreadful, "
                     "and begged Utterson not to mention it again. [S1]"}
        ]
    }

    payload = {
        "session_id": "1",
        "message": "what does dr. lanyon reply?",
        "document_ids": ["doc-jekyll"]
    }

    session = ChatSession(session_id=1, user_id=10, started_at=datetime.utcnow(), summary="")

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = session
    mock_db.execute.return_value = mock_result

    response = client.post("/api/v1/chat", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["grounded"] is True
    assert "Lanyon" in data["answer"]
    assert len(data["citations"]) >= 1
    assert data["citations"][0]["document_name"] == "Jekyll_and_Hyde.pdf"
    assert data["citations"][0]["page"] == 48

    # Verify the search was called with the correct query and document_ids
    mock_search.assert_called_once()
    _, kwargs = mock_search.call_args
    assert kwargs["document_ids"] == ["doc-jekyll"]


@patch("app.services.retrieval.semantic_search_service.SemanticSearchService.search")
def test_post_chat_message_no_evidence_for_unrelated_query(mock_search, client, mock_db):
    """When SemanticSearchService returns no results and DB fallback also returns nothing,
    the chat endpoint should abstain — not return random chunks."""
    mock_search.return_value = []

    payload = {
        "session_id": "1",
        "message": "what is the meaning of life?",
        "document_ids": ["doc-jekyll"]
    }

    session = ChatSession(session_id=1, user_id=10, started_at=datetime.utcnow(), summary="")

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = session
    mock_result.scalars.return_value.all.return_value = []
    mock_db.execute.return_value = mock_result

    response = client.post("/api/v1/chat", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["grounded"] is False
    assert "I couldn't find sufficient information" in data["answer"]
    assert len(data["citations"]) == 0

@patch("app.services.chat.conversation.hybrid_search")
def test_post_chat_message_abstain(mock_hybrid_search, client, mock_db, mock_qdrant):
    # Mock empty search results
    mock_qdrant.search.return_value = []
    mock_qdrant.query_points.return_value = MagicMock(points=[])
    
    payload = {
        "session_id": "1",
        "message": "Completely unrelated query?",
        "document_ids": ["doc-abc"]
    }
    
    session = ChatSession(session_id=1, user_id=10, started_at=datetime.utcnow(), summary="")
    
    mock_result = MagicMock()
    # First query for ChatSession, second query for Document (in fallback mock_evidence_retrieval which returns empty docs)
    mock_result.scalar_one_or_none.return_value = session
    mock_result.scalars.return_value.all.return_value = []
    mock_db.execute.return_value = mock_result
    
    response = client.post("/api/v1/chat", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    assert data["grounded"] is False
    assert "I couldn't find sufficient information" in data["answer"]
    assert len(data["citations"]) == 0

# =====================================================================
# GET SESSION TESTS
# =====================================================================

def test_get_chat_session_not_found(client, mock_db):
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_result
    
    response = client.get("/api/v1/sessions/999")
    assert response.status_code == 404
    assert "Session not found" in response.json()["detail"]

def test_get_chat_session_success(client, mock_db):
    session = ChatSession(session_id=1, user_id=10, started_at=datetime.utcnow(), summary="Mock Summary")
    msg1 = ChatMessage(message_id=101, session_id=1, role="user", content="Hello", created_at=datetime.utcnow())
    msg2 = ChatMessage(message_id=102, session_id=1, role="assistant", content="Hi", created_at=datetime.utcnow())
    session.messages = [msg1, msg2]
    
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = session
    mock_db.execute.return_value = mock_result
    
    response = client.get("/api/v1/sessions/1")
    assert response.status_code == 200
    data = response.json()
    assert data["session_id"] == "1"
    assert data["summary"] == "Mock Summary"
    assert len(data["messages"]) == 2
    assert data["messages"][0]["content"] == "Hello"
    assert data["messages"][1]["content"] == "Hi"

def test_get_session_messages_success(client, mock_db):
    session = ChatSession(session_id=1, user_id=10, started_at=datetime.utcnow(), summary="")
    msg1 = ChatMessage(message_id=101, session_id=1, role="user", content="Hello", created_at=datetime.utcnow())
    session.messages = [msg1]
    
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = session
    mock_db.execute.return_value = mock_result
    
    response = client.get("/api/v1/sessions/1/messages")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["content"] == "Hello"


def test_post_chat_message_memory_match_exact(client, mock_db):
    session = ChatSession(session_id=1, user_id=10, started_at=datetime.utcnow(), summary="")

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = session
    mock_db.execute.return_value = mock_result

    payload = {
        "session_id": "1",
        "message": "What is the dosage of drug A?",
        "document_ids": []
    }

    with patch("app.api.routes.chat.memory_service.get_memories_as_string") as mock_get_memories:
        mock_get_memories.return_value = "- Q: What is the dosage of drug A? | A: The dosage is 5mg once daily."

        response = client.post("/api/v1/chat", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["answer"] == "The dosage is 5mg once daily."
        assert data["grounded"] is True
        assert data["memories_used"] == ["Q: What is the dosage of drug A? | A: The dosage is 5mg once daily."]


def test_post_chat_message_memory_match_semantic(client, mock_db, mock_embeddings):
    session = ChatSession(session_id=1, user_id=10, started_at=datetime.utcnow(), summary="")

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = session
    mock_db.execute.return_value = mock_result

    payload = {
        "session_id": "1",
        "message": "what is the dose of drug A?",
        "document_ids": []
    }

    # Mock embeddings.encode:
    # first call is for the user's query: returns [1.0, 0.0]
    # second call is for the stored questions in B: returns [[0.99, 0.05]]
    mock_embeddings.encode.side_effect = [
        [1.0, 0.0],
        [[0.99, 0.05]]
    ]

    with patch("app.api.routes.chat.memory_service.get_memories_as_string") as mock_get_memories:
        mock_get_memories.return_value = "- Q: What is the dosage of drug A? | A: The dosage is 5mg once daily."

        response = client.post("/api/v1/chat", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["answer"] == "The dosage is 5mg once daily."
        assert data["grounded"] is True
        assert data["memories_used"] == ["Q: What is the dosage of drug A? | A: The dosage is 5mg once daily."]


def test_post_chat_message_memory_match_with_citations(client, mock_db):
    session = ChatSession(session_id=1, user_id=10, started_at=datetime.utcnow(), summary="")

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = session
    mock_result.scalars.return_value.all.return_value = ["doc123"]
    mock_db.execute.return_value = mock_result

    payload = {
        "session_id": "1",
        "message": "What is the dosage of drug A?",
        "document_ids": []
    }

    citations_json = '[{"document_id": "doc123", "document_name": "Rinvoq.pdf", "page_no": 12, "chunk_id": "chunk_abc", "text": "dosage text", "score": 0.95, "section": "Dosage"}]'
    stored_memory = f"Q: What is the dosage of drug A? | A: The dosage is 5mg once daily. | Citations: {citations_json}"

    with patch("app.api.routes.chat.memory_service.get_memories_as_string") as mock_get_memories, \
         patch("app.api.routes.chat.memory_service.get_memories_as_records") as mock_get_records:
        mock_get_memories.return_value = f"- {stored_memory}"
        mock_get_records.return_value = [{"text": stored_memory}]

        response = client.post("/api/v1/chat", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["answer"] == "The dosage is 5mg once daily."
        assert data["grounded"] is True
        assert data["memories_used"] == [stored_memory]

        # Verify citations are returned in the response
        assert len(data["citations"]) == 1
        assert data["citations"][0]["document_name"] == "Rinvoq.pdf"
        assert data["citations"][0]["page"] == 12
        assert data["citations"][0]["text"] == "dosage text"
