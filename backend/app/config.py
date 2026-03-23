from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    env: str = "development"
    log_level: str = "INFO"
    app_name: str = "Lexora"

    # Anthropic
    anthropic_api_key: str = ""

    # Qdrant
    qdrant_host: str = "localhost"
    qdrant_port: int = 6333
    qdrant_collection_ictihat: str = "ictihat_embeddings"
    qdrant_collection_mevzuat: str = "mevzuat_embeddings"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Postgres
    database_url: str = "postgresql+asyncpg://lexora:lexora_dev_2026@localhost:5432/lexora"

    # JWT Auth
    jwt_secret: str = "lexora-dev-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 24

    # Embedding (POC: lightweight model, production: BAAI/bge-m3)
    embedding_model: str = "BAAI/bge-m3"
    embedding_dim: int = 1024

    # Bedesten API (yargi-mcp source)
    bedesten_base_url: str = "https://bedesten.adalet.gov.tr"

    # Mevzuat API
    mevzuat_base_url: str = "https://www.mevzuat.gov.tr"

    # UYAP Emsal
    emsal_base_url: str = "https://emsal.uyap.gov.tr"

    # RAG
    rag_top_k: int = 20
    rag_rerank_top_k: int = 5
    rag_min_relevance: float = 0.4

    # Ingestion thresholds
    min_karar_chars: int = 300
    max_payload_text_chars: int = 3000
    max_ozet_chars: int = 500

    # CORS
    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
