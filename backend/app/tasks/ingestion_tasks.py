"""
Celery ingestion task'lari.
IngestionPipeline async metodlarini Celery task olarak sarar.
"""

import asyncio
import json
import structlog

from app.worker import celery_app

logger = structlog.get_logger()

REDIS_CHANNEL = "ingestion_events"


def _publish_progress(state: dict):
    """Redis pub/sub ile progress event yayinla."""
    try:
        import redis as sync_redis
        from app.config import get_settings

        settings = get_settings()
        r = sync_redis.from_url(settings.celery_broker_url)
        r.publish(REDIS_CHANNEL, json.dumps(state, ensure_ascii=False, default=str))
        r.close()
    except Exception as e:
        logger.warning("redis_publish_failed", error=str(e))


def _create_pipeline():
    """Lazy pipeline olustur — worker process icinde."""
    from app.config import get_settings
    from app.services.yargi import YargiService
    from app.services.vector_store import VectorStoreService
    from app.services.embedding import EmbeddingService
    from app.services.cache import CacheService
    from app.ingestion.ingest import IngestionPipeline

    settings = get_settings()
    cache = CacheService(settings.redis_url)
    yargi = YargiService(cache=cache)
    vector_store = VectorStoreService()
    embedding = EmbeddingService()

    return IngestionPipeline(yargi, vector_store, embedding)


@celery_app.task(bind=True, name="app.tasks.ingestion_tasks.ingest_topics_task")
def ingest_topics_task(self, topics: list[str], pages_per_topic: int = 3):
    """Ictihat ingestion — Bedesten API uzerinden konu bazli."""
    task_id = self.request.id
    logger.info("celery_ingest_topics_start", task_id=task_id, topics=len(topics))

    self.update_state(state="PROGRESS", meta={
        "source": "bedesten",
        "total_topics": len(topics),
        "completed_topics": 0,
        "progress_pct": 0,
    })
    _publish_progress({
        "task_id": task_id,
        "state": "STARTED",
        "source": "bedesten",
        "total_topics": len(topics),
    })

    pipeline = _create_pipeline()

    async def _run():
        return await pipeline.ingest_topics(topics=topics, pages_per_topic=pages_per_topic)

    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(_run())
        finally:
            loop.close()
        _publish_progress({
            "task_id": task_id,
            "state": "SUCCESS",
            "source": "bedesten",
            "result": result,
        })
        logger.info("celery_ingest_topics_done", task_id=task_id, result=result)
        return result
    except Exception as exc:
        _publish_progress({
            "task_id": task_id,
            "state": "FAILURE",
            "source": "bedesten",
            "error": str(exc),
        })
        logger.error("celery_ingest_topics_error", task_id=task_id, error=str(exc))
        raise


@celery_app.task(bind=True, name="app.tasks.ingestion_tasks.ingest_aym_task")
def ingest_aym_task(self, pages: int = 10, ihlal_only: bool = True):
    """AYM bireysel basvuru kararlari ingestion."""
    task_id = self.request.id
    logger.info("celery_ingest_aym_start", task_id=task_id, pages=pages)

    self.update_state(state="PROGRESS", meta={
        "source": "aym",
        "pages": pages,
        "progress_pct": 0,
    })
    _publish_progress({
        "task_id": task_id,
        "state": "STARTED",
        "source": "aym",
    })

    pipeline = _create_pipeline()

    async def _run():
        return await pipeline.ingest_aym(pages=pages, ihlal_only=ihlal_only)

    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(_run())
        finally:
            loop.close()
        _publish_progress({
            "task_id": task_id,
            "state": "SUCCESS",
            "source": "aym",
            "result": result,
        })
        logger.info("celery_ingest_aym_done", task_id=task_id, result=result)
        return result
    except Exception as exc:
        _publish_progress({
            "task_id": task_id,
            "state": "FAILURE",
            "source": "aym",
            "error": str(exc),
        })
        logger.error("celery_ingest_aym_error", task_id=task_id, error=str(exc))
        raise


@celery_app.task(bind=True, name="app.tasks.ingestion_tasks.ingest_aihm_task")
def ingest_aihm_task(self, max_results: int = 500):
    """AIHM Turkiye aleyhine kararlari ingestion."""
    task_id = self.request.id
    logger.info("celery_ingest_aihm_start", task_id=task_id, max_results=max_results)

    self.update_state(state="PROGRESS", meta={
        "source": "aihm",
        "max_results": max_results,
        "progress_pct": 0,
    })
    _publish_progress({
        "task_id": task_id,
        "state": "STARTED",
        "source": "aihm",
    })

    pipeline = _create_pipeline()

    async def _run():
        return await pipeline.ingest_aihm(max_results=max_results, turkish_only=False)

    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(_run())
        finally:
            loop.close()
        _publish_progress({
            "task_id": task_id,
            "state": "SUCCESS",
            "source": "aihm",
            "result": result,
        })
        logger.info("celery_ingest_aihm_done", task_id=task_id, result=result)
        return result
    except Exception as exc:
        _publish_progress({
            "task_id": task_id,
            "state": "FAILURE",
            "source": "aihm",
            "error": str(exc),
        })
        logger.error("celery_ingest_aihm_error", task_id=task_id, error=str(exc))
        raise
