"""
Lexora Case Management Routes — Dava dosyası yönetimi.
"""

import uuid
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.database import Case, CaseDocument, Deadline, SavedSearch, User
from app.models.db import get_db
from app.api.routes.auth import get_current_user

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
    """Kullanıcının dava dosyalarını listele."""
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
    result = await db.execute(
        select(Case)
        .where(Case.id == case_id, Case.user_id == current_user.id)
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
