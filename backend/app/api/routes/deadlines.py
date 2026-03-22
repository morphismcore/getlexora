"""
Süre hesaplama API endpoint'leri.
Türk hukuk sistemi yasal süre hesaplayıcı.
"""

from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.deadline_calculator import DeadlineCalculator

router = APIRouter(prefix="/deadlines", tags=["deadlines"])

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


@router.post("/calculate", response_model=CalculateResponse)
async def calculate_deadlines(body: CalculateRequest):
    """Olay tipine göre tüm ilgili yasal süreleri hesapla."""
    extra = body.extra_params or {}
    result = calculator.calculate_deadline(body.event_type, body.event_date, **extra)

    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])

    return result


@router.get("/types", response_model=list[EventTypeItem])
async def list_event_types():
    """Desteklenen olay tiplerini listele."""
    return calculator.get_event_types()
