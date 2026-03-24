"""
Lexora Case Management Routes — Dava dosyası yönetimi.
"""

import json
import uuid
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.database import Case, CaseDocument, CaseEvent, Deadline, SavedSearch, User
from app.models.db import get_db
from app.api.routes.auth import get_current_user
from app.services.deadline_calculator import DeadlineCalculator

router = APIRouter(prefix="/cases", tags=["cases"])


# ── Pydantic Schemas ──────────────────────────────────────────────────


class CaseCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=500)
    case_type: str = Field(..., pattern=r"^(is_hukuku|ceza|ticaret|idare|aile)$")
    court: str | None = None
    case_number: str | None = None
    opponent: str | None = None
    status: str = Field(default="aktif", pattern=r"^(aktif|kapandi|beklemede)$")
    notes: str | None = None


class CaseUpdate(BaseModel):
    title: str | None = Field(None, min_length=2, max_length=500)
    case_type: str | None = Field(None, pattern=r"^(is_hukuku|ceza|ticaret|idare|aile)$")
    court: str | None = None
    case_number: str | None = None
    opponent: str | None = None
    status: str | None = Field(None, pattern=r"^(aktif|kapandi|beklemede)$")
    notes: str | None = None


class DeadlineCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=500)
    deadline_date: date
    deadline_type: str = Field(
        ..., pattern=r"^(hak_dusurucusu|zamanasimai|durusma|diger)$"
    )
    description: str | None = None
    reminder_days: int = Field(default=3, ge=0, le=90)


class SavedSearchCreate(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    search_type: str = Field(..., pattern=r"^(ictihat|mevzuat)$")
    result_count: int = Field(default=0, ge=0)


class DeadlineResponse(BaseModel):
    id: uuid.UUID
    case_id: uuid.UUID
    title: str
    deadline_date: date
    deadline_type: str
    description: str | None
    is_completed: bool
    reminder_days: int
    created_at: datetime
    # Event-based fields (optional for backward compat)
    event_id: uuid.UUID | None = None
    original_date: date | None = None
    is_manual_override: bool = False
    override_reason: str | None = None
    override_at: datetime | None = None
    law_reference: str | None = None
    duration_text: str | None = None
    calculation_detail: str | None = None

    model_config = {"from_attributes": True}


class DocumentResponse(BaseModel):
    id: uuid.UUID
    case_id: uuid.UUID
    file_name: str
    file_type: str
    file_path: str
    document_type: str
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class SavedSearchResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    case_id: uuid.UUID | None
    query: str
    search_type: str
    result_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class CaseResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    case_type: str
    court: str | None
    case_number: str | None
    opponent: str | None
    status: str
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CaseDetailResponse(CaseResponse):
    documents: list[DocumentResponse] = []
    deadlines: list[DeadlineResponse] = []
    saved_searches: list[SavedSearchResponse] = []


# ── Helpers ────────────────────────────────────────────────────────────


async def _get_user_case(
    case_id: uuid.UUID, user: User, db: AsyncSession
) -> Case:
    """Fetch a case and verify ownership."""
    result = await db.execute(
        select(Case).where(Case.id == case_id, Case.user_id == user.id)
    )
    case = result.scalar_one_or_none()
    if case is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dava bulunamadı")
    return case


# ── Case CRUD ──────────────────────────────────────────────────────────


@router.post("", response_model=CaseResponse, status_code=status.HTTP_201_CREATED)
async def create_case(
    body: CaseCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Yeni dava dosyası oluştur."""
    case = Case(
        user_id=current_user.id,
        firm_id=current_user.firm_id,
        title=body.title,
        case_type=body.case_type,
        court=body.court,
        case_number=body.case_number,
        opponent=body.opponent,
        status=body.status,
        notes=body.notes,
    )
    db.add(case)
    await db.flush()
    await db.refresh(case)
    return case


@router.get("", response_model=list[CaseResponse])
async def list_cases(
    status_filter: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Kullanıcının ve bürosunun dava dosyalarını listele."""
    if current_user.firm_id:
        # Firmadaysa firma davalarını da göster
        from sqlalchemy import or_
        stmt = select(Case).where(
            or_(Case.user_id == current_user.id, Case.firm_id == current_user.firm_id)
        )
    else:
        stmt = select(Case).where(Case.user_id == current_user.id)
    if status_filter:
        stmt = stmt.where(Case.status == status_filter)
    stmt = stmt.order_by(Case.updated_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{case_id}", response_model=CaseDetailResponse)
async def get_case(
    case_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Dava detaylarını belgeler ve sürelerle birlikte getir."""
    from sqlalchemy import or_
    result = await db.execute(
        select(Case)
        .where(
            Case.id == case_id,
            or_(Case.user_id == current_user.id, Case.firm_id == current_user.firm_id) if current_user.firm_id else Case.user_id == current_user.id,
        )
        .options(
            selectinload(Case.documents),
            selectinload(Case.deadlines),
            selectinload(Case.saved_searches),
        )
    )
    case = result.scalar_one_or_none()
    if case is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dava bulunamadı")
    return case


@router.put("/{case_id}", response_model=CaseResponse)
async def update_case(
    case_id: uuid.UUID,
    body: CaseUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Dava dosyasını güncelle."""
    case = await _get_user_case(case_id, current_user, db)
    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(case, field, value)
    await db.flush()
    await db.refresh(case)
    return case


@router.delete("/{case_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_case(
    case_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Dava dosyasını kapat (soft delete — status kapandı)."""
    case = await _get_user_case(case_id, current_user, db)
    case.status = "kapandi"
    await db.flush()


# ── Deadlines ──────────────────────────────────────────────────────────


@router.post("/{case_id}/deadlines", response_model=DeadlineResponse, status_code=status.HTTP_201_CREATED)
async def add_deadline(
    case_id: uuid.UUID,
    body: DeadlineCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Davaya süre/takvim ekle."""
    await _get_user_case(case_id, current_user, db)
    deadline = Deadline(
        case_id=case_id,
        title=body.title,
        deadline_date=body.deadline_date,
        deadline_type=body.deadline_type,
        description=body.description,
        reminder_days=body.reminder_days,
    )
    db.add(deadline)
    await db.flush()
    await db.refresh(deadline)
    return deadline


@router.get("/{case_id}/deadlines", response_model=list[DeadlineResponse])
async def list_deadlines(
    case_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Davanın sürelerini listele."""
    await _get_user_case(case_id, current_user, db)
    result = await db.execute(
        select(Deadline)
        .where(Deadline.case_id == case_id)
        .order_by(Deadline.deadline_date.asc())
    )
    return result.scalars().all()


@router.put("/{case_id}/deadlines/{deadline_id}")
async def update_deadline(
    case_id: uuid.UUID,
    deadline_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Süreyi güncelle veya tamamlandı olarak işaretle."""
    await _get_user_case(case_id, current_user, db)
    result = await db.execute(
        select(Deadline).where(Deadline.id == deadline_id, Deadline.case_id == case_id)
    )
    dl = result.scalar_one_or_none()
    if not dl:
        raise HTTPException(status_code=404, detail="Süre bulunamadı")
    dl.is_completed = not dl.is_completed
    await db.flush()
    return {"status": "ok", "is_completed": dl.is_completed}


@router.delete("/{case_id}/deadlines/{deadline_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_deadline(
    case_id: uuid.UUID,
    deadline_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Süreyi sil."""
    await _get_user_case(case_id, current_user, db)
    result = await db.execute(
        select(Deadline).where(Deadline.id == deadline_id, Deadline.case_id == case_id)
    )
    dl = result.scalar_one_or_none()
    if not dl:
        raise HTTPException(status_code=404, detail="Süre bulunamadı")
    await db.delete(dl)
    await db.flush()


# ── Saved Searches ────────────────────────────────────────────────────


@router.post("/{case_id}/searches", response_model=SavedSearchResponse, status_code=status.HTTP_201_CREATED)
async def save_search_to_case(
    case_id: uuid.UUID,
    body: SavedSearchCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Aramayı davaya kaydet."""
    await _get_user_case(case_id, current_user, db)
    saved = SavedSearch(
        user_id=current_user.id,
        case_id=case_id,
        query=body.query,
        search_type=body.search_type,
        result_count=body.result_count,
    )
    db.add(saved)
    await db.flush()
    await db.refresh(saved)
    return saved


# ── Event-Based Deadline Schemas ─────────────────────────────────────


calculator = DeadlineCalculator()


class EventCreate(BaseModel):
    event_type: str = Field(..., min_length=2, max_length=100)
    event_date: date
    note: str | None = None
    selected_deadline_types: list[str] | None = None


class EventResponse(BaseModel):
    id: uuid.UUID
    case_id: uuid.UUID
    event_type: str
    event_date: date
    note: str | None
    created_by: uuid.UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class EventWithDeadlinesResponse(EventResponse):
    deadlines: list[DeadlineResponse] = []


class DeadlineOverrideRequest(BaseModel):
    new_date: date
    reason: str = Field(..., min_length=5, max_length=500)
    override_type: str = Field(
        ..., pattern=r"^(hakim_farkli_sure|ek_sure|tebligat_duzeltmesi|diger)$"
    )


class RecalculateRequest(BaseModel):
    new_event_date: date
    deadline_ids_to_update: list[uuid.UUID] | None = None


class RecalculateComparisonItem(BaseModel):
    deadline_id: uuid.UUID
    title: str
    old_date: date
    new_date: date
    was_overridden: bool


class RecalculateResponse(BaseModel):
    event_id: uuid.UUID
    old_event_date: date
    new_event_date: date
    comparisons: list[RecalculateComparisonItem]


class UpcomingDeadlineItem(BaseModel):
    id: uuid.UUID
    title: str
    deadline_date: date
    deadline_type: str
    is_completed: bool
    law_reference: str | None
    duration_text: str | None
    is_manual_override: bool
    case_id: uuid.UUID
    case_title: str
    case_number: str | None
    court: str | None
    opponent: str | None
    urgency: str
    business_days_left: int
    calendar_days_left: int


class UpcomingDeadlinesResponse(BaseModel):
    overdue: list[UpcomingDeadlineItem] = []
    today: list[UpcomingDeadlineItem] = []
    this_week: list[UpcomingDeadlineItem] = []
    next_week: list[UpcomingDeadlineItem] = []
    later: list[UpcomingDeadlineItem] = []


# ── Event Endpoints ──────────────────────────────────────────────────


@router.post(
    "/{case_id}/events",
    response_model=EventWithDeadlinesResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_event(
    case_id: uuid.UUID,
    body: EventCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Davaya olay ekle ve ilgili süreleri otomatik hesapla."""
    await _get_user_case(case_id, current_user, db)

    # Use DB-driven calculator with fallback
    db_calc = DeadlineCalculator(db_session=db)

    # Validate event_type (DB-driven with fallback)
    valid_types = [et["value"] for et in await db_calc.get_event_types_from_db()]
    if body.event_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Geçersiz olay tipi: {body.event_type}. Geçerli tipler: {', '.join(valid_types)}",
        )

    # Create event
    event = CaseEvent(
        case_id=case_id,
        event_type=body.event_type,
        event_date=body.event_date,
        note=body.note,
        created_by=current_user.id,
    )
    db.add(event)
    await db.flush()
    await db.refresh(event)

    # Calculate detailed deadlines (DB-driven with fallback)
    result = await db_calc.calculate_deadline_detail_from_db(body.event_type, body.event_date)
    deadline_details = result.get("deadlines", [])

    # Filter by selected types if provided
    if body.selected_deadline_types:
        deadline_details = [
            d for d in deadline_details if d["name"] in body.selected_deadline_types
        ]

    # Create Deadline records
    created_deadlines = []
    for detail in deadline_details:
        dl_date = date.fromisoformat(detail["deadline_date"])
        deadline = Deadline(
            case_id=case_id,
            event_id=event.id,
            title=detail["name"],
            deadline_date=dl_date,
            deadline_type="hak_dusurucusu",
            description=detail.get("note", ""),
            law_reference=detail.get("law_reference"),
            duration_text=detail.get("duration"),
            calculation_detail=json.dumps(detail, ensure_ascii=False),
        )
        db.add(deadline)
        created_deadlines.append(deadline)

    await db.flush()
    for dl in created_deadlines:
        await db.refresh(dl)

    # Build response manually to include deadlines
    return EventWithDeadlinesResponse(
        id=event.id,
        case_id=event.case_id,
        event_type=event.event_type,
        event_date=event.event_date,
        note=event.note,
        created_by=event.created_by,
        created_at=event.created_at,
        deadlines=[DeadlineResponse.model_validate(dl) for dl in created_deadlines],
    )


@router.get("/{case_id}/events", response_model=list[EventWithDeadlinesResponse])
async def list_events(
    case_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Davanın olaylarını sürelerle birlikte listele (en yeniden eskiye)."""
    await _get_user_case(case_id, current_user, db)
    result = await db.execute(
        select(CaseEvent)
        .where(CaseEvent.case_id == case_id)
        .options(selectinload(CaseEvent.deadlines))
        .order_by(CaseEvent.created_at.desc())
    )
    events = result.scalars().all()
    return [
        EventWithDeadlinesResponse(
            id=ev.id,
            case_id=ev.case_id,
            event_type=ev.event_type,
            event_date=ev.event_date,
            note=ev.note,
            created_by=ev.created_by,
            created_at=ev.created_at,
            deadlines=[DeadlineResponse.model_validate(dl) for dl in ev.deadlines],
        )
        for ev in events
    ]


@router.delete("/{case_id}/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    case_id: uuid.UUID,
    event_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Olayı ve bağlı süreleri sil."""
    await _get_user_case(case_id, current_user, db)
    result = await db.execute(
        select(CaseEvent).where(CaseEvent.id == event_id, CaseEvent.case_id == case_id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Olay bulunamadı")
    await db.delete(event)
    await db.flush()


# ── Manual Override ──────────────────────────────────────────────────


@router.put("/{case_id}/deadlines/{deadline_id}/override", response_model=DeadlineResponse)
async def override_deadline(
    case_id: uuid.UUID,
    deadline_id: uuid.UUID,
    body: DeadlineOverrideRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Süre tarihini manuel olarak değiştir (zorunlu gerekçe)."""
    await _get_user_case(case_id, current_user, db)
    result = await db.execute(
        select(Deadline).where(Deadline.id == deadline_id, Deadline.case_id == case_id)
    )
    dl = result.scalar_one_or_none()
    if not dl:
        raise HTTPException(status_code=404, detail="Süre bulunamadı")

    # Save original date only on first override
    if dl.original_date is None:
        dl.original_date = dl.deadline_date

    dl.deadline_date = body.new_date
    dl.is_manual_override = True
    dl.override_reason = f"[{body.override_type}] {body.reason}"
    dl.override_by = current_user.id
    dl.override_at = datetime.utcnow()

    await db.flush()
    await db.refresh(dl)
    return dl


# ── Recalculate ──────────────────────────────────────────────────────


@router.put(
    "/{case_id}/events/{event_id}/recalculate",
    response_model=RecalculateResponse,
)
async def recalculate_event_deadlines(
    case_id: uuid.UUID,
    event_id: uuid.UUID,
    body: RecalculateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Olay tarihi değiştiğinde süreleri yeniden hesapla."""
    await _get_user_case(case_id, current_user, db)

    # Fetch event
    result = await db.execute(
        select(CaseEvent).where(CaseEvent.id == event_id, CaseEvent.case_id == case_id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Olay bulunamadı")

    old_event_date = event.event_date

    # Update event date
    event.event_date = body.new_event_date

    # Fetch deadlines linked to this event
    result = await db.execute(
        select(Deadline).where(Deadline.event_id == event_id)
    )
    deadlines = list(result.scalars().all())

    # Filter: exclude manually overridden deadlines by default
    if body.deadline_ids_to_update:
        deadlines_to_update = [
            dl for dl in deadlines if dl.id in body.deadline_ids_to_update
        ]
    else:
        deadlines_to_update = [
            dl for dl in deadlines if not dl.is_manual_override
        ]

    # Recalculate (DB-driven with fallback)
    db_calc = DeadlineCalculator(db_session=db)
    new_result = await db_calc.calculate_deadline_detail_from_db(event.event_type, body.new_event_date)
    new_deadlines_map = {d["name"]: d for d in new_result.get("deadlines", [])}

    comparisons = []
    for dl in deadlines_to_update:
        old_date = dl.deadline_date
        new_detail = new_deadlines_map.get(dl.title)
        if new_detail:
            new_date = date.fromisoformat(new_detail["deadline_date"])
            dl.deadline_date = new_date
            dl.calculation_detail = json.dumps(new_detail, ensure_ascii=False)
            dl.law_reference = new_detail.get("law_reference")
            dl.duration_text = new_detail.get("duration")
            comparisons.append(
                RecalculateComparisonItem(
                    deadline_id=dl.id,
                    title=dl.title,
                    old_date=old_date,
                    new_date=new_date,
                    was_overridden=dl.is_manual_override,
                )
            )

    await db.flush()

    return RecalculateResponse(
        event_id=event.id,
        old_event_date=old_event_date,
        new_event_date=body.new_event_date,
        comparisons=comparisons,
    )
