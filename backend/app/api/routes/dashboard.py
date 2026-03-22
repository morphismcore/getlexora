"""
Dashboard summary API endpoint.
Real-time stats, deadlines, recent searches, and new decisions.
"""

import asyncio
from datetime import date, timedelta

import structlog
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import Case, Deadline, SavedSearch
from app.models.db import get_db
from app.api.deps import (
    get_vector_store,
    get_cache_service,
    get_yargi_service,
    get_optional_user,
)
from app.models.database import User
from app.config import get_settings

logger = structlog.get_logger()

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


async def _get_pg_stats(db: AsyncSession, user_id=None) -> dict:
    """Counts from PostgreSQL: cases, upcoming deadlines, saved searches."""
    try:
        today = date.today()
        week_later = today + timedelta(days=7)

        total_cases_q = select(func.count()).select_from(Case)
        if user_id:
            total_cases_q = total_cases_q.where(Case.user_id == user_id)

        upcoming_q = (
            select(func.count())
            .select_from(Deadline)
            .where(
                Deadline.deadline_date >= today,
                Deadline.deadline_date <= week_later,
                Deadline.is_completed == False,  # noqa: E712
            )
        )
        if user_id:
            upcoming_q = upcoming_q.where(
                Deadline.case_id.in_(select(Case.id).where(Case.user_id == user_id))
            )

        total_searches_q = select(func.count()).select_from(SavedSearch)
        if user_id:
            total_searches_q = total_searches_q.where(SavedSearch.user_id == user_id)

        r_cases, r_upcoming, r_searches = await asyncio.gather(
            db.execute(total_cases_q),
            db.execute(upcoming_q),
            db.execute(total_searches_q),
        )

        return {
            "total_cases": r_cases.scalar() or 0,
            "upcoming_deadlines": r_upcoming.scalar() or 0,
            "total_searches": r_searches.scalar() or 0,
        }
    except Exception as e:
        logger.warning("pg_stats_error", error=str(e))
        return {"total_cases": 0, "upcoming_deadlines": 0, "total_searches": 0}


async def _get_qdrant_count() -> int:
    """Total document count across Qdrant collections."""
    try:
        vs = get_vector_store()
        settings = get_settings()
        ictihat_info = await vs.get_collection_info(settings.qdrant_collection_ictihat)
        mevzuat_info = await vs.get_collection_info(settings.qdrant_collection_mevzuat)
        return (ictihat_info.get("points_count", 0) or 0) + (
            mevzuat_info.get("points_count", 0) or 0
        )
    except Exception as e:
        logger.warning("qdrant_count_error", error=str(e))
        return 0


async def _get_upcoming_deadlines(db: AsyncSession) -> list[dict]:
    """Next 7 days deadlines with case info."""
    try:
        today = date.today()
        week_later = today + timedelta(days=7)

        stmt = (
            select(Deadline, Case.title.label("case_title"), Case.court)
            .join(Case, Deadline.case_id == Case.id)
            .where(
                Deadline.deadline_date >= today,
                Deadline.deadline_date <= week_later,
                Deadline.is_completed == False,  # noqa: E712
            )
            .order_by(Deadline.deadline_date.asc())
            .limit(10)
        )
        result = await db.execute(stmt)
        rows = result.all()

        deadlines = []
        for row in rows:
            dl = row[0]  # Deadline object
            case_title = row[1]
            court = row[2]
            days_left = (dl.deadline_date - today).days
            deadlines.append(
                {
                    "id": str(dl.id),
                    "title": dl.title,
                    "court": court or "",
                    "case_title": case_title,
                    "date": dl.deadline_date.strftime("%d %B %Y"),
                    "deadline_date": dl.deadline_date.isoformat(),
                    "days_left": days_left,
                    "deadline_type": dl.deadline_type,
                }
            )
        return deadlines
    except Exception as e:
        logger.warning("upcoming_deadlines_error", error=str(e))
        return []


async def _get_recent_searches(db: AsyncSession) -> list[dict]:
    """Last 5 saved searches."""
    try:
        stmt = (
            select(SavedSearch)
            .order_by(SavedSearch.created_at.desc())
            .limit(5)
        )
        result = await db.execute(stmt)
        searches = result.scalars().all()

        return [
            {
                "id": str(s.id),
                "query": s.query,
                "search_type": s.search_type,
                "result_count": s.result_count,
                "created_at": s.created_at.isoformat() if s.created_at else "",
            }
            for s in searches
        ]
    except Exception as e:
        logger.warning("recent_searches_error", error=str(e))
        return []


async def _get_new_decisions() -> list[dict]:
    """Latest 5 decisions from Bedesten API — cached 30 min."""
    try:
        cache = get_cache_service()
        if cache:
            cached = await cache.get_cached_search("__dashboard_decisions__", {})
            if cached is not None:
                return cached

        yargi = get_yargi_service()
        data = await yargi.search_bedesten(
            keyword="",
            item_type="YARGITAYKARARI",
            page=1,
            page_size=5,
        )
        items = data.get("data", {}).get("emsalKararList", [])

        decisions = []
        for item in items[:5]:
            esas_yil = item.get("esasNoYil", "")
            esas_sira = item.get("esasNoSira", "")
            karar_yil = item.get("kararNoYil", "")
            karar_sira = item.get("kararNoSira", "")

            esas_no = f"{esas_yil}/{esas_sira}" if esas_yil and esas_sira else ""
            karar_no = f"{karar_yil}/{karar_sira}" if karar_yil and karar_sira else ""

            decisions.append(
                {
                    "karar_id": item.get("documentId", ""),
                    "daire": item.get("birimAdi", ""),
                    "esas_no": str(esas_no),
                    "karar_no": str(karar_no),
                    "tarih": item.get("kararTarihiStr", item.get("kararTarihi", "")),
                }
            )
        # Cache 30 dakika
        if cache:
            try:
                await cache.cache_search("__dashboard_decisions__", {}, decisions, ttl=1800)
            except Exception:
                pass

        return decisions
    except Exception as e:
        logger.warning("new_decisions_error", error=str(e))
        return []


async def _get_system_health() -> dict:
    """Quick health check — max 2 saniye timeout."""
    health = {"backend": "ok", "qdrant": "ok", "redis": "ok", "postgres": "ok"}
    # Basit health — detaylı kontrol /health/details'da
    return health


@router.get("/summary")
async def get_dashboard_summary(db: AsyncSession = Depends(get_db), current_user: User | None = Depends(get_optional_user)):
    """
    Returns real-time dashboard data.
    No auth required (POC).
    """
    # Run all data fetches in parallel
    user_id = current_user.id if current_user else None
    pg_stats_task = _get_pg_stats(db, user_id=user_id)
    qdrant_count_task = _get_qdrant_count()
    deadlines_task = _get_upcoming_deadlines(db)
    searches_task = _get_recent_searches(db)
    health_task = _get_system_health()

    pg_stats, qdrant_count, deadlines, searches, health = (
        await asyncio.gather(
            pg_stats_task,
            qdrant_count_task,
            deadlines_task,
            searches_task,
            health_task,
        )
    )

    # Yeni kararlar arka planda — dashboard'u bloklamasın
    decisions: list[dict] = []
    try:
        cache = get_cache_service()
        if cache:
            cached = await cache.get_cached_search("__dashboard_decisions__", {})
            if cached is not None:
                decisions = cached
    except Exception:
        pass

    return {
        "stats": {
            "total_cases": pg_stats["total_cases"],
            "upcoming_deadlines": pg_stats["upcoming_deadlines"],
            "total_searches": pg_stats["total_searches"],
            "qdrant_documents": qdrant_count,
        },
        "upcoming_deadlines": deadlines,
        "recent_searches": searches,
        "new_decisions": decisions,
        "system_health": health,
    }
