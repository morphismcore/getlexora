"""
Veri ingestion endpoint'leri.
Bedesten API'den kararları çekip Qdrant'a yükler.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel

from app.api.deps import get_ingestion_pipeline
from app.api.routes.auth import get_current_user
from app.models.database import User
from app.ingestion.ingest import DEFAULT_TOPICS

router = APIRouter(prefix="/ingest", tags=["ingestion"])


class IngestRequest(BaseModel):
    keyword: str
    court_types: list[str] | None = None
    pages: int = 3


class IngestTopicsRequest(BaseModel):
    topics: list[str] | None = None
    pages_per_topic: int = 3


# Basit in-memory durum takibi
_ingest_status = {"running": False, "last_result": None}


@router.post("/keyword")
async def ingest_keyword(
    request: IngestRequest,
    background_tasks: BackgroundTasks,
    pipeline=Depends(get_ingestion_pipeline),
    current_user: User = Depends(get_current_user),
):
    """Belirli bir anahtar kelime için kararları ingest et."""
    if _ingest_status["running"]:
        raise HTTPException(status_code=409, detail="Bir ingestion zaten çalışıyor.")

    async def run():
        _ingest_status["running"] = True
        try:
            result = await pipeline.ingest_search_results(
                keyword=request.keyword,
                court_types=request.court_types,
                pages=request.pages,
            )
            _ingest_status["last_result"] = result
        finally:
            _ingest_status["running"] = False

    background_tasks.add_task(run)
    return {"status": "started", "keyword": request.keyword}


@router.post("/topics")
async def ingest_topics(
    request: IngestTopicsRequest,
    background_tasks: BackgroundTasks,
    pipeline=Depends(get_ingestion_pipeline),
    current_user: User = Depends(get_current_user),
):
    """Birden fazla hukuk konusu için toplu ingestion başlat."""
    if _ingest_status["running"]:
        raise HTTPException(status_code=409, detail="Bir ingestion zaten çalışıyor.")

    topics = request.topics or DEFAULT_TOPICS

    async def run():
        _ingest_status["running"] = True
        try:
            result = await pipeline.ingest_topics(
                topics=topics,
                pages_per_topic=request.pages_per_topic,
            )
            _ingest_status["last_result"] = result
        finally:
            _ingest_status["running"] = False

    background_tasks.add_task(run)
    return {"status": "started", "topics": topics}


@router.get("/status")
async def ingest_status():
    """Ingestion durumunu kontrol et."""
    return _ingest_status


class IngestDaireRequest(BaseModel):
    court_type: str = "yargitay"
    daire_id: str | None = None
    pages: int = 10


@router.post("/daire")
async def ingest_by_daire(
    request: IngestDaireRequest,
    background_tasks: BackgroundTasks,
    pipeline=Depends(get_ingestion_pipeline),
    current_user: User = Depends(get_current_user),
):
    """Belirli bir daireden sistematik karar çekme."""
    if _ingest_status["running"]:
        raise HTTPException(status_code=409, detail="Bir ingestion zaten çalışıyor.")

    async def run():
        _ingest_status["running"] = True
        try:
            result = await pipeline.ingest_by_daire(
                court_type=request.court_type,
                daire_id=request.daire_id,
                pages=request.pages,
            )
            _ingest_status["last_result"] = result
        finally:
            _ingest_status["running"] = False

    background_tasks.add_task(run)
    return {
        "status": "started",
        "court_type": request.court_type,
        "daire_id": request.daire_id,
    }


class IngestDateRangeRequest(BaseModel):
    start_date: str  # DD.MM.YYYY
    end_date: str    # DD.MM.YYYY
    court_types: list[str] | None = None
    max_pages: int = 50


@router.post("/date-range")
async def ingest_by_date_range(
    request: IngestDateRangeRequest,
    background_tasks: BackgroundTasks,
    pipeline=Depends(get_ingestion_pipeline),
    current_user: User = Depends(get_current_user),
):
    """Tarih aralığına göre sistematik ingestion."""
    if _ingest_status["running"]:
        raise HTTPException(status_code=409, detail="Bir ingestion zaten çalışıyor.")

    async def run():
        _ingest_status["running"] = True
        try:
            result = await pipeline.ingest_by_date_range(
                start_date=request.start_date,
                end_date=request.end_date,
                court_types=request.court_types,
                max_pages=request.max_pages,
            )
            _ingest_status["last_result"] = result
        finally:
            _ingest_status["running"] = False

    background_tasks.add_task(run)
    return {
        "status": "started",
        "date_range": f"{request.start_date} - {request.end_date}",
    }


class IngestAymRequest(BaseModel):
    pages: int = 10
    ihlal_only: bool = True


@router.post("/aym")
async def ingest_aym(
    request: IngestAymRequest,
    background_tasks: BackgroundTasks,
    pipeline=Depends(get_ingestion_pipeline),
    current_user: User = Depends(get_current_user),
):
    """AYM bireysel başvuru kararlarını ingest et."""
    if _ingest_status["running"]:
        raise HTTPException(status_code=409, detail="Bir ingestion zaten çalışıyor.")

    async def run():
        _ingest_status["running"] = True
        try:
            result = await pipeline.ingest_aym(
                pages=request.pages,
                ihlal_only=request.ihlal_only,
            )
            _ingest_status["last_result"] = result
        finally:
            _ingest_status["running"] = False

    background_tasks.add_task(run)
    return {"status": "started", "source": "aym", "pages": request.pages}


class IngestAihmRequest(BaseModel):
    max_results: int = 500
    turkish_only: bool = False


@router.post("/aihm")
async def ingest_aihm(
    request: IngestAihmRequest,
    background_tasks: BackgroundTasks,
    pipeline=Depends(get_ingestion_pipeline),
    current_user: User = Depends(get_current_user),
):
    """AİHM Türkiye aleyhine kararlarını ingest et."""
    if _ingest_status["running"]:
        raise HTTPException(status_code=409, detail="Bir ingestion zaten çalışıyor.")

    async def run():
        _ingest_status["running"] = True
        try:
            result = await pipeline.ingest_aihm(
                max_results=request.max_results,
                turkish_only=request.turkish_only,
            )
            _ingest_status["last_result"] = result
        finally:
            _ingest_status["running"] = False

    background_tasks.add_task(run)
    return {"status": "started", "source": "aihm", "max_results": request.max_results}


@router.get("/progress")
async def ingest_progress(
    pipeline=Depends(get_ingestion_pipeline),
):
    """Detaylı ingestion ilerleme durumu."""
    return await pipeline.get_progress()
