from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "MediMei"
    ENVIRONMENT: str = "development"

    # Database Settings
    DATABASE_URL: Optional[str] = None
    MYSQL_HOST: str = "localhost"
    MYSQL_PORT: int = 3306
    MYSQL_DATABASE: str = "MediMei"
    MYSQL_USER: str = "root"
    MYSQL_PASSWORD: str = ""

    # JWT Settings
    JWT_SECRET_KEY: str = "supersecretkeychangeinproduction1234567890"  # Fallback secret
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Qdrant Vector DB Settings
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: Optional[str] = None
    QDRANT_COLLECTION: str = "drug_documents"

    # Embedding runtime settings
    EMBEDDING_DEVICE: Optional[str] = None  # "cuda", "cpu", or auto-detect
    EMBEDDING_BATCH_SIZE: int = 32

    # Cloudflare R2 Settings
    R2_ENDPOINT_URL: Optional[str] = None
    R2_ACCESS_KEY_ID: Optional[str] = None
    R2_SECRET_ACCESS_KEY: Optional[str] = None
    R2_BUCKET_NAME: Optional[str] = None

    # ML & LLM Settings
    EMBEDDING_MODEL: str = "BAAI/bge-m3"
    LLM_MODEL: str = "Qwen/Qwen3.5-4B"
    LLM_MODEL_PATH: Optional[str] = "data/models/llm/qwen-3.5-4B-Q4_K_M.gguf"

    # Qwen generation parameters
    LLM_DEVICE: Optional[str] = None  # "cuda", "cpu", or auto
    LLM_N_CTX: int = 8192
    LLM_N_GPU_LAYERS: int = -1
    LLM_TEMPERATURE: float = 0.1
    LLM_MAX_NEW_TOKENS: int = 2048
    LLM_MAX_INPUT_TOKENS: int = 3072

    # Local vs API LLM toggle
    USE_LOCAL_LLM: bool = False

    # API Provider keys
    GROQ_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    OPENROUTER_API_KEY: Optional[str] = None

    # API Provider model IDs
    GROQ_MODEL: str = "llama-3.1-8b-instant"
    GEMINI_MODEL: str = "gemini-1.5-flash"
    OPENROUTER_MODEL: str = "meta-llama/llama-3.1-8b-instant"

    # RAG Settings
    TOP_K: int = 8
    MIN_RELEVANCE_SCORE: float = 0.20
    MAX_UPLOAD_SIZE_MB: int = 50
    ENABLE_RERANKING: bool = True
    RERANK_CANDIDATES_LIMIT: int = 25

    # Pydantic Settings Config
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
