try:
    import torch
except ImportError:
    pass

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, status, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.api.router import api_router
from app.core.config import settings
from app.db.database import Base, engine

# Import all models so Base.metadata knows about every table
from app.models import user, document, chat, chunk, citation, document_page, memory
from sqlalchemy import text


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.ENVIRONMENT != "test":
        # Automatically create the database if it doesn't exist
        try:
            from sqlalchemy.ext.asyncio import create_async_engine as create_temp_engine
            server_url = f"mysql+asyncmy://{settings.MYSQL_USER}:{settings.MYSQL_PASSWORD}@{settings.MYSQL_HOST}:{settings.MYSQL_PORT}/"
            temp_engine = create_temp_engine(server_url)
            async with temp_engine.connect() as conn:
                await conn.execute(text(f"CREATE DATABASE IF NOT EXISTS {settings.MYSQL_DATABASE}"))
                logger.info(f"Database: Ensured database '{settings.MYSQL_DATABASE}' exists.")
            await temp_engine.dispose()
        except Exception as e:
            logger.warning(f"Database auto-creation check failed: {e}")

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            
            # Dynamic check/migration for memory_enabled column on users table
            try:
                result = await conn.execute(text("SHOW COLUMNS FROM users LIKE 'memory_enabled'"))
                column_exists = result.fetchone() is not None
                if not column_exists:
                    await conn.execute(text("ALTER TABLE users ADD COLUMN memory_enabled BOOLEAN NOT NULL DEFAULT TRUE"))
                    logger.info("Database: Added memory_enabled column to users table.")
                
                # Check for memories_updated column on messages table
                result_up = await conn.execute(text("SHOW COLUMNS FROM messages LIKE 'memories_updated'"))
                if result_up.fetchone() is None:
                    await conn.execute(text("ALTER TABLE messages ADD COLUMN memories_updated TEXT NULL"))
                    logger.info("Database: Added memories_updated column to messages table.")
                
                # Check for memories_used column on messages table
                result_usd = await conn.execute(text("SHOW COLUMNS FROM messages LIKE 'memories_used'"))
                if result_usd.fetchone() is None:
                    await conn.execute(text("ALTER TABLE messages ADD COLUMN memories_used TEXT NULL"))
                    logger.info("Database: Added memories_used column to messages table.")

                # Check for text and score columns on citations table
                result_cit_text = await conn.execute(text("SHOW COLUMNS FROM citations LIKE 'text'"))
                if result_cit_text.fetchone() is None:
                    await conn.execute(text("ALTER TABLE citations ADD COLUMN text TEXT NULL"))
                    logger.info("Database: Added text column to citations table.")

                result_cit_score = await conn.execute(text("SHOW COLUMNS FROM citations LIKE 'score'"))
                if result_cit_score.fetchone() is None:
                    await conn.execute(text("ALTER TABLE citations ADD COLUMN score FLOAT NULL"))
                    logger.info("Database: Added score column to citations table.")

                # Check for citations and is_default columns on user_memories table
                result_mem_cit = await conn.execute(text("SHOW COLUMNS FROM user_memories LIKE 'citations'"))
                if result_mem_cit.fetchone() is None:
                    await conn.execute(text("ALTER TABLE user_memories ADD COLUMN citations TEXT NULL"))
                    logger.info("Database: Added citations column to user_memories table.")

                result_mem_def = await conn.execute(text("SHOW COLUMNS FROM user_memories LIKE 'is_default'"))
                if result_mem_def.fetchone() is None:
                    await conn.execute(text("ALTER TABLE user_memories ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT FALSE"))
                    logger.info("Database: Added is_default column to user_memories table.")

                # Check for stage column on documents table
                result_doc_stage = await conn.execute(text("SHOW COLUMNS FROM documents LIKE 'stage'"))
                if result_doc_stage.fetchone() is None:
                    await conn.execute(text("ALTER TABLE documents ADD COLUMN stage VARCHAR(100) NULL"))
                    logger.info("Database: Added stage column to documents table.")

                # Check for progress column on documents table
                result_doc_progress = await conn.execute(text("SHOW COLUMNS FROM documents LIKE 'progress'"))
                if result_doc_progress.fetchone() is None:
                    await conn.execute(text("ALTER TABLE documents ADD COLUMN progress INT NOT NULL DEFAULT 0"))
                    logger.info("Database: Added progress column to documents table.")

                # Check for progress_detail column on documents table
                result_doc_detail = await conn.execute(text("SHOW COLUMNS FROM documents LIKE 'progress_detail'"))
                if result_doc_detail.fetchone() is None:
                    await conn.execute(text("ALTER TABLE documents ADD COLUMN progress_detail TEXT NULL"))
                    logger.info("Database: Added progress_detail column to documents table.")
            except Exception as ex:
                logger.warning(f"Database dynamic migration warning: {ex}")
    yield


# Configure logging
logging.basicConfig(
    level=logging.INFO if settings.ENVIRONMENT == "development" else logging.WARNING,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.APP_NAME,
    description="MediMei: Evidence-First Drug Information Q&A Chatbot Backend",
    version="1.0.0",
    lifespan=lifespan,
)

# Set CORS origins (explicit origins and regex required for credentialed requests)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://medimei.vercel.app",
        "https://medimei-chatbot.vercel.app",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:[0-9]+)?|https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", status_code=status.HTTP_200_OK, tags=["system"])
async def health_check():
    """Health check endpoint to verify backend operational status."""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "environment": settings.ENVIRONMENT
    }

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global unhandled exception on {request.url.path}: {exc}", exc_info=True)
    origin = request.headers.get("origin") or "*"
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal Server Error: {str(exc)}"},
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

# Include all aggregated API v1 routes
app.include_router(api_router, prefix="/api/v1")

