"""
Lexora Backend — Ana FastAPI Uygulaması.
Türk avukatları için AI destekli hukuk araştırma asistanı.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import structlog

from app.config import get_settings
from app.api.routes import health, search, ingest, auth, cases, deadlines, statistics, dashboard, upload, templates, export, admin
from app.api.deps import get_vector_store, cleanup
from app.models.db import init_db

structlog.configure(
    processors=[
        structlog.dev.ConsoleRenderer(),
    ],
)

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup ve shutdown olayları."""
    settings = get_settings()
    logger.info("starting_lexora", env=settings.env)

    # Veritabanı tablolarını oluştur
    try:
        await init_db()
        logger.info("database_initialized")
    except Exception as e:
        logger.error("database_init_error", error=str(e))

    # Qdrant koleksiyonlarını oluştur
    try:
        vs = get_vector_store()
        await vs.initialize_collections()
        logger.info("qdrant_initialized")
    except Exception as e:
        logger.error("qdrant_init_error", error=str(e))

    yield

    # Shutdown
    await cleanup()
    logger.info("lexora_shutdown")


app = FastAPI(
    title="Lexora API",
    description="Türk avukatları için AI destekli hukuk araştırma asistanı",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — frontend için (environment-based)
_cors_origins = get_settings().cors_origins.split(",") if hasattr(get_settings(), "cors_origins") and get_settings().cors_origins else [
    "http://localhost:3000",
    "http://localhost:5173",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept"],
)

# Routes
app.include_router(health.router)
app.include_router(search.router, prefix="/api/v1")
app.include_router(ingest.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(cases.router, prefix="/api/v1")
app.include_router(deadlines.router, prefix="/api/v1")
app.include_router(statistics.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(upload.router, prefix="/api/v1")
app.include_router(templates.router, prefix="/api/v1")
app.include_router(export.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")


@app.get("/")
async def root():
    return {
        "name": "Lexora API",
        "version": "0.1.0",
        "description": "Türk avukatları için AI destekli hukuk araştırma asistanı",
        "docs": "/docs",
    }
