import asyncio
import logging
from sqlalchemy.ext.asyncio import create_async_engine
from app.db.database import Base
from app.core.config import settings

# Import all models to ensure they are registered on Base.metadata
from app.models.user import User
from app.models.document import Document
from app.models.document_page import DocumentPage
from app.models.chunk import Chunk
from app.models.chat import ChatSession, ChatMessage
from app.models.citation import Citation

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def init_db():
    db_url = settings.DATABASE_URL
    if not db_url:
        password_part = f":{settings.MYSQL_PASSWORD}" if settings.MYSQL_PASSWORD else ""
        base_url = f"mysql+asyncmy://{settings.MYSQL_USER}{password_part}@{settings.MYSQL_HOST}:{settings.MYSQL_PORT}/"
        db_url = f"{base_url}{settings.MYSQL_DATABASE}"
        
        logger.info(f"Connecting to MySQL server to check/create database: {settings.MYSQL_DATABASE}")
        try:
            from sqlalchemy import text
            engine = create_async_engine(base_url, echo=False)
            async with engine.connect() as conn:
                await conn.execute(text(f"CREATE DATABASE IF NOT EXISTS {settings.MYSQL_DATABASE};"))
                await conn.commit()
            await engine.dispose()
            logger.info(f"Database '{settings.MYSQL_DATABASE}' is verified. Creating tables...")
        except Exception as e:
            logger.warning(f"Could not connect to MySQL ({e}). Falling back to local SQLite database.")
            db_url = "sqlite+aiosqlite:///./labelproof.db"

    is_sqlite = db_url.startswith("sqlite")
    connect_args = {"check_same_thread": False} if is_sqlite else {}
    
    logger.info(f"Initializing database tables using URL: {db_url}")
    engine = create_async_engine(db_url, echo=True, connect_args=connect_args)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    
    logger.info("Database and table initialization complete!")

if __name__ == "__main__":
    asyncio.run(init_db())
