"""
Platform admin API endpoint'leri.
Kullanıcı yönetimi, sistem durumu, embedding istatistikleri.
Sadece platform_admin rolüne sahip kullanıcılar erişebilir.
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.auth import get_current_user
from app.models.database import User, Firm, Case, Deadline, SavedSearch
from app.models.db import get_db
from app.api.deps import get_vector_store, get_cache_service

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Guard ──────────────────────────────────────────────

async def require_platform_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "platform_admin":
        raise HTTPException(status_code=403, detail="Platform admin yetkisi gerekli")
    return current_user


# ── Kullanıcı Yönetimi ────────────────────────────────

@router.get("/users")
async def list_users(
    admin: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    """Tüm kullanıcıları listele."""
    result = await db.execute(select(User).order_by(User.created_at.desc()))
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
    """İçtihat embedding ingestion başlat."""
    from app.api.deps import get_ingestion_pipeline
    from app.ingestion.ingest import DEFAULT_TOPICS

    pipeline = get_ingestion_pipeline()

    import asyncio
    asyncio.create_task(pipeline.ingest_topics(topics=DEFAULT_TOPICS, pages_per_topic=3))

    return {"status": "started", "type": "ictihat", "topics": len(DEFAULT_TOPICS), "pages_per_topic": 3}


@router.post("/ingest/mevzuat")
async def trigger_mevzuat_ingest(
    admin: User = Depends(require_platform_admin),
):
    """Mevzuat embedding ingestion başlat."""
    from app.api.deps import get_ingestion_pipeline

    pipeline = get_ingestion_pipeline()

    mevzuat_topics = [
        "iş kanunu", "türk ceza kanunu", "türk borçlar kanunu", "türk medeni kanunu",
        "hukuk muhakemeleri kanunu", "ceza muhakemesi kanunu", "icra iflas kanunu",
        "idari yargılama usulü kanunu", "ticaret kanunu", "tüketicinin korunması kanunu",
        "kişisel verilerin korunması kanunu", "anayasa", "avukatlık kanunu",
        "noterlik kanunu", "tapu kanunu", "kat mülkiyeti kanunu",
    ]

    import asyncio
    asyncio.create_task(pipeline.ingest_topics(topics=mevzuat_topics, pages_per_topic=3))

    return {"status": "started", "type": "mevzuat", "topics": len(mevzuat_topics), "pages_per_topic": 3}


@router.get("/logs")
async def get_recent_logs(
    admin: User = Depends(require_platform_admin),
):
    """Son backend loglarını getir."""
    import subprocess
    try:
        result = subprocess.run(
            ["tail", "-50", "/proc/1/fd/1"],
            capture_output=True, text=True, timeout=5
        )
        lines = result.stdout.strip().split("\n") if result.stdout else []
        return {"lines": lines[-50:], "count": len(lines)}
    except Exception:
        # Docker log alternatifi
        return {"lines": ["Log okuma desteklenmiyor. Docker logs kullanın."], "count": 0}


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
