from celery import Celery
from celery.schedules import crontab
from app.config import get_settings

settings = get_settings()

# Derive Celery broker/backend from REDIS_URL (reuse auth credentials)
# REDIS_URL format: redis://:password@host:port/0
# Broker uses db 1, result backend uses db 2
def _redis_url_with_db(base_url: str, db: int) -> str:
    """Replace db number in Redis URL."""
    # Remove trailing /N if present
    base = base_url.rsplit("/", 1)[0] if base_url.count("/") >= 3 else base_url
    return f"{base}/{db}"

_broker = _redis_url_with_db(settings.redis_url, 1)
_backend = _redis_url_with_db(settings.redis_url, 2)

celery_app = Celery(
    "lexora",
    broker=_broker,
    backend=_backend,
    include=[
        "app.tasks.ingestion_tasks",
        "app.tasks.scheduled_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Europe/Istanbul",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=7200,
    task_soft_time_limit=6000,
    worker_max_tasks_per_child=50,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
)

celery_app.conf.beat_schedule = {
    "daily-incremental-ingestion": {
        "task": "app.tasks.scheduled_tasks.daily_incremental",
        "schedule": crontab(hour=0, minute=0),
    },
    "daily-deadline-reminders": {
        "task": "app.tasks.scheduled_tasks.check_deadline_reminders",
        "schedule": crontab(hour=8, minute=0),  # Her gun sabah 08:00'de
    },
    "weekly-mevzuat-refresh": {
        "task": "app.tasks.ingestion_tasks.refresh_mevzuat_task",
        "schedule": crontab(hour=4, minute=0, day_of_week=0),  # Her pazar 04:00
        "kwargs": {"dry_run": False, "fetch_all": True},
    },
}

# autodiscover replaced with explicit include in Celery() constructor
