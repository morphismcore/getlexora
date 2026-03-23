"""
Gunluk otomatik ingestion scheduler.
APScheduler ile her gun 03:00 (Istanbul) calisir.
"""

import structlog

logger = structlog.get_logger()

_scheduler = None


async def start_scheduler():
    """Scheduler'i baslat."""
    global _scheduler

    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.cron import CronTrigger
    except ImportError:
        logger.warning("apscheduler_not_installed", msg="pip install apscheduler ile yukleyin")
        return

    _scheduler = AsyncIOScheduler()

    _scheduler.add_job(
        _run_incremental,
        trigger=CronTrigger(hour=3, minute=0, timezone="Europe/Istanbul"),
        id="daily_ingestion",
        name="Gunluk otomatik ingestion",
        replace_existing=True,
    )

    _scheduler.start()
    logger.info("scheduler_started", job="daily_ingestion", schedule="03:00 Istanbul")


async def stop_scheduler():
    """Scheduler'i durdur."""
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        logger.info("scheduler_stopped")


async def _run_incremental():
    """Incremental ingestion calistir (scheduler tarafindan cagrilir)."""
    import redis.asyncio as aioredis
    from app.config import get_settings

    settings = get_settings()

    # Redis distributed lock -- tek worker calissin
    try:
        redis_client = aioredis.from_url(settings.redis_url)
        lock = redis_client.lock("ingestion_lock", timeout=3600)

        if not await lock.acquire(blocking=False):
            logger.info("incremental_skipped", reason="another worker running")
            await redis_client.aclose()
            return

        try:
            from app.services.yargi import YargiService
            from app.services.vector_store import VectorStoreService
            from app.services.embedding import EmbeddingService
            from app.services.cache import CacheService
            from app.ingestion.incremental import IncrementalIngestion

            cache = CacheService(settings.redis_url)
            yargi = YargiService(cache=cache)
            vector_store = VectorStoreService()
            embedding = EmbeddingService()

            pipeline = IncrementalIngestion(yargi, vector_store, embedding)
            result = await pipeline.run_incremental()

            logger.info("scheduled_ingestion_complete", **result)

            await yargi.close()
            await vector_store.close()
        finally:
            await lock.release()
            await redis_client.aclose()

    except Exception as e:
        logger.error("scheduled_ingestion_error", error=str(e))
