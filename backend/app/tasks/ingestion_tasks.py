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
    cache = CacheService()
    yargi = YargiService(cache=cache)
    vector_store = VectorStoreService()
    embedding = EmbeddingService()

    return IngestionPipeline(yargi, vector_store, embedding)


@celery_app.task(
    bind=True,
    name="app.tasks.ingestion_tasks.ingest_topics_task",
    autoretry_for=(Exception,),
    max_retries=3,
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True,
)
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


@celery_app.task(
    bind=True,
    name="app.tasks.ingestion_tasks.ingest_aym_task",
    autoretry_for=(Exception,),
    max_retries=3,
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True,
)
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


@celery_app.task(
    bind=True,
    name="app.tasks.ingestion_tasks.ingest_aihm_task",
    autoretry_for=(Exception,),
    max_retries=3,
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True,
)
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


@celery_app.task(
    bind=True,
    name="app.tasks.ingestion_tasks.ingest_mevzuat_task",
    autoretry_for=(Exception,),
    max_retries=3,
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True,
)
def ingest_mevzuat_task(self):
    """Mevzuat ingestion — 24 temel kanun, madde bazli chunking."""
    task_id = self.request.id
    logger.info("celery_ingest_mevzuat_start", task_id=task_id)

    self.update_state(state="PROGRESS", meta={
        "source": "mevzuat",
        "progress_pct": 0,
    })
    _publish_progress({
        "task_id": task_id,
        "state": "STARTED",
        "source": "mevzuat",
    })

    pipeline = _create_pipeline()

    async def _run():
        return await pipeline.ingest_mevzuat()

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
            "source": "mevzuat",
            "result": result,
        })
        logger.info("celery_ingest_mevzuat_done", task_id=task_id, result=result)
        return result
    except Exception as exc:
        _publish_progress({
            "task_id": task_id,
            "state": "FAILURE",
            "source": "mevzuat",
            "error": str(exc),
        })
        logger.error("celery_ingest_mevzuat_error", task_id=task_id, error=str(exc))
        raise


@celery_app.task(
    bind=True,
    name="app.tasks.ingestion_tasks.ingest_batch_task",
    autoretry_for=(Exception,),
    max_retries=3,
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True,
)
def ingest_batch_task(
    self,
    include_ictihat: bool = True,
    include_mevzuat: bool = True,
    include_aym: bool = True,
    include_aihm: bool = True,
):
    """Toplu ingestion — tum kaynaklari sirayla calistir."""
    task_id = self.request.id
    logger.info("celery_ingest_batch_start", task_id=task_id)

    self.update_state(state="PROGRESS", meta={
        "source": "batch",
        "progress_pct": 0,
    })
    _publish_progress({
        "task_id": task_id,
        "state": "STARTED",
        "source": "batch",
    })

    pipeline = _create_pipeline()

    async def _run():
        return await pipeline.ingest_batch(
            include_ictihat=include_ictihat,
            include_mevzuat=include_mevzuat,
            include_aym=include_aym,
            include_aihm=include_aihm,
        )

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
            "source": "batch",
            "result": result,
        })
        logger.info("celery_ingest_batch_done", task_id=task_id, result=result)
        return result
    except Exception as exc:
        _publish_progress({
            "task_id": task_id,
            "state": "FAILURE",
            "source": "batch",
            "error": str(exc),
        })
        logger.error("celery_ingest_batch_error", task_id=task_id, error=str(exc))
        raise


@celery_app.task(
    bind=True,
    name="app.tasks.ingestion_tasks.ingest_daire_task",
    autoretry_for=(Exception,),
    max_retries=3,
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True,
)
def ingest_daire_task(self, court_type: str = "yargitay", daire_id: str | None = None, pages: int = 10):
    """Daire bazli sistematik ictihat ingestion."""
    task_id = self.request.id
    logger.info("celery_ingest_daire_start", task_id=task_id, court_type=court_type, daire_id=daire_id)

    self.update_state(state="PROGRESS", meta={
        "source": "daire",
        "court_type": court_type,
        "daire_id": daire_id,
        "progress_pct": 0,
    })
    _publish_progress({
        "task_id": task_id,
        "state": "STARTED",
        "source": "daire",
        "court_type": court_type,
        "daire_id": daire_id,
    })

    pipeline = _create_pipeline()

    async def _run():
        return await pipeline.ingest_by_daire(court_type=court_type, daire_id=daire_id, pages=pages)

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
            "source": "daire",
            "result": result,
        })
        logger.info("celery_ingest_daire_done", task_id=task_id, result=result)
        return result
    except Exception as exc:
        _publish_progress({
            "task_id": task_id,
            "state": "FAILURE",
            "source": "daire",
            "error": str(exc),
        })
        logger.error("celery_ingest_daire_error", task_id=task_id, error=str(exc))
        raise


@celery_app.task(
    bind=True,
    name="app.tasks.ingestion_tasks.ingest_date_range_task",
    autoretry_for=(Exception,),
    max_retries=3,
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True,
)
def ingest_date_range_task(self, start_date: str, end_date: str, court_types: list[str] | None = None, max_pages: int = 50):
    """Tarih bazli sistematik ictihat ingestion."""
    task_id = self.request.id
    logger.info("celery_ingest_date_range_start", task_id=task_id, start_date=start_date, end_date=end_date)

    self.update_state(state="PROGRESS", meta={
        "source": "date_range",
        "start_date": start_date,
        "end_date": end_date,
        "progress_pct": 0,
    })
    _publish_progress({
        "task_id": task_id,
        "state": "STARTED",
        "source": "date_range",
        "start_date": start_date,
        "end_date": end_date,
    })

    pipeline = _create_pipeline()

    async def _run():
        return await pipeline.ingest_by_date_range(start_date=start_date, end_date=end_date, court_types=court_types, max_pages=max_pages)

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
            "source": "date_range",
            "result": result,
        })
        logger.info("celery_ingest_date_range_done", task_id=task_id, result=result)
        return result
    except Exception as exc:
        _publish_progress({
            "task_id": task_id,
            "state": "FAILURE",
            "source": "date_range",
            "error": str(exc),
        })
        logger.error("celery_ingest_date_range_error", task_id=task_id, error=str(exc))
        raise
