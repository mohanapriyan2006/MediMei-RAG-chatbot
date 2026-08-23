# MediMei Backend

FastAPI backend for **MediMei** — an evidence-first drug-information RAG chatbot. Every answer is grounded in approved drug-label documents and backed by citations pointing to exact pages.

> **Status:** Authentication (register / login / me) is implemented and wired to the frontend. Document upload, chat, citations, and comparison routes are scaffolded and awaiting integration with the retrieval/LLM pipeline.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup & Installation](#setup--installation)
- [Environment Variables](#environment-variables)
- [Database Migrations](#database-migrations)
- [Running the Server](#running-the-server)
- [API Endpoints](#api-endpoints)
- [Authentication Flow](#authentication-flow)
- [Architecture Overview](#architecture-overview)
- [Testing](#testing)
- [Frontend Integration](#frontend-integration)

---

## Tech Stack

| Technology | Purpose |
|---|---|
| **FastAPI** | Async web framework for building the REST API |
| **Uvicorn** | ASGI server to run FastAPI |
| **SQLAlchemy 2.0 (async)** | ORM with async session support |
| **asyncmy** | Async MySQL driver for SQLAlchemy |
| **Alembic** | Database migration tool |
| **MySQL** | Relational database for users, documents, chats, citations |
| **python-jose (JWT)** | JWT token creation and verification |
| **passlib (bcrypt)** | Password hashing and verification |
| **Pydantic + pydantic-settings** | Request/response validation and env config |
| **PyMuPDF** | PDF text extraction |
| **PaddleOCR** | OCR fallback for scanned PDFs |
| **Sentence-Transformers** | Embedding generation for semantic search |
| **Qdrant** | Vector database for similarity search |
| **pytest + pytest-asyncio** | Testing framework |

---

## Project Structure

```
backend/
├── app/
│   ├── main.py                      # FastAPI app entry point + CORS + health check
│   ├── api/
│   │   ├── router.py                # Aggregates all route modules under /api/v1
│   │   └── routes/
│   │       ├── auth.py              # POST /register, POST /login, GET /me
│   │       ├── documents.py         # (scaffolded) Document upload/list/delete
│   │       ├── chat.py              # (scaffolded) Q&A endpoint
│   │       ├── citations.py         # (scaffolded) Citation lookup
│   │       └── compare.py           # (scaffolded) Drug comparison
│   ├── core/
│   │   ├── config.py                # Pydantic settings (env-driven)
│   │   ├── security.py              # JWT creation/verification, password hashing
│   │   └── logging.py               # Logging configuration
│   ├── db/
│   │   ├── database.py              # Async engine, session factory, Base
│   │   └── migrations/              # Alembic migrations
│   │       ├── env.py               # Alembic environment (async-aware)
│   │       └── versions/
│   │           └── ab4774dd04e0_create_users_table.py
│   ├── dependencies/
│   │   ├── auth.py                  # get_current_user dependency (JWT → User)
│   │   ├── embeddings.py            # (scaffolded) Embedding model dependency
│   │   ├── llm.py                   # (scaffolded) LLM client dependency
│   │   └── qdrant.py                # (scaffolded) Qdrant client dependency
│   ├── models/
│   │   ├── user.py                  # User SQLAlchemy model
│   │   ├── document.py              # (scaffolded) Document model
│   │   ├── chunk.py                 # (scaffolded) Document chunk model
│   │   ├── chat.py                  # (scaffolded) Chat/conversation model
│   │   └── citation.py              # (scaffolded) Citation model
│   ├── schemas/
│   │   ├── user.py                  # UserRegister, UserLogin, UserOut, Token
│   │   ├── document.py              # (scaffolded) Document schemas
│   │   ├── chat.py                  # (scaffolded) Chat schemas
│   │   ├── comparison.py            # (scaffolded) Comparison schemas
│   │   └── evidence.py              # (scaffolded) Evidence schemas
│   ├── repositories/
│   │   ├── document_repository.py   # (scaffolded) Document DB operations
│   │   ├── citation_repository.py   # (scaffolded) Citation DB operations
│   │   └── qdrant_repository.py     # (scaffolded) Qdrant vector operations
│   └── services/
│       ├── chat/                    # Conversation management, context building, query routing
│       ├── chunking/                # PDF chunking + metadata extraction
│       ├── comparison/              # Drug comparison logic
│       ├── embeddings/              # Embedding service
│       ├── llm/                     # LLM client, answer generation, prompts
│       ├── pdf/                     # PDF extraction, OCR, section detection, table extraction
│       ├── retrieval/               # Hybrid search (semantic + keyword), reranking
│       └── validation/              # Citation, claim, evidence, safety validators
├── tests/
│   ├── test_auth.py                 # (if present) Auth endpoint tests
│   ├── test_chat.py
│   ├── test_chunking.py
│   ├── test_citations.py
│   ├── test_pdf.py
│   ├── test_retrieval.py
│   └── test_validation.py
├── alembic.ini                      # Alembic configuration
├── requirements.txt                 # Python dependencies
└── README.md                        # This file
```

---

## Prerequisites

- **Python 3.11+**
- **MySQL 8.0+** (running locally or accessible via connection string)
- **pip** (or a virtual environment tool like `venv` / `conda`)

---

## Setup & Installation

```bash
# 1. Navigate to the backend directory
cd backend

# 2. Create and activate a virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt
```

---

## Environment Variables

Create a `.env` file in the `backend/` directory (or project root) with the following:

```env
# Application
APP_NAME=MediMei
ENVIRONMENT=development

# MySQL Database
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=MediMei
MYSQL_USER=root
MYSQL_PASSWORD=your_mysql_password

# JWT Settings
JWT_SECRET_KEY=your_secure_secret_key_here
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

> **Warning:** Never commit the `.env` file or the real `JWT_SECRET_KEY` to version control. The fallback key in `config.py` is for development only.

---

## Database Migrations

The project uses **Alembic** for schema migrations. The migration scripts are in `app/db/migrations/`.

```bash
# Make sure your MySQL server is running and the database exists:
# CREATE DATABASE MediMei;

# Run all pending migrations
alembic upgrade head

# Roll back one migration
alembic downgrade -1

# Create a new migration after changing models
alembic revision --autogenerate -m "description_of_change"
```

The initial migration (`ab4774dd04e0_create_users_table`) creates the `users` table with columns: `user_id`, `email`, `hashed_password`, `role`, `created_at`.

---

## Running the Server

```bash
# From the backend/ directory (with venv activated)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Starting Qdrant (Docker)

```bash
docker run -p 6333:6333 -p 6034:6034 -v qdrant_storage:/qdrant/storage qdrant/qdrant
```

The API will be available at:
- **API base:** `http://localhost:8000/api/v1`
- **Health check:** `http://localhost:8000/health`
- **Interactive docs (Swagger):** `http://localhost:8000/docs`
- **Alternative docs (ReDoc):** `http://localhost:8000/redoc`

---

## API Endpoints

### System

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check — returns status, app name, environment |

### Authentication (`/api/v1/auth`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | None | Register a new user. Body: `{ email, password, role? }`. Returns `UserOut`. |
| `POST` | `/api/v1/auth/login` | None | Authenticate and get JWT. Body: `{ email, password }`. Returns `Token { access_token, token_type }`. |
| `GET` | `/api/v1/auth/me` | Bearer JWT | Get the current authenticated user's profile. Returns `UserOut`. |

#### Register

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "securepassword"}'
```

**Response (201):**
```json
{
  "user_id": "uuid-string",
  "email": "user@example.com",
  "role": "user",
  "created_at": "2026-08-14T..."
}
```

**Error (409):** `"A user with this email is already registered."`

#### Login

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "securepassword"}'
```

**Response (200):**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer"
}
```

**Error (401):** `"Incorrect email or password."`

#### Get Me

```bash
curl http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer eyJ..."
```

**Response (200):**
```json
{
  "user_id": "uuid-string",
  "email": "user@example.com",
  "role": "user",
  "created_at": "2026-08-14T..."
}
```

### Future Endpoints (scaffolded, not yet implemented)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/documents` | Upload a drug-label PDF |
| `GET` | `/api/v1/documents` | List user's documents |
| `DELETE` | `/api/v1/documents/{id}` | Delete a document |
| `POST` | `/api/v1/chat` | Ask a question, get a grounded answer + citations |
| `GET` | `/api/v1/citations/{id}` | Get citation detail with source text |
| `POST` | `/api/v1/compare` | Compare two drugs side-by-side |

---

## Authentication Flow

```
1. REGISTER
   POST /api/v1/auth/register { email, password }
   → Backend hashes password (bcrypt), stores User in MySQL
   → Returns UserOut (user_id, email, role, created_at)

2. LOGIN
   POST /api/v1/auth/login { email, password }
   → Backend verifies password against hash
   → Creates JWT with claims: { sub: user_id, role, exp, iat }
   → Returns Token { access_token, token_type: "bearer" }

3. AUTHENTICATED REQUEST
   GET /api/v1/auth/me
   Authorization: Bearer <access_token>
   → get_current_user dependency decodes JWT
   → Looks up User by user_id (sub claim)
   → Returns UserOut

4. TOKEN EXPIRY
   → JWT expires after ACCESS_TOKEN_EXPIRE_MINUTES (default: 30)
   → Frontend auto-logs out when token expires (client-side timer + 401 handling)
```

### Security details

- **Password hashing:** bcrypt via `passlib`
- **JWT:** HS256 signed tokens via `python-jose`
- **Token claims:** `sub` (user_id), `role`, `exp` (expiry), `iat` (issued at)
- **Auth dependency:** `get_current_user` in `app/dependencies/auth.py` — used as a FastAPI `Depends` on protected routes
- **OAuth2 scheme:** `OAuth2PasswordBearer` with token URL at `/api/v1/auth/login`

---

## Architecture Overview

```
Client (React frontend)
    │
    ▼
FastAPI (app/main.py)
    │
    ├── CORS middleware (allows frontend origin)
    ├── /health endpoint
    └── /api/v1 routes (app/api/router.py)
          │
          ├── /auth (auth.py)
          │     ├── register → MySQL (User table)
          │     ├── login → verify password → create JWT
          │     └── me → decode JWT → fetch User
          │
          ├── /documents (documents.py) [scaffolded]
          │     ├── upload → PDF extraction → chunking → embeddings → Qdrant + MySQL
          │     ├── list → MySQL
          │     └── delete → MySQL + Qdrant
          │
          ├── /chat (chat.py) [scaffolded]
          │     └── ask → embed query → hybrid search (Qdrant) → rerank → LLM → validate citations → response
          │
          ├── /citations (citations.py) [scaffolded]
          │     └── get → MySQL (Citation table) → source text + page
          │
          └── /compare (compare.py) [scaffolded]
                └── compare → retrieve both drugs → LLM comparison → response

Dependencies:
  ├── MySQL (users, documents, chunks, chats, citations)
  ├── Qdrant (vector embeddings for semantic search)
  ├── Sentence-Transformers (embedding model)
  └── LLM (answer generation)
```

### Layered design

- **Routes** (`app/api/routes/`) — HTTP handlers, request/response schemas
- **Dependencies** (`app/dependencies/`) — shared FastAPI dependencies (auth, DB, clients)
- **Services** (`app/services/`) — business logic (PDF, chunking, retrieval, LLM, validation)
- **Repositories** (`app/repositories/`) — data access layer (MySQL + Qdrant)
- **Models** (`app/models/`) — SQLAlchemy ORM models
- **Schemas** (`app/schemas/`) — Pydantic request/response models
- **Core** (`app/core/`) — config, security, logging

---

## Testing

```bash
# Run all tests
pytest

# Run a specific test file
pytest tests/test_chat.py

# Run with verbose output
pytest -v
```

Tests use `pytest-asyncio` for async test support.

---

## Frontend Integration

The frontend (`frontend/`) connects to this backend via:

- **Base URL:** `http://localhost:8000` (configurable via `VITE_API_URL` env var)
- **API client:** `frontend/src/api/client.ts` — wraps `fetch()`, attaches `Authorization: Bearer <token>` header from localStorage, handles 401 responses with auto-logout
- **Auth API:** `frontend/src/api/auth.ts` — `loginRequest()`, `registerRequest()`, `getMeRequest()`
- **Auth context:** `frontend/src/contexts/AuthContext.tsx` — manages user state, token storage, auto-logout on JWT expiry

### CORS

The backend allows all origins in development (`allow_origins=["*"]`). For production, restrict this to your frontend's domain in `app/main.py`.

---

## Notes

- The `documents`, `chat`, `citations`, and `compare` route files are currently empty — they are scaffolded for the next implementation phase.
- The `services/` directory contains the planned architecture for PDF processing, chunking, embeddings, retrieval, LLM answer generation, and validation. These modules need to be wired to the route handlers.
- Qdrant and the embedding/LLM models need to be running and configured before the chat/document endpoints can work.
