"""
Platform admin API endpoint'leri.
Kullanıcı yönetimi, sistem durumu, embedding istatistikleri, monitoring.
Sadece platform_admin rolüne sahip kullanıcılar erişebilir.
"""

import asyncio
import json
import secrets
import time
import uuid
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from datetime import date as date_type
from sqlalchemy import select, func, distinct
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.routes.auth import get_current_user
from app.config import get_settings
from app.models.database import (
    User, Firm, Case, Deadline, SavedSearch,
    EventTypeDefinition, DeadlineRuleDefinition, PublicHoliday, JudicialRecess,
)
from app.models.db import get_db
from app.api.deps import get_vector_store, get_cache_service, get_ingestion_pipeline
from app.ingestion.ingest import _ingest_state, _ingest_logs
from app.tasks.ingestion_tasks import (
    ingest_topics_task,
    ingest_aym_task,
    ingest_aihm_task,
    ingest_rekabet_task,
    ingest_kvkk_task,
    ingest_mevzuat_task,
    ingest_batch_task,
    ingest_daire_task,
    ingest_date_range_task,
    ingest_exhaustive_task,
    refresh_mevzuat_task,
    REDIS_CHANNEL,
)

router = APIRouter(prefix="/admin", tags=["admin"])
settings = get_settings()

# App start time for uptime calculation
_app_start_time = time.time()


# ── Guard ──────────────────────────────────────────────

async def require_platform_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "platform_admin":
        raise HTTPException(status_code=403, detail="Platform admin yetkisi gerekli")
    return current_user


# ── Kullanıcı Yönetimi ────────────────────────────────

@router.get("/users")
async def list_users(
    limit: int = 100,
    offset: int = 0,
    admin: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    """Tüm kullanıcıları listele (sayfalı)."""
    limit = min(limit, 500)  # Cap at 500
    result = await db.execute(
        select(User).order_by(User.created_at.desc()).limit(limit).offset(offset)
    )
    users = result.scalars().all()
    return [
        {
            "id": str(u.id),
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role,
            "firm_id": str(u.firm_id) if u.firm_id else None,
            "baro": u.baro,
            "baro_sicil_no": u.baro_sicil_no,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]


@router.get("/users/pending")
async def list_pending_users(
    admin: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    """Onay bekleyen kullanıcıları listele."""
    result = await db.execute(
        select(User).where(User.is_active == False).order_by(User.created_at.desc())
    )
    users = result.scalars().all()
    return [
        {
            "id": str(u.id),
            "email": u.email,
            "full_name": u.full_name,
            "baro": u.baro,
            "baro_sicil_no": u.baro_sicil_no,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]


@router.post("/users/{user_id}/approve")
async def approve_user(
    user_id: uuid.UUID,
    admin: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    """Kullanıcıyı onayla (is_active=True)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    user.is_active = True
    await db.flush()
    return {"status": "ok", "message": f"{user.full_name} onaylandı"}


@router.post("/users/{user_id}/reject")
async def reject_user(
    user_id: uuid.UUID,
    admin: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    """Kullanıcıyı reddet (deaktif et)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    user.is_active = False
    await db.flush()
    return {"status": "ok", "message": f"{user.full_name} reddedildi"}


class RoleUpdateRequest(BaseModel):
    role: str


@router.put("/users/{user_id}/role")
async def update_user_role(
    user_id: uuid.UUID,
    body: RoleUpdateRequest,
    admin: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    """Kullanıcı rolünü değiştir."""
    valid_roles = {"platform_admin", "admin", "partner", "avukat", "stajyer", "asistan"}
    if body.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Geçersiz rol. Geçerli roller: {', '.join(valid_roles)}")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    user.role = body.role
    await db.flush()
    return {"status": "ok", "message": f"{user.full_name} rolü '{body.role}' olarak güncellendi"}


# ── Firma Yönetimi ────────────────────────────────────

@router.get("/firms")
async def list_firms(
    firm_type: str | None = None,
    admin: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    """Tüm firmaları listele. firm_type ile filtrelenebilir (kurumsal/bireysel)."""
    stmt = (
        select(Firm, func.count(User.id).label("member_count"))
        .outerjoin(User, User.firm_id == Firm.id)
    )
    if firm_type in ("kurumsal", "bireysel"):
        stmt = stmt.where(Firm.firm_type == firm_type)
    stmt = stmt.group_by(Firm.id).order_by(Firm.created_at.desc())
    result = await db.execute(stmt)
    rows = result.all()

    return [
        {
            "id": str(f.id),
            "name": f.name,
            "email": f.email,
            "max_users": f.max_users,
            "firm_type": f.firm_type,
            "member_count": count,
            "is_active": f.is_active,
            "created_at": f.created_at.isoformat() if f.created_at else None,
        }
        for f, count in rows
    ]


# ── Sistem Durumu ─────────────────────────────────────

@router.get("/system")
async def system_status(
    admin: User = Depends(require_platform_admin),
):
    """Sistem sağlık durumu."""
    import structlog
    logger = structlog.get_logger()

    checks = {}

    # Qdrant
    try:
        vs = get_vector_store()
        info = await vs.get_collection_info("ictihat_embeddings")
        checks["qdrant"] = {"status": "ok", "embeddings": info.get("points_count", 0)}
    except Exception as e:
        checks["qdrant"] = {"status": "error", "error": str(e)}

    # Redis
    try:
        cache = get_cache_service()
        if cache:
            checks["redis"] = {"status": "ok"}
        else:
            checks["redis"] = {"status": "unavailable"}
    except Exception as e:
        checks["redis"] = {"status": "error", "error": str(e)}

    # GPU Embedding
    try:
        import httpx
        gpu_url = settings.embedding_api_url
        if gpu_url:
            r = httpx.get(f"{gpu_url}/health", timeout=5)
            if r.status_code == 200:
                gpu_info = r.json()
                checks["gpu"] = {"status": "ok", "gpu": gpu_info.get("gpu", ""), "model": gpu_info.get("model", "")}
            else:
                checks["gpu"] = {"status": "error", "http_status": r.status_code}
        else:
            checks["gpu"] = {"status": "unavailable", "reason": "EMBEDDING_API_URL not set"}
    except Exception as e:
        checks["gpu"] = {"status": "error", "error": str(e)}

    return {"checks": checks}


# ── Embedding İstatistikleri ──────────────────────────

@router.get("/embeddings")
async def embedding_stats(
    admin: User = Depends(require_platform_admin),
):
    """Embedding istatistikleri."""
    try:
        vs = get_vector_store()
        ictihat = await vs.get_collection_info("ictihat_embeddings")
        mevzuat = await vs.get_collection_info("mevzuat_embeddings")
        return {
            "ictihat": ictihat,
            "mevzuat": mevzuat,
            "total": (ictihat.get("points_count", 0) or 0) + (mevzuat.get("points_count", 0) or 0),
        }
    except Exception as e:
        return {"error": str(e)}


@router.post("/ingest")
async def trigger_ingest(
    admin: User = Depends(require_platform_admin),
):
    """Ictihat embedding ingestion baslat (Celery worker)."""
    from app.ingestion.ingest import DEFAULT_TOPICS

    result = ingest_topics_task.delay(topics=DEFAULT_TOPICS, pages_per_topic=3)

    return {
        "status": "started",
        "type": "ictihat",
        "task_id": result.id,
        "topics": len(DEFAULT_TOPICS),
        "pages_per_topic": 3,
    }


@router.post("/ingest/mevzuat")
async def trigger_mevzuat_ingest(
    admin: User = Depends(require_platform_admin),
    fetch_all: bool = False,
):
    """Mevzuat embedding ingestion baslat.
    fetch_all=true: Bedesten'deki tüm kanun+KHK'ları çeker (914+ kanun, 63+ KHK).
    fetch_all=false: Sadece temel 36 kanun listesini çeker.
    """
    result = ingest_mevzuat_task.delay(fetch_all=fetch_all)

    return {
        "status": "started",
        "type": "mevzuat",
        "fetch_all": fetch_all,
        "task_id": result.id,
    }


@router.post("/ingest/mevzuat-refresh")
async def trigger_mevzuat_refresh(
    admin: User = Depends(require_platform_admin),
    dry_run: bool = False,
    fetch_all: bool = True,
):
    """Mevzuat diff-based guncelleme. Sadece degisen kanunlari gunceller.
    dry_run=true: Degisenleri tespit eder ama guncellemez.
    """
    result = refresh_mevzuat_task.delay(dry_run=dry_run, fetch_all=fetch_all)

    return {
        "status": "started",
        "type": "mevzuat_refresh",
        "dry_run": dry_run,
        "fetch_all": fetch_all,
        "task_id": result.id,
    }


@router.post("/ingest/batch")
async def trigger_batch_ingest(
    admin: User = Depends(require_platform_admin),
):
    """Toplu ingestion — ictihat + mevzuat + AYM + AIHM sirayla (Celery worker)."""
    result = ingest_batch_task.delay(
        include_ictihat=True,
        include_mevzuat=True,
        include_aym=True,
        include_aihm=True,
    )

    return {
        "status": "started",
        "type": "batch",
        "task_id": result.id,
        "sources": ["ictihat", "mevzuat", "aym", "aihm"],
    }


class DaireIngestRequest(BaseModel):
    court_type: str = "yargitay"
    daire_id: str | None = None
    pages: int = 10


@router.post("/ingest/daire")
async def trigger_daire_ingest(
    body: DaireIngestRequest,
    admin: User = Depends(require_platform_admin),
):
    """Daire bazli sistematik ictihat ingestion (Celery worker)."""
    result = ingest_daire_task.delay(
        court_type=body.court_type,
        daire_id=body.daire_id,
        pages=body.pages,
    )

    return {
        "status": "started",
        "type": "daire",
        "task_id": result.id,
        "court_type": body.court_type,
        "daire_id": body.daire_id,
        "pages": body.pages,
    }


class DateRangeIngestRequest(BaseModel):
    start_date: str
    end_date: str
    court_types: list[str] | None = None
    max_pages: int = 50


@router.post("/ingest/date-range")
async def trigger_date_range_ingest(
    body: DateRangeIngestRequest,
    admin: User = Depends(require_platform_admin),
):
    """Tarih bazli sistematik ictihat ingestion (Celery worker)."""
    result = ingest_date_range_task.delay(
        start_date=body.start_date,
        end_date=body.end_date,
        court_types=body.court_types,
        max_pages=body.max_pages,
    )

    return {
        "status": "started",
        "type": "date_range",
        "task_id": result.id,
        "start_date": body.start_date,
        "end_date": body.end_date,
    }


class ExhaustiveIngestRequest(BaseModel):
    court_types: list[str] | None = None
    concurrent_docs: int = 5
    doc_delay: float = 0.5
    page_delay: float = 1.5
    year_from: int | None = None
    year_to: int | None = None
    priority_daireler: list[str] | None = None


@router.post("/ingest/exhaustive")
async def trigger_exhaustive_ingest(
    body: ExhaustiveIngestRequest = ExhaustiveIngestRequest(),
    admin: User = Depends(require_platform_admin),
):
    """Exhaustive ingestion — tum daireleri sayfa sayfa, bitene kadar cek."""
    result = ingest_exhaustive_task.delay(
        court_types=body.court_types,
        concurrent_docs=body.concurrent_docs,
        doc_delay=body.doc_delay,
        page_delay=body.page_delay,
        year_from=body.year_from,
        year_to=body.year_to,
        priority_daireler=body.priority_daireler,
    )

    return {
        "status": "started",
        "type": "exhaustive",
        "task_id": result.id,
        "court_types": body.court_types or ["yargitay", "danistay"],
        "concurrent_docs": body.concurrent_docs,
        "year_from": body.year_from,
        "year_to": body.year_to,
        "priority_daireler": body.priority_daireler,
    }


@router.get("/ingest/config")
async def get_ingestion_config(
    admin: User = Depends(require_platform_admin),
):
    """Ingestion yapılandırmasını getir (daire bazlı yıl aralıkları, öncelikler)."""
    from app.ingestion.config import load_ingestion_config
    return load_ingestion_config()


@router.put("/ingest/config")
async def update_ingestion_config(
    config: dict,
    admin: User = Depends(require_platform_admin),
):
    """Ingestion yapılandırmasını güncelle."""
    from app.ingestion.config import load_ingestion_config, save_ingestion_config
    current = load_ingestion_config()
    # Merge: sadece gönderilen alanları güncelle
    for key, value in config.items():
        if key in current and isinstance(current[key], dict) and isinstance(value, dict):
            current[key].update(value)
        else:
            current[key] = value
    save_ingestion_config(current)
    return {"status": "saved", "config": current}


@router.get("/logs")
async def get_recent_logs(
    admin: User = Depends(require_platform_admin),
):
    """Canlı ingestion loglarını getir (in-memory buffer)."""
    from app.ingestion.ingest import _ingest_logs, _ingest_running

    return {
        "logs": _ingest_logs[-100:],
        "running": _ingest_running,
        "count": len(_ingest_logs),
    }


# ── Platform İstatistikleri ───────────────────────────

@router.get("/stats")
async def platform_stats(
    admin: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    """Platform genel istatistikleri."""
    users_total = (await db.execute(select(func.count()).select_from(User))).scalar() or 0
    users_active = (await db.execute(select(func.count()).select_from(User).where(User.is_active == True))).scalar() or 0
    users_pending = (await db.execute(select(func.count()).select_from(User).where(User.is_active == False))).scalar() or 0
    firms_total = (await db.execute(select(func.count()).select_from(Firm))).scalar() or 0
    cases_total = (await db.execute(select(func.count()).select_from(Case))).scalar() or 0
    deadlines_total = (await db.execute(select(func.count()).select_from(Deadline))).scalar() or 0
    searches_total = (await db.execute(select(func.count()).select_from(SavedSearch))).scalar() or 0

    return {
        "users": {"total": users_total, "active": users_active, "pending": users_pending},
        "firms": firms_total,
        "cases": cases_total,
        "deadlines": deadlines_total,
        "searches": searches_total,
    }


@router.get("/embeddings/breakdown")
async def embedding_breakdown(
    admin: User = Depends(require_platform_admin),
):
    """Kaynak bazlı embedding istatistikleri."""
    vector_store = get_vector_store()

    sources = ["yargitay", "danistay", "aym", "aihm"]
    breakdown = {}
    for source in sources:
        breakdown[source] = await vector_store.count_by_filter(
            "ictihat_embeddings", "mahkeme", source
        )

    try:
        mevzuat_info = await vector_store.get_collection_info("mevzuat_embeddings")
        mevzuat_count = mevzuat_info.get("points_count", 0)
    except Exception:
        mevzuat_count = 0

    return {
        "sources": breakdown,
        "mevzuat": mevzuat_count,
        "total": sum(breakdown.values()) + mevzuat_count,
    }


@router.post("/sse-ticket")
async def create_sse_ticket(
    admin: User = Depends(require_platform_admin),
):
    """Generate a one-time SSE connection ticket (30s TTL).

    The ticket replaces sending the JWT as a query parameter,
    avoiding token exposure in server logs and browser history.
    """
    ticket = secrets.token_urlsafe(32)
    try:
        import redis as r
        rc = r.from_url(settings.redis_url, socket_timeout=5)
        rc.setex(f"sse_ticket:{ticket}", 30, str(admin.id))
    except Exception:
        raise HTTPException(status_code=503, detail="Redis unavailable")
    return {"ticket": ticket}


@router.get("/ingest/stream")
async def ingest_stream(
    ticket: str = "",
):
    """SSE stream -- anlik ingestion durumu. One-time ticket ile auth."""
    if not ticket:
        raise HTTPException(status_code=401, detail="Ticket gerekli")
    try:
        import redis as r
        rc = r.from_url(settings.redis_url, socket_timeout=5)
        ticket_key = f"sse_ticket:{ticket}"
        user_id_str = rc.get(ticket_key)
        if not user_id_str:
            raise HTTPException(status_code=401, detail="Ticket gecersiz veya suresi dolmus")
        # Delete immediately — one-time use
        rc.delete(ticket_key)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Ticket dogrulama hatasi")
    async def event_generator():
        import redis.asyncio as aioredis

        last_log_count = 0

        # Redis pub/sub for cross-process Celery worker events
        redis_client = None
        pubsub = None
        try:
            redis_client = aioredis.from_url(settings.redis_url if hasattr(settings, "redis_url") else "redis://localhost:6379/0")
            pubsub = redis_client.pubsub()
            await pubsub.subscribe(REDIS_CHANNEL)
        except Exception:
            pubsub = None

        try:
            while True:
                # In-process state (backward compat)
                current_logs = _ingest_logs.copy()
                new_logs = current_logs[last_log_count:] if last_log_count < len(current_logs) else []
                last_log_count = len(current_logs)

                data = {
                    **_ingest_state,
                    "new_logs": new_logs[-10:],
                }

                # Check Redis pub/sub for Celery worker events
                if pubsub:
                    try:
                        msg = await asyncio.wait_for(pubsub.get_message(ignore_subscribe_messages=True), timeout=0.1)
                        if msg and msg["type"] == "message":
                            celery_event = json.loads(msg["data"])
                            data["celery_event"] = celery_event
                    except (asyncio.TimeoutError, Exception):
                        pass

                yield f"data: {json.dumps(data, ensure_ascii=False, default=str)}\n\n"
                await asyncio.sleep(2)
        finally:
            if pubsub:
                await pubsub.unsubscribe(REDIS_CHANNEL)
                await pubsub.aclose()
            if redis_client:
                await redis_client.aclose()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/ingest/state")
async def ingest_state_endpoint(
    admin: User = Depends(require_platform_admin),
):
    """Mevcut ingestion durumu (polling fallback)."""
    return {
        **_ingest_state,
        "logs": _ingest_logs[-20:],
    }


@router.post("/ingest/aym")
async def admin_ingest_aym(
    admin: User = Depends(require_platform_admin),
):
    """AYM bireysel basvuru kararlarini ingest et (Celery worker)."""
    result = ingest_aym_task.delay(pages=10, ihlal_only=True)
    return {"status": "started", "source": "aym", "task_id": result.id}


@router.post("/ingest/rekabet")
async def admin_ingest_rekabet(
    max_pages: int = 1100,
    admin: User = Depends(require_platform_admin),
):
    """Rekabet Kurumu kararlarini ingest et (Celery worker)."""
    result = ingest_rekabet_task.delay(max_pages=max_pages)
    return {"status": "started", "source": "rekabet", "task_id": result.id}


@router.post("/ingest/kvkk")
async def admin_ingest_kvkk(
    max_decisions: int = 1000,
    admin: User = Depends(require_platform_admin),
):
    """KVKK Kurul kararlarini ingest et (Celery worker)."""
    result = ingest_kvkk_task.delay(max_decisions=max_decisions)
    return {"status": "started", "source": "kvkk", "task_id": result.id}


@router.post("/ingest/aihm")
async def admin_ingest_aihm(
    admin: User = Depends(require_platform_admin),
):
    """AIHM Turkiye kararlarini ingest et (Celery worker)."""
    result = ingest_aihm_task.delay(max_results=50000)
    return {"status": "started", "source": "aihm", "task_id": result.id}


@router.get("/ingest/task/{task_id}")
async def get_task_status(
    task_id: str,
    admin: User = Depends(require_platform_admin),
):
    """Celery task durumunu sorgula."""
    from app.worker import celery_app

    result = celery_app.AsyncResult(task_id)
    response = {
        "task_id": task_id,
        "state": result.state,
        "ready": result.ready(),
    }

    if result.state == "PROGRESS":
        response["meta"] = result.info
    elif result.state == "SUCCESS":
        response["result"] = result.result
    elif result.state == "FAILURE":
        response["error"] = str(result.result) if result.result else "Bilinmeyen hata"

    return response


@router.post("/ingest/cancel/{task_id}")
async def cancel_task(
    task_id: str,
    admin: User = Depends(require_platform_admin),
):
    """Celery task'i iptal et."""
    from app.worker import celery_app

    celery_app.control.revoke(task_id, terminate=True, signal="SIGTERM")
    return {"status": "cancelled", "task_id": task_id}


# ── Monitoring ────────────────────────────────────────

@router.get("/monitoring")
async def monitoring_dashboard(
    admin: User = Depends(require_platform_admin),
):
    """Sistem monitoring verisi — CPU, RAM, disk, servis durumlari, embedding istatistikleri."""
    import psutil
    from app.main import request_metrics

    uptime_seconds = round(time.time() - _app_start_time)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage("/")

    # Service health checks with response_ms
    services = {}

    # Qdrant
    t0 = time.monotonic()
    qdrant_points = 0
    try:
        vs = get_vector_store()
        ictihat = await vs.get_collection_info("ictihat_embeddings")
        mevzuat_info = await vs.get_collection_info("mevzuat_embeddings")
        qdrant_points = (ictihat.get("points_count", 0) or 0) + (mevzuat_info.get("points_count", 0) or 0)
        elapsed = round((time.monotonic() - t0) * 1000, 1)
        services["qdrant"] = {"status": "ok", "response_ms": elapsed}
    except Exception as e:
        elapsed = round((time.monotonic() - t0) * 1000, 1)
        services["qdrant"] = {"status": "error", "response_ms": elapsed, "error": str(e)}

    # Redis
    t0 = time.monotonic()
    redis_memory_mb = 0
    try:
        import redis as r
        rc = r.from_url(settings.redis_url, socket_timeout=5)
        rc.ping()
        info = rc.info(section="memory")
        redis_memory_mb = round(info.get("used_memory", 0) / (1024 * 1024), 1)
        elapsed = round((time.monotonic() - t0) * 1000, 1)
        services["redis"] = {"status": "ok", "response_ms": elapsed, "memory_mb": redis_memory_mb}
    except Exception as e:
        elapsed = round((time.monotonic() - t0) * 1000, 1)
        services["redis"] = {"status": "error", "response_ms": elapsed, "error": str(e)}

    # PostgreSQL
    t0 = time.monotonic()
    try:
        from sqlalchemy import text
        from app.models.db import async_session
        async with async_session() as session:
            await session.execute(text("SELECT 1"))
        elapsed = round((time.monotonic() - t0) * 1000, 1)
        services["postgres"] = {"status": "ok", "response_ms": elapsed}
    except Exception as e:
        elapsed = round((time.monotonic() - t0) * 1000, 1)
        services["postgres"] = {"status": "error", "response_ms": elapsed, "error": str(e)}

    # Bedesten
    t0 = time.monotonic()
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{settings.bedesten_base_url}")
            elapsed = round((time.monotonic() - t0) * 1000, 1)
            services["bedesten"] = {
                "status": "ok" if resp.status_code < 500 else "error",
                "response_ms": elapsed,
            }
    except Exception as e:
        elapsed = round((time.monotonic() - t0) * 1000, 1)
        services["bedesten"] = {"status": "error", "response_ms": elapsed, "error": str(e)}

    # Embedding breakdown by source
    by_source = {}
    try:
        vs = get_vector_store()
        for source in ["yargitay", "danistay", "aym", "aihm"]:
            by_source[source] = await vs.count_by_filter("ictihat_embeddings", "mahkeme", source)
    except Exception:
        pass

    # Last ingestion info from Redis
    last_ingestion = None
    daily_new_count = 0
    try:
        import redis as r
        rc_sync = r.from_url(settings.redis_url, socket_timeout=5)
        last_ts = rc_sync.get("monitoring:last_ingestion")
        if last_ts:
            last_ingestion = last_ts.decode() if isinstance(last_ts, bytes) else str(last_ts)
        daily_count = rc_sync.get("monitoring:daily_new_count")
        if daily_count:
            daily_new_count = int(daily_count)
    except Exception:
        pass

    return {
        "uptime_seconds": uptime_seconds,
        "requests_total": request_metrics.total,
        "requests_per_minute": request_metrics.requests_per_minute,
        "avg_response_time_ms": request_metrics.avg_response_time_ms,
        "error_rate_pct": request_metrics.error_rate_pct,
        "active_connections": 0,
        "memory_usage_mb": round(memory.used / (1024 * 1024)),
        "cpu_percent": psutil.cpu_percent(interval=0.1),
        "disk_usage_pct": disk.percent,
        "services": services,
        "ingestion": {
            "total_embeddings": qdrant_points,
            "by_source": by_source,
            "last_ingestion": last_ingestion,
            "daily_new_count": daily_new_count,
        },
    }


@router.get("/monitoring/history")
async def monitoring_history(
    admin: User = Depends(require_platform_admin),
):
    """Son 24 saatlik metrik gecmisi (Redis'ten)."""
    try:
        import redis as r
        rc = r.from_url(settings.redis_url, socket_timeout=5)
        raw = rc.lrange("monitoring:history", 0, 1439)
        history = []
        for item in raw:
            try:
                data = json.loads(item)
                history.append(data)
            except Exception:
                pass
        return {"history": history, "count": len(history)}
    except Exception as e:
        return {"history": [], "count": 0, "error": str(e)}


# ── Süre Yönetimi Pydantic Şemaları ──────────────────


class EventTypeCreate(BaseModel):
    slug: str
    name: str
    description: str | None = None
    category: str
    is_active: bool = True
    display_order: int = 0


class EventTypeUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    category: str | None = None
    is_active: bool | None = None
    display_order: int | None = None


class DeadlineRuleCreate(BaseModel):
    event_type_id: uuid.UUID
    name: str
    law_reference: str | None = None
    law_text: str | None = None
    duration_value: int
    duration_unit: str  # gun, is_gunu, hafta, ay, yil, bilgi
    duration_display: str | None = None
    deadline_type: str  # hak_dusurucusu, zamanasimai, usul_suresi, bildirim, bilgi
    affected_by_adli_tatil: bool = True
    affected_by_holidays: bool = True
    is_active: bool = True
    display_order: int = 0
    note: str | None = None


class DeadlineRuleUpdate(BaseModel):
    name: str | None = None
    law_reference: str | None = None
    law_text: str | None = None
    duration_value: int | None = None
    duration_unit: str | None = None
    duration_display: str | None = None
    deadline_type: str | None = None
    affected_by_adli_tatil: bool | None = None
    affected_by_holidays: bool | None = None
    is_active: bool | None = None
    display_order: int | None = None
    note: str | None = None


class HolidayCreate(BaseModel):
    date: str  # ISO format
    name: str
    year: int
    is_half_day: bool = False
    holiday_type: str = "resmi"


class HolidayUpdate(BaseModel):
    date: str | None = None
    name: str | None = None
    is_half_day: bool | None = None
    holiday_type: str | None = None


class JudicialRecessCreate(BaseModel):
    year: int
    start_date: str
    end_date: str
    extension_days_hukuk: int = 7
    extension_days_ceza: int = 3
    extension_days_idari: int = 7
    note: str | None = None


class JudicialRecessUpdate(BaseModel):
    start_date: str | None = None
    end_date: str | None = None
    extension_days_hukuk: int | None = None
    extension_days_ceza: int | None = None
    extension_days_idari: int | None = None
    note: str | None = None


# ── Olay Türleri (Event Types) ───────────────────────


def _serialize_rule(r: DeadlineRuleDefinition) -> dict:
    """Tek bir süre kuralını dict olarak döndür."""
    return {
        "id": str(r.id),
        "event_type_id": str(r.event_type_id),
        "name": r.name,
        "law_reference": r.law_reference,
        "law_text": r.law_text,
        "duration_value": r.duration_value,
        "duration_unit": r.duration_unit,
        "duration_display": r.duration_display,
        "deadline_type": r.deadline_type,
        "affected_by_adli_tatil": r.affected_by_adli_tatil,
        "affected_by_holidays": r.affected_by_holidays,
        "is_active": r.is_active,
        "display_order": r.display_order,
        "note": r.note,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


def _serialize_event_type(et: EventTypeDefinition, include_rules: bool = True) -> dict:
    """Tek bir olay türünü dict olarak döndür."""
    data = {
        "id": str(et.id),
        "slug": et.slug,
        "name": et.name,
        "description": et.description,
        "category": et.category,
        "is_active": et.is_active,
        "display_order": et.display_order,
        "rule_count": len(et.rules) if et.rules else 0,
        "created_at": et.created_at.isoformat() if et.created_at else None,
        "updated_at": et.updated_at.isoformat() if et.updated_at else None,
    }
    if include_rules:
        data["rules"] = [_serialize_rule(r) for r in (et.rules or [])]
    return data


@router.get("/event-types/categories")
async def list_event_type_categories(
    admin: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    """Mevcut olay türü kategorilerini listele."""
    result = await db.execute(
        select(distinct(EventTypeDefinition.category)).order_by(EventTypeDefinition.category)
    )
    categories = [row[0] for row in result.all()]
    return {"categories": categories}


@router.get("/event-types")
async def list_event_types(
    category: str | None = None,
    admin: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    """Tüm olay türlerini listele. ?category= filtresi desteklenir."""
    query = select(EventTypeDefinition).options(
        selectinload(EventTypeDefinition.rules)
    ).order_by(EventTypeDefinition.display_order, EventTypeDefinition.name)

    if category:
        query = query.where(EventTypeDefinition.category == category)

    result = await db.execute(query)
    event_types = result.scalars().all()
    return [_serialize_event_type(et) for et in event_types]


@router.get("/event-types/{event_type_id}")
async def get_event_type(
    event_type_id: uuid.UUID,
    admin: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    """Tek bir olay türünü kurallarıyla birlikte getir."""
    result = await db.execute(
        select(EventTypeDefinition)
        .options(selectinload(EventTypeDefinition.rules))
        .where(EventTypeDefinition.id == event_type_id)
    )
    et = result.scalar_one_or_none()
    if not et:
        raise HTTPException(status_code=404, detail="Olay türü bulunamadı")
    return _serialize_event_type(et)


@router.post("/event-types")
async def create_event_type(
    body: EventTypeCreate,
    admin: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    """Yeni olay türü oluştur."""
    # Slug benzersizlik kontrolü
    existing = await db.execute(
        select(EventTypeDefinition).where(EventTypeDefinition.slug == body.slug)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"'{body.slug}' slug'ı zaten mevcut")

    et = EventTypeDefinition(
        slug=body.slug,
        name=body.name,
        description=body.description,
        category=body.category,
        is_active=body.is_active,
        display_order=body.display_order,
    )
    db.add(et)
    await db.flush()
    await db.refresh(et, attribute_names=["rules"])
    return _serialize_event_type(et)


@router.put("/event-types/{event_type_id}")
async def update_event_type(
    event_type_id: uuid.UUID,
    body: EventTypeUpdate,
    admin: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    """Olay türünü güncelle."""
    result = await db.execute(
        select(EventTypeDefinition)
        .options(selectinload(EventTypeDefinition.rules))
        .where(EventTypeDefinition.id == event_type_id)
    )
    et = result.scalar_one_or_none()
    if not et:
        raise HTTPException(status_code=404, detail="Olay türü bulunamadı")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(et, key, value)
    await db.flush()
    return _serialize_event_type(et)


@router.delete("/event-types/{event_type_id}")
async def delete_event_type(
    event_type_id: uuid.UUID,
    admin: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    """Olay türünü sil. Kuralları varsa soft delete (is_active=False), yoksa hard delete."""
    result = await db.execute(
        select(EventTypeDefinition)
        .options(selectinload(EventTypeDefinition.rules))
        .where(EventTypeDefinition.id == event_type_id)
    )
    et = result.scalar_one_or_none()
    if not et:
        raise HTTPException(status_code=404, detail="Olay türü bulunamadı")

    if et.rules and len(et.rules) > 0:
        # Soft delete — kuralları olan olay türü tamamen silinemez
        et.is_active = False
        await db.flush()
        return {"status": "ok", "message": f"'{et.name}' deaktif edildi (ilişkili {len(et.rules)} kural mevcut)"}
    else:
        await db.delete(et)
        await db.flush()
        return {"status": "ok", "message": f"'{et.name}' kalıcı olarak silindi"}


# ── Süre Kuralları (Deadline Rules) ──────────────────


@router.get("/deadline-rules/stats")
async def deadline_rules_stats(
    admin: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    """Süre yönetimi istatistikleri."""
    event_types_total = (await db.execute(
        select(func.count()).select_from(EventTypeDefinition)
    )).scalar() or 0

    rules_total = (await db.execute(
        select(func.count()).select_from(DeadlineRuleDefinition)
    )).scalar() or 0

    # Yıl bazlı tatil sayıları
    holidays_by_year_result = await db.execute(
        select(PublicHoliday.year, func.count())
        .group_by(PublicHoliday.year)
        .order_by(PublicHoliday.year.desc())
    )
    holidays_by_year = {str(row[0]): row[1] for row in holidays_by_year_result.all()}

    recesses_total = (await db.execute(
        select(func.count()).select_from(JudicialRecess)
    )).scalar() or 0

    return {
        "event_types_total": event_types_total,
        "rules_total": rules_total,
        "holidays_by_year": holidays_by_year,
        "recesses_total": recesses_total,
    }


@router.get("/deadline-rules")
async def list_deadline_rules(
    event_type_id: uuid.UUID | None = None,
    admin: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    """Tüm süre kurallarını listele. ?event_type_id= filtresi desteklenir."""
    query = select(DeadlineRuleDefinition).order_by(
        DeadlineRuleDefinition.display_order, DeadlineRuleDefinition.name
    )
    if event_type_id:
        query = query.where(DeadlineRuleDefinition.event_type_id == event_type_id)

    result = await db.execute(query)
    rules = result.scalars().all()
    return [_serialize_rule(r) for r in rules]


@router.post("/deadline-rules")
async def create_deadline_rule(
    body: DeadlineRuleCreate,
    admin: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    """Yeni süre kuralı oluştur."""
    # event_type varlık kontrolü
    et_result = await db.execute(
        select(EventTypeDefinition).where(EventTypeDefinition.id == body.event_type_id)
    )
    if not et_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="İlişkili olay türü bulunamadı")

    rule = DeadlineRuleDefinition(
        event_type_id=body.event_type_id,
        name=body.name,
        law_reference=body.law_reference,
        law_text=body.law_text,
        duration_value=body.duration_value,
        duration_unit=body.duration_unit,
        duration_display=body.duration_display,
        deadline_type=body.deadline_type,
        affected_by_adli_tatil=body.affected_by_adli_tatil,
        affected_by_holidays=body.affected_by_holidays,
        is_active=body.is_active,
        display_order=body.display_order,
        note=body.note,
    )
    db.add(rule)
    await db.flush()
    await db.refresh(rule)
    return _serialize_rule(rule)


@router.put("/deadline-rules/{rule_id}")
async def update_deadline_rule(
    rule_id: uuid.UUID,
    body: DeadlineRuleUpdate,
    admin: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    """Süre kuralını güncelle."""
    result = await db.execute(
        select(DeadlineRuleDefinition).where(DeadlineRuleDefinition.id == rule_id)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Süre kuralı bulunamadı")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(rule, key, value)
    await db.flush()
    return _serialize_rule(rule)


@router.delete("/deadline-rules/{rule_id}")
async def delete_deadline_rule(
    rule_id: uuid.UUID,
    admin: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    """Süre kuralını sil."""
    result = await db.execute(
        select(DeadlineRuleDefinition).where(DeadlineRuleDefinition.id == rule_id)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Süre kuralı bulunamadı")

    rule_name = rule.name
    await db.delete(rule)
    await db.flush()
    return {"status": "ok", "message": f"'{rule_name}' kuralı silindi"}


# ── Resmi Tatiller (Public Holidays) ─────────────────


def _serialize_holiday(h: PublicHoliday) -> dict:
    """Tek bir tatili dict olarak döndür."""
    return {
        "id": str(h.id),
        "date": h.date.isoformat() if h.date else None,
        "name": h.name,
        "year": h.year,
        "is_half_day": h.is_half_day,
        "holiday_type": h.holiday_type,
        "created_at": h.created_at.isoformat() if h.created_at else None,
    }


@router.get("/holidays")
async def list_holidays(
    year: int | None = None,
    admin: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    """Resmi tatilleri listele. ?year= filtresi desteklenir (varsayılan: mevcut yıl)."""
    from datetime import date as dt_date

    target_year = year or dt_date.today().year
    query = (
        select(PublicHoliday)
        .where(PublicHoliday.year == target_year)
        .order_by(PublicHoliday.date)
    )
    result = await db.execute(query)
    holidays = result.scalars().all()
    return {"year": target_year, "holidays": [_serialize_holiday(h) for h in holidays]}


@router.post("/holidays")
async def create_holiday(
    body: HolidayCreate,
    admin: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    """Yeni resmi tatil oluştur."""
    holiday = PublicHoliday(
        date=date_type.fromisoformat(body.date),
        name=body.name,
        year=body.year,
        is_half_day=body.is_half_day,
        holiday_type=body.holiday_type,
    )
    db.add(holiday)
    await db.flush()
    await db.refresh(holiday)
    return _serialize_holiday(holiday)


@router.post("/holidays/bulk")
async def bulk_create_holidays(
    holidays: list[HolidayCreate],
    admin: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    """Toplu resmi tatil oluştur."""
    created = []
    for h in holidays:
        holiday = PublicHoliday(
            date=date_type.fromisoformat(h.date),
            name=h.name,
            year=h.year,
            is_half_day=h.is_half_day,
            holiday_type=h.holiday_type,
        )
        db.add(holiday)
        created.append(holiday)

    await db.flush()
    for h in created:
        await db.refresh(h)
    return {"status": "ok", "created": len(created), "holidays": [_serialize_holiday(h) for h in created]}


@router.put("/holidays/{holiday_id}")
async def update_holiday(
    holiday_id: uuid.UUID,
    body: HolidayUpdate,
    admin: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    """Resmi tatili güncelle."""
    result = await db.execute(
        select(PublicHoliday).where(PublicHoliday.id == holiday_id)
    )
    holiday = result.scalar_one_or_none()
    if not holiday:
        raise HTTPException(status_code=404, detail="Tatil bulunamadı")

    update_data = body.model_dump(exclude_unset=True)
    if "date" in update_data and update_data["date"] is not None:
        update_data["date"] = date_type.fromisoformat(update_data["date"])
    for key, value in update_data.items():
        setattr(holiday, key, value)
    await db.flush()
    return _serialize_holiday(holiday)


@router.delete("/holidays/{holiday_id}")
async def delete_holiday(
    holiday_id: uuid.UUID,
    admin: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    """Resmi tatili sil."""
    result = await db.execute(
        select(PublicHoliday).where(PublicHoliday.id == holiday_id)
    )
    holiday = result.scalar_one_or_none()
    if not holiday:
        raise HTTPException(status_code=404, detail="Tatil bulunamadı")

    holiday_name = holiday.name
    await db.delete(holiday)
    await db.flush()
    return {"status": "ok", "message": f"'{holiday_name}' tatili silindi"}


# ── Adli Tatil (Judicial Recesses) ───────────────────


def _serialize_recess(jr: JudicialRecess) -> dict:
    """Tek bir adli tatil dönemini dict olarak döndür."""
    return {
        "id": str(jr.id),
        "year": jr.year,
        "start_date": jr.start_date.isoformat() if jr.start_date else None,
        "end_date": jr.end_date.isoformat() if jr.end_date else None,
        "extension_days_hukuk": jr.extension_days_hukuk,
        "extension_days_ceza": jr.extension_days_ceza,
        "extension_days_idari": jr.extension_days_idari,
        "note": jr.note,
        "created_at": jr.created_at.isoformat() if jr.created_at else None,
    }


@router.get("/judicial-recesses")
async def list_judicial_recesses(
    admin: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    """Adli tatil dönemlerini listele (yıl azalan sırada)."""
    result = await db.execute(
        select(JudicialRecess).order_by(JudicialRecess.year.desc())
    )
    recesses = result.scalars().all()
    return [_serialize_recess(jr) for jr in recesses]


@router.post("/judicial-recesses")
async def create_judicial_recess(
    body: JudicialRecessCreate,
    admin: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    """Yeni adli tatil dönemi oluştur."""
    # Yıl benzersizlik kontrolü
    existing = await db.execute(
        select(JudicialRecess).where(JudicialRecess.year == body.year)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"{body.year} yılı için adli tatil zaten tanımlı")

    recess = JudicialRecess(
        year=body.year,
        start_date=date_type.fromisoformat(body.start_date),
        end_date=date_type.fromisoformat(body.end_date),
        extension_days_hukuk=body.extension_days_hukuk,
        extension_days_ceza=body.extension_days_ceza,
        extension_days_idari=body.extension_days_idari,
        note=body.note,
    )
    db.add(recess)
    await db.flush()
    await db.refresh(recess)
    return _serialize_recess(recess)


@router.put("/judicial-recesses/{recess_id}")
async def update_judicial_recess(
    recess_id: uuid.UUID,
    body: JudicialRecessUpdate,
    admin: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    """Adli tatil dönemini güncelle."""
    result = await db.execute(
        select(JudicialRecess).where(JudicialRecess.id == recess_id)
    )
    recess = result.scalar_one_or_none()
    if not recess:
        raise HTTPException(status_code=404, detail="Adli tatil dönemi bulunamadı")

    update_data = body.model_dump(exclude_unset=True)
    if "start_date" in update_data and update_data["start_date"] is not None:
        update_data["start_date"] = date_type.fromisoformat(update_data["start_date"])
    if "end_date" in update_data and update_data["end_date"] is not None:
        update_data["end_date"] = date_type.fromisoformat(update_data["end_date"])
    for key, value in update_data.items():
        setattr(recess, key, value)
    await db.flush()
    return _serialize_recess(recess)


@router.delete("/judicial-recesses/{recess_id}")
async def delete_judicial_recess(
    recess_id: uuid.UUID,
    admin: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    """Adli tatil dönemini sil."""
    result = await db.execute(
        select(JudicialRecess).where(JudicialRecess.id == recess_id)
    )
    recess = result.scalar_one_or_none()
    if not recess:
        raise HTTPException(status_code=404, detail="Adli tatil dönemi bulunamadı")

    year = recess.year
    await db.delete(recess)
    await db.flush()
    return {"status": "ok", "message": f"{year} yılı adli tatil dönemi silindi"}


async def _store_monitoring_snapshot():
    """Her 60 saniyede bir monitoring snapshot'i Redis'e kaydet. Scheduler'dan cagirilir."""
    import psutil
    try:
        import redis as r
        from app.main import request_metrics
        rc = r.from_url(settings.redis_url, socket_timeout=5)
        snapshot = {
            "ts": time.time(),
            "cpu_percent": psutil.cpu_percent(interval=0.1),
            "memory_usage_mb": round(psutil.virtual_memory().used / (1024 * 1024)),
            "requests_per_minute": request_metrics.requests_per_minute,
            "avg_response_time_ms": request_metrics.avg_response_time_ms,
            "error_rate_pct": request_metrics.error_rate_pct,
            "requests_total": request_metrics.total,
        }
        rc.lpush("monitoring:history", json.dumps(snapshot))
        rc.ltrim("monitoring:history", 0, 1439)  # Max 1440 entries = 24h
    except Exception:
        pass
