"""
Lexora Bildirim Tercihleri CRUD Endpoint'leri.
"""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import NotificationPreference, User
from app.models.db import get_db
from app.api.routes.auth import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


# ── Schemas ────────────────────────────────────────────────────────

class NotificationPreferenceResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    email_deadline_reminder: bool
    email_case_update: bool
    email_weekly_summary: bool
    reminder_days_before: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class NotificationPreferenceUpdate(BaseModel):
    email_deadline_reminder: bool | None = None
    email_case_update: bool | None = None
    email_weekly_summary: bool | None = None
    reminder_days_before: int | None = Field(None, ge=1, le=30)


# ── Routes ─────────────────────────────────────────────────────────

@router.get("/preferences", response_model=NotificationPreferenceResponse)
async def get_notification_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Kullanicinin bildirim tercihlerini getir. Yoksa varsayilan olustur."""
    result = await db.execute(
        select(NotificationPreference).where(
            NotificationPreference.user_id == current_user.id
        )
    )
    pref = result.scalar_one_or_none()

    if not pref:
        pref = NotificationPreference(user_id=current_user.id)
        db.add(pref)
        await db.flush()
        await db.refresh(pref)

    return pref


@router.put("/preferences", response_model=NotificationPreferenceResponse)
async def update_notification_preferences(
    body: NotificationPreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Bildirim tercihlerini guncelle."""
    result = await db.execute(
        select(NotificationPreference).where(
            NotificationPreference.user_id == current_user.id
        )
    )
    pref = result.scalar_one_or_none()

    if not pref:
        pref = NotificationPreference(user_id=current_user.id)
        db.add(pref)
        await db.flush()

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(pref, field, value)

    await db.flush()
    await db.refresh(pref)
    return pref
