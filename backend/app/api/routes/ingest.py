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


@router.get("/progress")
async def ingest_progress(
    pipeline=Depends(get_ingestion_pipeline),
):
    """Detaylı ingestion ilerleme durumu."""
    return await pipeline.get_progress()
