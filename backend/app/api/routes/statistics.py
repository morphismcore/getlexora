"""
Mahkeme istatistikleri API endpoint'leri.
Daire bazlı karar dağılımı, yıl trendi, konu karşılaştırma.
AI/LLM gerektirmez — sadece Bedesten API verisi üzerinde matematik.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.api.deps import get_yargi_service, get_vector_store, get_optional_user
from app.models.database import User

from app.services.statistics import CourtStatisticsService

router = APIRouter(prefix="/statistics", tags=["statistics"])


def get_statistics_service(
    yargi=Depends(get_yargi_service),
    vector_store=Depends(get_vector_store),
) -> CourtStatisticsService:
    return CourtStatisticsService(yargi=yargi, vector_store=vector_store)


class CompareRequest(BaseModel):
    topics: list[str] = Field(..., min_length=1, max_length=5, description="Karşılaştırılacak konular")
    court_type: str = Field(default="yargitay", description="Mahkeme türü")


@router.get("/court")
async def get_court_stats(
    topic: str = Query(..., min_length=2, max_length=200, description="Aranacak konu (ör: işe iade)"),
    court_type: str = Query(default="yargitay", description="Mahkeme türü"),
    service: CourtStatisticsService = Depends(get_statistics_service),
):
    """Konu bazlı mahkeme istatistikleri. LLM GEREKTIRMEZ."""
    try:
        return await service.get_court_stats(court_type=court_type, topic=topic)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"İstatistik hatası: {str(e)}")


@router.get("/chamber/{daire_adi}")
async def get_chamber_profile(
    daire_adi: str,
    court_type: str = Query(default="yargitay", description="Mahkeme türü"),
    service: CourtStatisticsService = Depends(get_statistics_service),
):
    """Daire profili. LLM GEREKTIRMEZ."""
    try:
        return await service.get_chamber_profile(daire=daire_adi, court_type=court_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Daire profili hatası: {str(e)}")


@router.post("/compare")
async def compare_topics(
    request: CompareRequest,
    service: CourtStatisticsService = Depends(get_statistics_service),
):
    """Birden fazla konuyu karşılaştır. LLM GEREKTIRMEZ."""
    try:
        return await service.get_topic_comparison(
            topics=request.topics,
            court_type=request.court_type,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Karşılaştırma hatası: {str(e)}")
