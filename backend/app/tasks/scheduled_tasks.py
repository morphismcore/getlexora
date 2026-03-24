"""
Celery zamanlanmis gorevler.
Celery Beat tarafindan tetiklenir.
"""

import asyncio
import structlog

from app.worker import celery_app

logger = structlog.get_logger()


@celery_app.task(bind=True, name="app.tasks.scheduled_tasks.daily_incremental")
def daily_incremental(self):
    """Gunluk incremental ingestion — Celery Beat ile 03:00'te calisir."""
    task_id = self.request.id
    logger.info("daily_incremental_start", task_id=task_id)

    async def _run():
        import redis.asyncio as aioredis
        from app.config import get_settings
        from app.services.yargi import YargiService
        from app.services.vector_store import VectorStoreService
        from app.services.embedding import EmbeddingService
        from app.services.cache import CacheService
        from app.ingestion.incremental import IncrementalIngestion

        settings = get_settings()

        # Redis distributed lock — tek worker calissin
        redis_client = aioredis.from_url(settings.redis_url)
        lock = redis_client.lock("ingestion_lock", timeout=3600)

        if not await lock.acquire(blocking=False):
            logger.info("incremental_skipped", reason="another worker running")
            await redis_client.aclose()
            return {"status": "skipped", "reason": "lock_held"}

        try:
            cache = CacheService(settings.redis_url)
            yargi = YargiService(cache=cache)
            vector_store = VectorStoreService()
            embedding = EmbeddingService()

            pipeline = IncrementalIngestion(yargi, vector_store, embedding)
            result = await pipeline.run_incremental()

            logger.info("scheduled_ingestion_complete", **result)
            await yargi.close()
            await vector_store.close()
            return result
        finally:
            await lock.release()
            await redis_client.aclose()

    try:
        result = asyncio.run(_run())
        logger.info("daily_incremental_done", task_id=task_id, result=result)
        return result
    except Exception as exc:
        logger.error("daily_incremental_error", task_id=task_id, error=str(exc))
        raise
