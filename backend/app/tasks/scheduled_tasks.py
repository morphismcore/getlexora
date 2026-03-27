"""
Celery zamanlanmis gorevler.
Celery Beat tarafindan tetiklenir.
"""

import asyncio
import structlog

from app.worker import celery_app

logger = structlog.get_logger()


# LEGACY: Embedding-based incremental ingestion. Uses IncrementalIngestion which depends on Qdrant/embedding.
@celery_app.task(bind=True, name="app.tasks.scheduled_tasks.daily_incremental")
def daily_incremental(self):
    """LEGACY — Gunluk incremental ingestion — Celery Beat ile 00:00'da calisir (embedding bağımlı)."""
    task_id = self.request.id
    logger.info("daily_incremental_start", task_id=task_id)

    # Skip if exhaustive task is currently running
    try:
        import redis as sync_redis
        from app.config import get_settings as _get_settings
        _r = sync_redis.from_url(_get_settings().redis_url, socket_timeout=2)
        if _r.get("ingestion:exhaustive_running"):
            logger.info("daily_incremental_skipped", reason="exhaustive_running", task_id=task_id)
            _r.close()
            return {"status": "skipped", "reason": "exhaustive_running"}
        _r.close()
    except Exception as e:
        logger.warning("daily_incremental_exhaustive_check_failed", error=str(e))

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


@celery_app.task(bind=True, name="app.tasks.scheduled_tasks.check_deadline_reminders")
def check_deadline_reminders(self):
    """Yaklasan sure hatirlatmalarini kontrol et ve e-posta gonder."""
    task_id = self.request.id
    logger.info("check_deadline_reminders_start", task_id=task_id)

    async def _run():
        from datetime import date, timedelta
        from sqlalchemy import select
        from app.models.db import async_session
        from app.models.database import User, Deadline, Case, NotificationPreference
        from app.services.email_service import send_email, build_deadline_reminder_email

        async with async_session() as session:
            today = date.today()

            # Bildirim tercihi acik olan kullanicilari bul
            pref_result = await session.execute(
                select(NotificationPreference).where(
                    NotificationPreference.email_deadline_reminder == True
                )
            )
            preferences = pref_result.scalars().all()

            sent_count = 0
            for pref in preferences:
                reminder_window = today + timedelta(days=pref.reminder_days_before)

                # Bu kullanicinin yaklasan surelerini bul
                deadlines_result = await session.execute(
                    select(Deadline, Case.title.label("case_title"))
                    .join(Case, Deadline.case_id == Case.id)
                    .where(
                        Case.user_id == pref.user_id,
                        Deadline.deadline_date >= today,
                        Deadline.deadline_date <= reminder_window,
                        Deadline.is_completed == False,
                    )
                    .order_by(Deadline.deadline_date.asc())
                )
                upcoming = deadlines_result.all()

                if not upcoming:
                    continue

                # Kullaniciyi bul
                user_result = await session.execute(
                    select(User).where(User.id == pref.user_id)
                )
                user = user_result.scalar_one_or_none()
                if not user or not user.is_active:
                    continue

                # E-posta icerigi olustur
                deadline_list = [
                    {
                        "title": dl.title,
                        "case_title": case_title,
                        "deadline_date": dl.deadline_date.strftime("%d.%m.%Y"),
                    }
                    for dl, case_title in upcoming
                ]

                html = build_deadline_reminder_email(user.full_name, deadline_list)
                success = await send_email(
                    user.email,
                    f"Lexora - {len(deadline_list)} yaklasan sure hatirlatmasi",
                    html,
                )
                if success:
                    sent_count += 1

            return {"sent_count": sent_count, "users_checked": len(preferences)}

    try:
        result = asyncio.run(_run())
        logger.info("check_deadline_reminders_done", task_id=task_id, **result)
        return result
    except Exception as exc:
        logger.error("check_deadline_reminders_error", task_id=task_id, error=str(exc))
        raise
