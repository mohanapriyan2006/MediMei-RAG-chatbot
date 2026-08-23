import json
import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, MagicMock, patch

from app.main import app
from app.db.database import get_db_session
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.models.memory import UserMemory
from app.services.llm.prompt_builder import PromptBuilder
from app.services.chat.memory_service import MemoryService


@pytest.fixture
def mock_db():
    db = AsyncMock()
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.delete = AsyncMock()
    return db


@pytest.fixture
def client(mock_db):
    async def override_db():
        yield mock_db
    app.dependency_overrides[get_db_session] = override_db
    app.dependency_overrides[get_current_user] = lambda: User(
        user_id="test-user-id",
        email="test@example.com",
        hashed_password="x",
        role="user",
        memory_enabled=True
    )
    yield TestClient(app)
    app.dependency_overrides.pop(get_db_session, None)
    app.dependency_overrides.pop(get_current_user, None)


def test_prompt_builder_injects_memories():
    question = "What is the recommended dose of Rinvoq?"
    evidence = "Rinvoq evidence content here."
    memories = "- User is a pediatrician\n- User prefers concise bullets"
    
    prompt = PromptBuilder.build(question, evidence, memories=memories)
    
    assert "=== User Profile & Preferences (Memory) ===" in prompt
    assert "- User is a pediatrician" in prompt
    assert "- User prefers concise bullets" in prompt


@pytest.mark.asyncio
async def test_memory_service_get_memories_as_string(mock_db):
    memory_records = [
        UserMemory(user_id="test-user", content="Prefers bullet points"),
        UserMemory(user_id="test-user", content="Cardiology specialty"),
    ]
    
    # Mock database result
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = memory_records
    mock_db.execute = AsyncMock(return_value=mock_result)
    
    service = MemoryService()
    memories_str = await service.get_memories_as_string("test-user", mock_db)
    
    assert "- Prefers bullet points" in memories_str
    assert "- Cardiology specialty" in memories_str


@pytest.mark.asyncio
async def test_memory_service_extracts_and_updates_successfully(mock_db):
    # Mock existing memories (none initially)
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_db.execute = AsyncMock(return_value=mock_result)
    
    # Mock LLM service
    mock_llm = MagicMock()
    mock_llm.generate.return_value = "ADD: User is a neurologist.\nADD: User specializes in multiple sclerosis.\nREMOVE: None"
    
    service = MemoryService(llm_service=mock_llm)
    added = await service.extract_and_update_memories(
        user_id="test-user",
        user_message="I treat multiple sclerosis at my neurology clinic.",
        assistant_message="Rinvoq is approved for multiple sclerosis.",
        db=mock_db
    )
    
    assert "User is a neurologist." in added
    assert "User specializes in multiple sclerosis." in added
    assert mock_db.add.call_count == 2
    mock_db.commit.assert_called_once()


def test_get_memories_endpoint(client, mock_db):
    # Mock DB response
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [
        UserMemory(user_id="test-user-id", content="Wants warnings summarized")
    ]
    mock_db.execute = AsyncMock(return_value=mock_result)
    
    response = client.get("/api/v1/memories")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["content"] == "Wants warnings summarized"


def test_create_memory_endpoint(client, mock_db):
    response = client.post("/api/v1/memories", json={"content": "New manual preference"})
    assert response.status_code == 201
    mock_db.add.assert_called_once()
    mock_db.commit.assert_called_once()


def test_delete_memory_endpoint(client, mock_db):
    memory = UserMemory(memory_id="mem-123", user_id="test-user-id", content="Deletable fact")
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = memory
    mock_db.execute = AsyncMock(return_value=mock_result)
    
    response = client.delete("/api/v1/memories/mem-123")
    assert response.status_code == 204
    mock_db.delete.assert_called_once_with(memory)
    mock_db.commit.assert_called_once()


def test_clear_memories_endpoint(client, mock_db):
    memories = [UserMemory(user_id="test-user-id", content="Fact")]
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = memories
    mock_db.execute = AsyncMock(return_value=mock_result)
    
    response = client.post("/api/v1/memories/clear")
    assert response.status_code == 204
    mock_db.delete.assert_called_once()
    mock_db.commit.assert_called_once()


def test_toggle_memory_endpoint(client, mock_db):
    response = client.post("/api/v1/memories/toggle", json={"memory_enabled": False})
    assert response.status_code == 200
    data = response.json()
    assert data["memory_enabled"] is False
    mock_db.commit.assert_called_once()


@pytest.mark.asyncio
async def test_memory_service_save_qa_to_memory(mock_db):
    service = MemoryService()

    # Mock DB execute result (empty at first)
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_db.execute = AsyncMock(return_value=mock_result)

    await service.save_qa_to_memory(
        user_id="test-user",
        question="What is the dosage of drug A?",
        answer="The dose is 5mg daily.",
        db=mock_db
    )

    # Should call db.add with a new UserMemory
    assert mock_db.add.call_count == 1
    added_mem = mock_db.add.call_args[0][0]
    assert isinstance(added_mem, UserMemory)
    assert added_mem.content == 'Q: What is the dosage of drug A? | A: The dose is 5mg daily. | Citations: []'
    mock_db.commit.assert_called_once()

    # Reset mock and test updating existing
    mock_db.add.reset_mock()
    mock_db.commit.reset_mock()

    existing_mem = UserMemory(
        user_id="test-user",
        content="Q: What is the dosage of drug A? | A: Old dose 10mg. | Citations: []"
    )
    mock_result.scalars.return_value.all.return_value = [existing_mem]

    await service.save_qa_to_memory(
        user_id="test-user",
        question="What is the dosage of drug A?",
        answer="The dose is 5mg daily.",
        db=mock_db
    )

    # Should update existing instead of calling db.add
    assert mock_db.add.call_count == 0
    assert existing_mem.content == 'Q: What is the dosage of drug A? | A: The dose is 5mg daily. | Citations: []'
    mock_db.commit.assert_called_once()

    # Test with actual citations
    mock_db.add.reset_mock()
    mock_db.commit.reset_mock()
    mock_result.scalars.return_value.all.return_value = []

    citations = [
        {
            "document_id": "doc123",
            "document_name": "Rinvoq.pdf",
            "page": 12,
            "section": "Dosage",
            "text": "Dosage info text",
            "score": 0.95
        }
    ]

    await service.save_qa_to_memory(
        user_id="test-user",
        question="What is the dosage of drug A?",
        answer="The dose is 5mg daily.",
        db=mock_db,
        citations=citations
    )

    assert mock_db.add.call_count == 1
    added_mem = mock_db.add.call_args[0][0]
    assert "Citations:" in added_mem.content
    assert "Rinvoq.pdf" in added_mem.content
    assert "doc123" in added_mem.content
    mock_db.commit.assert_called_once()
