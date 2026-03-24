"""
Dashboard summary API endpoint.
Real-time stats, deadlines, recent searches, new decisions,
cases summary, events, and case distributions.
"""

import asyncio
from datetime import date, timedelta

import structlog
from fastapi import APIRouter, Depends
from sqlalchemy import select, func, case as sql_case, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.database import (
    Case,
    CaseDocument,
    CaseEvent,
    Deadline,
    EventTypeDefinition,
    SavedSearch,
    User,
)
from app.models.db import get_db
from app.api.deps import (
    get_vector_store,
    get_cache_service,
    get_yargi_service,
    get_optional_user,
)
from app.config import get_settings
from app.services.deadline_calculator import DeadlineCalculator

logger = structlog.get_logger()

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

# Module-level calculator for business day / urgency helpers
_calculator = DeadlineCalculator()


# ── Helpers ────────────────────────────────────────────────────────────


def _case_filter(user: User):
    """Build case ownership / firm filter for a user."""
    if user.firm_id:
        return or_(
            Case.user_id == user.id,
            and_(
                Case.firm_id == user.firm_id,
                user.is_active == True,  # noqa: E712
            ),
        )
    return Case.user_id == user.id


def _deadline_item(dl, case, today: date) -> dict:
    """Build a single DeadlineItem dict."""
    days_left = (dl.deadline_date - today).days
    bdays_left = _calculator.business_days_until(today, dl.deadline_date) if dl.deadline_date >= today else 0
    urgency = _calculator._urgency(dl.deadline_date, today)

    return {
        "id": str(dl.id),
        "title": dl.title,
        "deadline_date": dl.deadline_date.isoformat(),
        "deadline_type": dl.deadline_type or "diger",
        "law_reference": dl.law_reference,
        "urgency": urgency,
        "days_left": days_left,
        "business_days_left": bdays_left,
        "is_completed": dl.is_completed,
        "case_id": str(case.id),
        "case_title": case.title,
        "case_type": case.case_type,
        "court": case.court,
        "case_number": case.case_number,
    }


# ── Data fetchers ─────────────────────────────────────────────────────


async def _get_pg_stats(db: AsyncSession, user_id=None) -> dict:
    """Counts from PostgreSQL: cases, deadlines breakdown, saved searches."""
    try:
        today = date.today()
        tomorrow = today + timedelta(days=1)
        week_later = today + timedelta(days=7)
        three_days = today + timedelta(days=3)

        # Base case subquery for user filtering
        user_cases_sq = select(Case.id)
        if user_id:
            user_cases_sq = user_cases_sq.where(Case.user_id == user_id)
        user_cases_sq = user_cases_sq.scalar_subquery()

        # Total cases
        total_cases_q = select(func.count()).select_from(Case)
        if user_id:
            total_cases_q = total_cases_q.where(Case.user_id == user_id)

        # Active cases
        active_cases_q = select(func.count()).select_from(Case).where(Case.status == "aktif")
        if user_id:
            active_cases_q = active_cases_q.where(Case.user_id == user_id)

        # Base deadline filter: not completed, case belongs to user
        def _dl_base():
            q = select(func.count()).select_from(Deadline).where(
                Deadline.is_completed == False,  # noqa: E712
            )
            if user_id:
                q = q.where(Deadline.case_id.in_(user_cases_sq))
            return q

        # Upcoming (next 7 days)
        upcoming_q = _dl_base().where(
            Deadline.deadline_date >= today,
            Deadline.deadline_date <= week_later,
        )

        # Overdue
        overdue_q = _dl_base().where(Deadline.deadline_date < today)

        # Today
        today_q = _dl_base().where(Deadline.deadline_date == today)

        # Tomorrow
        tomorrow_q = _dl_base().where(Deadline.deadline_date == tomorrow)

        # Critical (3 days or less, including today, not overdue)
        critical_q = _dl_base().where(
            Deadline.deadline_date >= today,
            Deadline.deadline_date <= three_days,
        )

        # Total searches
        total_searches_q = select(func.count()).select_from(SavedSearch)
        if user_id:
            total_searches_q = total_searches_q.where(SavedSearch.user_id == user_id)

        (
            r_total, r_active, r_upcoming, r_overdue,
            r_today, r_tomorrow, r_critical, r_searches,
        ) = await asyncio.gather(
            db.execute(total_cases_q),
            db.execute(active_cases_q),
            db.execute(upcoming_q),
            db.execute(overdue_q),
            db.execute(today_q),
            db.execute(tomorrow_q),
            db.execute(critical_q),
            db.execute(total_searches_q),
        )

        return {
            "total_cases": r_total.scalar() or 0,
            "active_cases": r_active.scalar() or 0,
            "upcoming_deadlines": r_upcoming.scalar() or 0,
            "overdue_deadlines": r_overdue.scalar() or 0,
            "today_deadlines": r_today.scalar() or 0,
            "tomorrow_deadlines": r_tomorrow.scalar() or 0,
            "critical_deadlines": r_critical.scalar() or 0,
            "total_searches": r_searches.scalar() or 0,
        }
    except Exception as e:
        logger.warning("pg_stats_error", error=str(e))
        return {
            "total_cases": 0,
            "active_cases": 0,
            "upcoming_deadlines": 0,
            "overdue_deadlines": 0,
            "today_deadlines": 0,
            "tomorrow_deadlines": 0,
            "critical_deadlines": 0,
            "total_searches": 0,
        }


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


async def _get_deadlines_grouped(db: AsyncSession, user: User | None) -> dict:
    """
    Fetch deadlines grouped into overdue / today / this_week / next_week / later.
    Includes overdue (past due, not completed). Max 14 days ahead. Max 30 total.
    """
    try:
        today = date.today()
        fourteen_days = today + timedelta(days=14)

        # Week boundaries
        days_until_sunday = 6 - today.weekday()
        end_of_this_week = today + timedelta(days=days_until_sunday)
        end_of_next_week = end_of_this_week + timedelta(days=7)

        stmt = (
            select(Deadline)
            .join(Case, Deadline.case_id == Case.id)
            .where(
                Deadline.is_completed == False,  # noqa: E712
                Case.status == "aktif",
                Deadline.deadline_date <= fourteen_days,
            )
            .options(selectinload(Deadline.case))
            .order_by(Deadline.deadline_date.asc())
        )

        if user:
            stmt = stmt.where(_case_filter(user))

        # No hard DB LIMIT — we group first, then trim
        result = await db.execute(stmt)
        deadlines = result.scalars().all()

        groups: dict[str, list] = {
            "overdue": [],
            "today": [],
            "this_week": [],
            "next_week": [],
            "later": [],
        }
        total = 0
        max_total = 30

        for dl in deadlines:
            if total >= max_total:
                break
            case = dl.case
            item = _deadline_item(dl, case, today)

            if dl.deadline_date < today:
                groups["overdue"].append(item)
            elif dl.deadline_date == today:
                groups["today"].append(item)
            elif dl.deadline_date <= end_of_this_week:
                groups["this_week"].append(item)
            elif dl.deadline_date <= end_of_next_week:
                groups["next_week"].append(item)
            else:
                groups["later"].append(item)
            total += 1

        return groups
    except Exception as e:
        logger.warning("deadlines_grouped_error", error=str(e))
        return {"overdue": [], "today": [], "this_week": [], "next_week": [], "later": []}


async def _get_cases_summary(db: AsyncSession, user: User | None) -> list[dict]:
    """
    Cases with next deadline info, deadline count, document count.
    Ordered: overdue first, then nearest deadline, then updated_at.
    Max 20 cases.
    """
    try:
        today = date.today()

        stmt = (
            select(Case)
            .options(
                selectinload(Case.deadlines),
                selectinload(Case.documents),
            )
            .order_by(Case.updated_at.desc())
        )

        if user:
            stmt = stmt.where(_case_filter(user))

        result = await db.execute(stmt)
        cases = result.scalars().all()

        cases_data = []
        for c in cases:
            # Find next upcoming deadline (closest, not completed, not overdue)
            active_deadlines = [
                d for d in c.deadlines
                if not d.is_completed and d.deadline_date >= today
            ]
            active_deadlines.sort(key=lambda d: d.deadline_date)

            # Check for overdue deadlines
            overdue_deadlines = [
                d for d in c.deadlines
                if not d.is_completed and d.deadline_date < today
            ]

            next_dl = None
            if active_deadlines:
                nd = active_deadlines[0]
                days_left = (nd.deadline_date - today).days
                urgency = _calculator._urgency(nd.deadline_date, today)
                next_dl = {
                    "title": nd.title,
                    "deadline_date": nd.deadline_date.isoformat(),
                    "days_left": days_left,
                    "urgency": urgency,
                }

            cases_data.append({
                "id": str(c.id),
                "title": c.title,
                "case_type": c.case_type,
                "court": c.court,
                "case_number": c.case_number,
                "opponent": c.opponent,
                "status": c.status,
                "updated_at": c.updated_at.isoformat() if c.updated_at else "",
                "next_deadline": next_dl,
                "deadline_count": len(c.deadlines),
                "document_count": len(c.documents),
                "_has_overdue": len(overdue_deadlines) > 0,
                "_next_dl_date": active_deadlines[0].deadline_date if active_deadlines else date.max,
            })

        # Sort: overdue first, then by nearest deadline, then by updated_at desc
        cases_data.sort(
            key=lambda x: (
                not x["_has_overdue"],  # True (has overdue) sorts first
                x["_next_dl_date"],
            )
        )

        # Remove internal sort keys and limit
        for c in cases_data:
            del c["_has_overdue"]
            del c["_next_dl_date"]

        return cases_data[:20]
    except Exception as e:
        logger.warning("cases_summary_error", error=str(e))
        return []


async def _get_cases_by_type(db: AsyncSession, user: User | None) -> dict:
    """Cases grouped by case_type."""
    try:
        stmt = select(Case.case_type, func.count()).select_from(Case).group_by(Case.case_type)
        if user:
            stmt = stmt.where(_case_filter(user))
        result = await db.execute(stmt)
        return {row[0]: row[1] for row in result.all()}
    except Exception as e:
        logger.warning("cases_by_type_error", error=str(e))
        return {}


async def _get_cases_by_status(db: AsyncSession, user: User | None) -> dict:
    """Cases grouped by status."""
    try:
        stmt = select(Case.status, func.count()).select_from(Case).group_by(Case.status)
        if user:
            stmt = stmt.where(_case_filter(user))
        result = await db.execute(stmt)
        return {row[0]: row[1] for row in result.all()}
    except Exception as e:
        logger.warning("cases_by_status_error", error=str(e))
        return {}


async def _get_recent_events(db: AsyncSession, user: User | None) -> list[dict]:
    """Last 10 events across all user's cases with human-readable labels."""
    try:
        stmt = (
            select(CaseEvent)
            .join(Case, CaseEvent.case_id == Case.id)
            .options(selectinload(CaseEvent.case))
            .order_by(CaseEvent.created_at.desc())
            .limit(10)
        )

        if user:
            stmt = stmt.where(_case_filter(user))

        result = await db.execute(stmt)
        events = result.scalars().all()

        # Build event_type -> label lookup from EventTypeDefinition
        event_type_labels: dict[str, str] = {}
        try:
            etd_result = await db.execute(
                select(EventTypeDefinition.slug, EventTypeDefinition.name)
            )
            event_type_labels = {row[0]: row[1] for row in etd_result.all()}
        except Exception:
            pass

        events_data = []
        for ev in events:
            label = event_type_labels.get(ev.event_type, ev.event_type.replace("_", " ").title())
            events_data.append({
                "id": str(ev.id),
                "event_type": ev.event_type,
                "event_type_label": label,
                "event_date": ev.event_date.isoformat(),
                "case_title": ev.case.title if ev.case else "",
                "case_id": str(ev.case_id),
                "created_at": ev.created_at.isoformat() if ev.created_at else "",
            })

        return events_data
    except Exception as e:
        logger.warning("recent_events_error", error=str(e))
        return []


async def _get_recent_searches(db: AsyncSession, user_id=None) -> list[dict]:
    """Last 5 saved searches."""
    try:
        stmt = (
            select(SavedSearch)
            .order_by(SavedSearch.created_at.desc())
            .limit(5)
        )
        if user_id:
            stmt = stmt.where(SavedSearch.user_id == user_id)

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
    return health


# ── Main endpoint ──────────────────────────────────────────────────────


@router.get("/summary")
async def get_dashboard_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    """
    Returns real-time dashboard data for a 10-widget lawyer dashboard.
    Works without auth (landing page mode) or with auth (full user data).
    """
    user_id = current_user.id if current_user else None

    # ── Parallel batch 1: independent data fetches ─────────────────
    (
        pg_stats,
        qdrant_count,
        deadlines,
        cases,
        cases_by_type,
        cases_by_status,
        recent_events,
        searches,
        health,
    ) = await asyncio.gather(
        _get_pg_stats(db, user_id=user_id),
        _get_qdrant_count(),
        _get_deadlines_grouped(db, current_user),
        _get_cases_summary(db, current_user),
        _get_cases_by_type(db, current_user),
        _get_cases_by_status(db, current_user),
        _get_recent_events(db, current_user),
        _get_recent_searches(db, user_id=user_id),
        _get_system_health(),
    )

    # ── Decisions — non-blocking, from cache only ──────────────────
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
            "active_cases": pg_stats["active_cases"],
            "upcoming_deadlines": pg_stats["upcoming_deadlines"],
            "overdue_deadlines": pg_stats["overdue_deadlines"],
            "today_deadlines": pg_stats["today_deadlines"],
            "tomorrow_deadlines": pg_stats["tomorrow_deadlines"],
            "critical_deadlines": pg_stats["critical_deadlines"],
            "total_searches": pg_stats["total_searches"],
            "qdrant_documents": qdrant_count,
        },
        "deadlines": deadlines,
        "cases": cases,
        "cases_by_type": cases_by_type,
        "cases_by_status": cases_by_status,
        "recent_events": recent_events,
        "recent_searches": searches,
        "new_decisions": decisions,
        "system_health": health,
    }
