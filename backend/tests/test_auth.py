import pytest
import uuid
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, MagicMock
from app.main import app
from app.db.database import get_db_session
from app.models.user import User
from app.core.security import get_password_hash, create_access_token

@pytest.fixture
def mock_db():
    db = AsyncMock()
    db.add = MagicMock()
    return db

@pytest.fixture
def client(mock_db):
    async def override_db():
        yield mock_db
    app.dependency_overrides[get_db_session] = override_db
    yield TestClient(app)
    app.dependency_overrides.pop(get_db_session, None)


def test_register_user_success(client, mock_db):
    # Mock database to return None (email not registered yet)
    mock_result_exist = MagicMock()
    mock_result_exist.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_result_exist

    async def mock_refresh(obj):
        obj.user_id = "test-uuid-123"
    mock_db.refresh.side_effect = mock_refresh

    payload = {
        "email": "register_test@example.com",
        "password": "strongpassword123",
        "role": "user"
    }
    
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == payload["email"]
    assert data["role"] == "user"
    assert "user_id" in data
    
    # Assert DB methods called
    mock_db.add.assert_called_once()
    mock_db.commit.assert_called_once()
    mock_db.refresh.assert_called_once()


def test_register_user_duplicate_email(client, mock_db):
    existing_user = User(
        user_id="existing-uuid",
        email="existing@example.com",
        hashed_password="somehash",
        role="user"
    )
    # Mock database to return existing user
    mock_result_exist = MagicMock()
    mock_result_exist.scalar_one_or_none.return_value = existing_user
    mock_db.execute.return_value = mock_result_exist

    payload = {
        "email": "existing@example.com",
        "password": "strongpassword123",
        "role": "user"
    }
    
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 409
    assert response.json()["detail"] == "A user with this email is already registered."


def test_login_user_success(client, mock_db):
    hashed_password = get_password_hash("loginpassword")
    db_user = User(
        user_id="user-uuid-999",
        email="login_test@example.com",
        hashed_password=hashed_password,
        role="user"
    )
    
    # Mock database to return the matching user
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = db_user
    mock_db.execute.return_value = mock_result

    payload = {
        "email": "login_test@example.com",
        "password": "loginpassword"
    }

    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_user_incorrect_password(client, mock_db):
    hashed_password = get_password_hash("correctpassword")
    db_user = User(
        user_id="user-uuid-999",
        email="login_test@example.com",
        hashed_password=hashed_password,
        role="user"
    )
    
    # Mock database to return the matching user
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = db_user
    mock_db.execute.return_value = mock_result

    payload = {
        "email": "login_test@example.com",
        "password": "wrongpassword"
    }

    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect password."


def test_login_user_not_found(client, mock_db):
    # Mock database to return None (no user found with email)
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_result

    payload = {
        "email": "notfound@example.com",
        "password": "anypassword"
    }

    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 401
    assert response.json()["detail"] == "Account not found. Create a new account."


def test_get_me_success(client, mock_db):
    user_id = "user-me-123"
    db_user = User(
        user_id=user_id,
        email="me@example.com",
        hashed_password="somehash",
        role="admin"
    )
    
    # Mock database to return the user when get_current_user queries it
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = db_user
    mock_db.execute.return_value = mock_result

    # Generate token
    token = create_access_token(subject=user_id, role="admin")
    
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/auth/me", headers=headers)
    
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "me@example.com"
    assert data["role"] == "admin"
    assert data["user_id"] == user_id


def test_get_me_invalid_token(client):
    headers = {"Authorization": "Bearer invalidtoken123"}
    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 401
    assert response.json()["detail"] == "Could not validate credentials"


def test_get_me_missing_token(client):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"
