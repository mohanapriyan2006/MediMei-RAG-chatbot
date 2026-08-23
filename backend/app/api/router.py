from fastapi import APIRouter
from app.api.routes import documents, chat, compare, citations, search, auth, memories, tasks

api_router = APIRouter()

# Register search/retrieval endpoints
api_router.include_router(search.router, prefix="/search")

# Register documents endpoints
api_router.include_router(documents.router, prefix="/documents")

# Register chat endpoints
api_router.include_router(chat.router, prefix="/chat")

# Register chat sessions endpoints
api_router.include_router(chat.sessions_router, prefix="/sessions")

# Register citations endpoints
api_router.include_router(citations.router, prefix="/citations")

# Register drug comparison endpoints
api_router.include_router(compare.router, prefix="/compare")

# Register user memories endpoints
api_router.include_router(memories.router, prefix="/memories")

# Register task control endpoints
api_router.include_router(tasks.router, prefix="/tasks")

# Register authentication endpoints
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
