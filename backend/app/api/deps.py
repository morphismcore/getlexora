"""
FastAPI dependency injection.
LLM opsiyonel — API key yoksa arama yine çalışır, sadece ask/RAG çalışmaz.
"""

import uuid
import structlog
import jwt
from fastapi import Header, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.database import User
from app.models.db import get_db
from app.core.rag import RAGPipeline
from app.services.cache import CacheService
from app.services.yargi import YargiService
from app.services.mevzuat import MevzuatService
from app.services.vector_store import VectorStoreService
from app.services.embedding import EmbeddingService
from app.services.citation_verifier import CitationVerifierService
from app.services.query_expansion import QueryExpansionService
from app.services.reranker import RerankerService
from app.ingestion.ingest import IngestionPipeline

logger = structlog.get_logger()

# Singleton instances
_cache: CacheService | None = None
_yargi: YargiService | None = None
_mevzuat: MevzuatService | None = None
_vector_store: VectorStoreService | None = None
_embedding: EmbeddingService | None = None
_llm = None
_verifier: CitationVerifierService | None = None
_query_expander: QueryExpansionService | None = None
_reranker: RerankerService | None = None
_rag: RAGPipeline | None = None
_ingestion: IngestionPipeline | None = None


def get_cache_service() -> CacheService | None:
    """Redis cache servisi — Redis yoksa None döner."""
    global _cache
    if _cache is None:
        try:
            _cache = CacheService()
            logger.info("cache_initialized")
        except Exception as e:
            logger.warning("cache_init_failed", error=str(e), hint="Redis bağlantısı kurulamadı, cache devre dışı")
            _cache = None
    return _cache


def get_yargi_service() -> YargiService:
    global _yargi
    if _yargi is None:
        _yargi = YargiService(cache=get_cache_service())
    return _yargi


def get_mevzuat_service() -> MevzuatService:
    global _mevzuat
    if _mevzuat is None:
        _mevzuat = MevzuatService(cache=get_cache_service())
    return _mevzuat


def get_vector_store() -> VectorStoreService:
    global _vector_store
    if _vector_store is None:
        _vector_store = VectorStoreService()
    return _vector_store


def get_embedding_service() -> EmbeddingService:
    global _embedding
    if _embedding is None:
        _embedding = EmbeddingService()
    return _embedding


def get_llm_service():
    """LLM servisi — API key yoksa None döner."""
    global _llm
    if _llm is None:
        settings = get_settings()
        if settings.anthropic_api_key and settings.anthropic_api_key != "sk-ant-...":
            from app.core.llm import LLMService
            _llm = LLMService()
            logger.info("llm_initialized", model="claude-sonnet-4-6")
        else:
            logger.warning("llm_not_configured", hint="ANTHROPIC_API_KEY ayarlanmamış, arama çalışır ama RAG/ask çalışmaz")
    return _llm


def get_citation_verifier() -> CitationVerifierService:
    global _verifier
    if _verifier is None:
        _verifier = CitationVerifierService(
            yargi=get_yargi_service(),
            mevzuat=get_mevzuat_service(),
            cache=get_cache_service(),
        )
    return _verifier


def get_query_expander() -> QueryExpansionService:
    """Türkçe hukuk query expansion servisi."""
    global _query_expander
    if _query_expander is None:
        settings = get_settings()
        if settings.query_expansion_enabled:
            _query_expander = QueryExpansionService()
            logger.info("query_expander_initialized")
        else:
            logger.info("query_expansion_disabled")
    return _query_expander


def get_reranker() -> RerankerService | None:
    """Cross-encoder reranking servisi — devre dışıysa None döner."""
    global _reranker
    if _reranker is None:
        settings = get_settings()
        if settings.reranking_enabled:
            try:
                _reranker = RerankerService(
                    model_name=settings.reranking_model,
                    enabled=True,
                )
                logger.info("reranker_initialized", model=settings.reranking_model)
            except Exception as e:
                logger.warning("reranker_init_failed", error=str(e))
                _reranker = None
        else:
            logger.info("reranking_disabled")
    return _reranker


def get_rag_pipeline() -> RAGPipeline:
    global _rag
    if _rag is None:
        _rag = RAGPipeline(
            yargi=get_yargi_service(),
            mevzuat=get_mevzuat_service(),
            vector_store=get_vector_store(),
            embedding=get_embedding_service(),
            verifier=get_citation_verifier(),
            llm=get_llm_service(),  # None olabilir
            query_expander=get_query_expander(),
            reranker=get_reranker(),
        )
    return _rag


def get_ingestion_pipeline() -> IngestionPipeline:
    global _ingestion
    if _ingestion is None:
        _ingestion = IngestionPipeline(
            yargi=get_yargi_service(),
            vector_store=get_vector_store(),
            embedding=get_embedding_service(),
        )
    return _ingestion


async def get_optional_user(
    authorization: str | None = Header(None),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Opsiyonel auth — token yoksa None döner, varsa kullanıcıyı çözer."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        settings = get_settings()
        token = authorization.split(" ", 1)[1]
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id = uuid.UUID(payload["sub"])
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user and user.is_active:
            return user
    except Exception:
        pass
    return None


async def cleanup():
    """Shutdown'da kaynakları temizle."""
    if _yargi:
        await _yargi.close()
    if _mevzuat:
        await _mevzuat.close()
    if _vector_store:
        await _vector_store.close()
    if _cache:
        await _cache.close()
