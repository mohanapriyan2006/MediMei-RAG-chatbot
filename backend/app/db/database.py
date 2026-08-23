from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from app.core.config import settings

def get_db_url() -> str:
    if settings.DATABASE_URL:
        return settings.DATABASE_URL
    password_part = f":{settings.MYSQL_PASSWORD}" if settings.MYSQL_PASSWORD else ""
    return f"mysql+asyncmy://{settings.MYSQL_USER}{password_part}@{settings.MYSQL_HOST}:{settings.MYSQL_PORT}/{settings.MYSQL_DATABASE}"

DB_URL = get_db_url()
is_sqlite = DB_URL.startswith("sqlite")

# Create async engine and sessionmaker
engine = create_async_engine(
    DB_URL,
    echo=True if settings.ENVIRONMENT == "development" else False,
    pool_pre_ping=not is_sqlite,
    connect_args={"check_same_thread": False} if is_sqlite else {}
)

async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

Base = declarative_base()

async def get_db_session() -> AsyncSession:
    """Dependency helper to yield an asynchronous database session."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
