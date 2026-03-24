"""
Süre hesaplama API endpoint'leri.
Türk hukuk sistemi yasal süre hesaplayıcı.
"""

import uuid
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.database import Case, Deadline, User
from app.models.db import get_db
from app.api.routes.auth import get_current_user
from app.services.deadline_calculator import DeadlineCalculator

router = APIRouter(prefix="/deadlines", tags=["deadlines"])

# Module-level calculator for sync fallback (no DB session)
calculator = DeadlineCalculator()


class CalculateRequest(BaseModel):
    event_type: str = Field(..., description="Olay tipi (ör: karar_teblig, icra_takibi)")
    event_date: date = Field(..., description="Olay tarihi (YYYY-MM-DD)")
    extra_params: Optional[dict] = Field(default=None, description="Ek parametreler")


class DeadlineItem(BaseModel):
    name: str
    law_reference: str
    duration: str
    deadline_date: str
    business_days_left: int
    urgency: str
    note: str


class CalculateResponse(BaseModel):
    event_type: str
    event_date: str
    deadlines: list[DeadlineItem]
    error: Optional[str] = None


class EventTypeItem(BaseModel):
    value: str
    label: str
    description: str


class UpcomingDeadlineItem(BaseModel):
    id: uuid.UUID
    title: str
    deadline_date: date
    deadline_type: str
    is_completed: bool
    law_reference: str | None = None
    duration_text: str | None = None
    is_manual_override: bool = False
    case_id: uuid.UUID
    case_title: str
    case_number: str | None = None
    court: str | None = None
    opponent: str | None = None
    urgency: str
    business_days_left: int
    calendar_days_left: int


class UpcomingDeadlinesResponse(BaseModel):
    overdue: list[UpcomingDeadlineItem] = []
    today: list[UpcomingDeadlineItem] = []
    this_week: list[UpcomingDeadlineItem] = []
    next_week: list[UpcomingDeadlineItem] = []
    later: list[UpcomingDeadlineItem] = []


@router.post("/calculate", response_model=CalculateResponse)
async def calculate_deadlines(
    body: CalculateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Olay tipine göre tüm ilgili yasal süreleri hesapla (DB-driven with fallback)."""
    extra = body.extra_params or {}
    db_calc = DeadlineCalculator(db_session=db)
    result = await db_calc.calculate_deadline_from_db(body.event_type, body.event_date, **extra)

    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])

    return result


@router.get("/types", response_model=list[EventTypeItem])
async def list_event_types(
    db: AsyncSession = Depends(get_db),
):
    """Desteklenen olay tiplerini listele (DB-driven with fallback)."""
    db_calc = DeadlineCalculator(db_session=db)
    return await db_calc.get_event_types_from_db()


@router.get("/upcoming", response_model=UpcomingDeadlinesResponse)
async def upcoming_deadlines(
    days_ahead: int = Query(default=30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Tüm davalardaki yaklaşan süreleri dashboard için getir."""
    today = date.today()
    end_date = today + timedelta(days=days_ahead)

    # Build query: all non-completed deadlines for user's cases (including overdue)
    if current_user.firm_id:
        case_filter = or_(
            Case.user_id == current_user.id,
            Case.firm_id == current_user.firm_id,
        )
    else:
        case_filter = Case.user_id == current_user.id

    stmt = (
        select(Deadline)
        .join(Case, Deadline.case_id == Case.id)
        .where(
            case_filter,
            Case.status == "aktif",
            Deadline.is_completed == False,  # noqa: E712
            Deadline.deadline_date <= end_date,
        )
        .options(selectinload(Deadline.case))
        .order_by(Deadline.deadline_date.asc())
    )

    result = await db.execute(stmt)
    deadlines = result.scalars().all()

    # Group deadlines
    overdue = []
    today_list = []
    this_week = []
    next_week = []
    later = []

    # Week boundaries
    # This week: today through Sunday
    days_until_sunday = 6 - today.weekday()
    end_of_this_week = today + timedelta(days=days_until_sunday)
    end_of_next_week = end_of_this_week + timedelta(days=7)

    for dl in deadlines:
        case = dl.case
        bdays_left = calculator.business_days_until(today, dl.deadline_date)
        cdays_left = (dl.deadline_date - today).days if dl.deadline_date >= today else 0
        urgency = calculator._urgency(dl.deadline_date, today)

        item = UpcomingDeadlineItem(
            id=dl.id,
            title=dl.title,
            deadline_date=dl.deadline_date,
            deadline_type=dl.deadline_type,
            is_completed=dl.is_completed,
            law_reference=dl.law_reference,
            duration_text=dl.duration_text,
            is_manual_override=dl.is_manual_override,
            case_id=case.id,
            case_title=case.title,
            case_number=case.case_number,
            court=case.court,
            opponent=case.opponent,
            urgency=urgency,
            business_days_left=bdays_left,
            calendar_days_left=cdays_left,
        )

        if dl.deadline_date < today:
            overdue.append(item)
        elif dl.deadline_date == today:
            today_list.append(item)
        elif dl.deadline_date <= end_of_this_week:
            this_week.append(item)
        elif dl.deadline_date <= end_of_next_week:
            next_week.append(item)
        else:
            later.append(item)

    return UpcomingDeadlinesResponse(
        overdue=overdue,
        today=today_list,
        this_week=this_week,
        next_week=next_week,
        later=later,
    )
