"""
Celery ingestion task'lari.
IngestionPipeline async metodlarini Celery task olarak sarar.
"""

import asyncio
import json
from datetime import datetime
import structlog

from app.worker import celery_app

logger = structlog.get_logger()

REDIS_CHANNEL = "ingestion_events"


def _on_task_failure(self, exc, task_id, args, kwargs, einfo):
    """Log failed tasks to Redis dead letter queue for monitoring after all retries exhausted."""
    try:
        import redis as sync_redis
        from app.config import get_settings
        settings = get_settings()
        r = sync_redis.from_url(settings.celery_broker_url, socket_timeout=2)
        failure_data = json.dumps({
            "task_id": task_id,
            "task_name": self.name,
            "error": str(exc),
            "args": str(args)[:500],
            "timestamp": str(datetime.now()),
        }, ensure_ascii=False, default=str)
        r.lpush("celery:dead_letters", failure_data)
        r.ltrim("celery:dead_letters", 0, 99)  # Keep last 100 failures
        r.close()
        logger.error("celery_task_dead_letter", task_id=task_id, task_name=self.name, error=str(exc))
    except Exception as e:
        logger.warning("dead_letter_log_failed", error=str(e))


class LexoraTask(celery_app.Task):
    """Base task class with dead letter queue logging on failure."""
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        _on_task_failure(self, exc, task_id, args, kwargs, einfo)


def _publish_progress(state: dict):
    """Redis pub/sub ile progress event yayinla."""
    try:
        import redis as sync_redis
        from app.config import get_settings

        settings = get_settings()
        r = sync_redis.from_url(settings.redis_url)
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
    base=LexoraTask,
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
    base=LexoraTask,
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
    base=LexoraTask,
    name="app.tasks.ingestion_tasks.ingest_rekabet_task",
    autoretry_for=(Exception,),
    max_retries=3,
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True,
    time_limit=14400,
    soft_time_limit=13800,
)
def ingest_rekabet_task(self, max_pages: int = 1100):
    """Rekabet Kurumu kararlari ingestion."""
    task_id = self.request.id
    logger.info("celery_ingest_rekabet_start", task_id=task_id, max_pages=max_pages)

    self.update_state(state="PROGRESS", meta={
        "source": "rekabet",
        "max_pages": max_pages,
        "progress_pct": 0,
    })
    _publish_progress({
        "task_id": task_id,
        "state": "STARTED",
        "source": "rekabet",
    })

    pipeline = _create_pipeline()

    async def _run():
        return await pipeline.ingest_rekabet(max_pages=max_pages)

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
            "source": "rekabet",
            "result": result,
        })
        logger.info("celery_ingest_rekabet_done", task_id=task_id, result=result)
        return result
    except Exception as exc:
        _publish_progress({
            "task_id": task_id,
            "state": "FAILURE",
            "source": "rekabet",
            "error": str(exc),
        })
        logger.error("celery_ingest_rekabet_error", task_id=task_id, error=str(exc))
        raise


@celery_app.task(
    bind=True,
    base=LexoraTask,
    name="app.tasks.ingestion_tasks.ingest_aihm_task",
    autoretry_for=(Exception,),
    max_retries=3,
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True,
)
def ingest_aihm_task(self, max_results: int = 50000):
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
    base=LexoraTask,
    name="app.tasks.ingestion_tasks.ingest_kvkk_task",
    autoretry_for=(Exception,),
    max_retries=3,
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True,
    time_limit=7200,
    soft_time_limit=6600,
)
def ingest_kvkk_task(self, max_decisions: int = 1000):
    """KVKK Kurul kararlari ingestion."""
    task_id = self.request.id
    logger.info("celery_ingest_kvkk_start", task_id=task_id, max_decisions=max_decisions)

    self.update_state(state="PROGRESS", meta={
        "source": "kvkk",
        "max_decisions": max_decisions,
        "progress_pct": 0,
    })
    _publish_progress({
        "task_id": task_id,
        "state": "STARTED",
        "source": "kvkk",
    })

    pipeline = _create_pipeline()

    async def _run():
        return await pipeline.ingest_kvkk(max_decisions=max_decisions)

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
            "source": "kvkk",
            "result": result,
        })
        logger.info("celery_ingest_kvkk_done", task_id=task_id, result=result)
        return result
    except Exception as exc:
        _publish_progress({
            "task_id": task_id,
            "state": "FAILURE",
            "source": "kvkk",
            "error": str(exc),
        })
        logger.error("celery_ingest_kvkk_error", task_id=task_id, error=str(exc))
        raise


@celery_app.task(
    bind=True,
    base=LexoraTask,
    name="app.tasks.ingestion_tasks.ingest_mevzuat_task",
    autoretry_for=(Exception,),
    max_retries=3,
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True,
)
def ingest_mevzuat_task(self, fetch_all=False):
    """Mevzuat ingestion. fetch_all=True: Bedesten'deki tum kanun+KHK'lari ceker."""
    task_id = self.request.id
    logger.info("celery_ingest_mevzuat_start", task_id=task_id, fetch_all=fetch_all)

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
        return await pipeline.ingest_mevzuat(fetch_all=fetch_all)

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
    base=LexoraTask,
    name="app.tasks.ingestion_tasks.refresh_mevzuat_task",
    autoretry_for=(Exception,),
    max_retries=2,
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True,
)
def refresh_mevzuat_task(self, dry_run=False, fetch_all=True):
    """Mevzuat diff-based guncelleme. Sadece degisenleri gunceller."""
    task_id = self.request.id
    logger.info("celery_refresh_mevzuat_start", task_id=task_id, dry_run=dry_run)

    self.update_state(state="PROGRESS", meta={
        "source": "mevzuat_refresh",
        "dry_run": dry_run,
        "progress_pct": 0,
    })
    _publish_progress({
        "task_id": task_id,
        "state": "STARTED",
        "source": "mevzuat_refresh",
        "dry_run": dry_run,
    })

    pipeline = _create_pipeline()

    async def _run():
        return await pipeline.refresh_mevzuat(dry_run=dry_run, fetch_all=fetch_all)

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
            "source": "mevzuat_refresh",
            "result": result,
        })
        logger.info("celery_refresh_mevzuat_done", task_id=task_id, result=result)
        return result
    except Exception as exc:
        _publish_progress({
            "task_id": task_id,
            "state": "FAILURE",
            "source": "mevzuat_refresh",
            "error": str(exc),
        })
        logger.error("celery_refresh_mevzuat_error", task_id=task_id, error=str(exc))
        raise


@celery_app.task(
    bind=True,
    base=LexoraTask,
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
    base=LexoraTask,
    name="app.tasks.ingestion_tasks.ingest_exhaustive_task",
    autoretry_for=(Exception,),
    max_retries=5,
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True,
    time_limit=86400,
    soft_time_limit=82800,
)
def ingest_exhaustive_task(
    self,
    court_types: list[str] | None = None,
    concurrent_docs: int = 5,
    doc_delay: float = 0.5,
    page_delay: float = 1.5,
    year_from: int | None = None,
    year_to: int | None = None,
    priority_daireler: list[str] | None = None,
):
    """Exhaustive ingestion — tum daireleri sayfa sayfa, bitene kadar cek."""
    task_id = self.request.id
    logger.info("celery_ingest_exhaustive_start", task_id=task_id, court_types=court_types)

    self.update_state(state="PROGRESS", meta={
        "source": "exhaustive",
        "progress_pct": 0,
    })
    _publish_progress({
        "task_id": task_id,
        "state": "STARTED",
        "source": "exhaustive",
    })

    pipeline = _create_pipeline()

    async def _run():
        return await pipeline.ingest_exhaustive(
            court_types=court_types,
            concurrent_docs=concurrent_docs,
            doc_delay=doc_delay,
            page_delay=page_delay,
            year_from=year_from,
            year_to=year_to,
            priority_daireler=priority_daireler,
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
            "source": "exhaustive",
            "result": result,
        })
        logger.info("celery_ingest_exhaustive_done", task_id=task_id, result=result)
        return result
    except Exception as exc:
        _publish_progress({
            "task_id": task_id,
            "state": "FAILURE",
            "source": "exhaustive",
            "error": str(exc),
        })
        logger.error("celery_ingest_exhaustive_error", task_id=task_id, error=str(exc))
        raise


@celery_app.task(
    bind=True,
    base=LexoraTask,
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
    base=LexoraTask,
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
