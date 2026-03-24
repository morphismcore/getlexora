"""
Platform admin API endpoint'leri.
Kullanıcı yönetimi, sistem durumu, embedding istatistikleri, monitoring.
Sadece platform_admin rolüne sahip kullanıcılar erişebilir.
"""

import asyncio
import json
import time
import uuid
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.auth import get_current_user
from app.config import get_settings
from app.models.database import User, Firm, Case, Deadline, SavedSearch
from app.models.db import get_db
from app.api.deps import get_vector_store, get_cache_service, get_ingestion_pipeline
from app.ingestion.ingest import _ingest_state, _ingest_logs
from app.tasks.ingestion_tasks import (
    ingest_topics_task,
    ingest_aym_task,
    ingest_aihm_task,
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
    admin: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    """Tüm firmaları listele."""
    result = await db.execute(select(Firm).order_by(Firm.created_at.desc()))
    firms = result.scalars().all()
    out = []
    for f in firms:
        member_count = await db.execute(
            select(func.count()).select_from(User).where(User.firm_id == f.id)
        )
        out.append({
            "id": str(f.id),
            "name": f.name,
            "email": f.email,
            "max_users": f.max_users,
            "member_count": member_count.scalar() or 0,
            "is_active": f.is_active,
            "created_at": f.created_at.isoformat() if f.created_at else None,
        })
    return out


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
):
    """Mevzuat embedding ingestion baslat (Celery worker)."""
    mevzuat_topics = [
        "iş kanunu", "türk ceza kanunu", "türk borçlar kanunu", "türk medeni kanunu",
        "hukuk muhakemeleri kanunu", "ceza muhakemesi kanunu", "icra iflas kanunu",
        "idari yargılama usulü kanunu", "ticaret kanunu", "tüketicinin korunması kanunu",
        "kişisel verilerin korunması kanunu", "anayasa", "avukatlık kanunu",
        "noterlik kanunu", "tapu kanunu", "kat mülkiyeti kanunu",
    ]

    result = ingest_topics_task.delay(topics=mevzuat_topics, pages_per_topic=3)

    return {
        "status": "started",
        "type": "mevzuat",
        "task_id": result.id,
        "topics": len(mevzuat_topics),
        "pages_per_topic": 3,
    }


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


@router.get("/ingest/stream")
async def ingest_stream(
    token: str = "",
    db: AsyncSession = Depends(get_db),
):
    """SSE stream -- anlik ingestion durumu. Token query param ile auth."""
    # SSE EventSource header gönderemediği için token query param'dan alınır
    if not token:
        raise HTTPException(status_code=401, detail="Token gerekli")
    try:
        import jwt as pyjwt
        payload = pyjwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id = uuid.UUID(payload["sub"])
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user or user.role != "platform_admin":
            raise HTTPException(status_code=403, detail="Yetkisiz")
    except Exception:
        raise HTTPException(status_code=401, detail="Geçersiz token")
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


@router.post("/ingest/aihm")
async def admin_ingest_aihm(
    admin: User = Depends(require_platform_admin),
):
    """AIHM Turkiye kararlarini ingest et (Celery worker)."""
    result = ingest_aihm_task.delay(max_results=500)
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
