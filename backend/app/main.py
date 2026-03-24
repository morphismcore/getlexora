"""
Lexora Backend — Ana FastAPI Uygulaması.
Türk avukatları için AI destekli hukuk araştırma asistanı.
"""

import time
import uuid as _uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
import structlog

from app.config import get_settings
from app.api.routes import health, search, ingest, auth, cases, deadlines, statistics, dashboard, upload, templates, export, admin, notifications
from app.api.deps import get_vector_store, cleanup
from app.models.db import init_db
from app.scheduler import start_scheduler, stop_scheduler

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

    if settings.env == "production" and settings.jwt_secret == "lexora-dev-secret-change-in-production":
        logger.error("FATAL: JWT_SECRET must be changed in production!")
        raise RuntimeError("JWT_SECRET not configured for production")

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

    # Scheduler baslat (skip if Celery Beat handles scheduling)
    if not settings.use_celery:
        await start_scheduler()
    else:
        logger.info("apscheduler_skipped", reason="USE_CELERY=true, Celery Beat handles scheduling")

    # Preload embedding model at startup (prevents OOM on first search)
    try:
        from app.services.embedding import EmbeddingService
        emb = EmbeddingService()
        emb.embed_query("preload")  # Forces model load
        logger.info("embedding_model_preloaded")
    except Exception as e:
        logger.warning("embedding_preload_skip", error=str(e))

    yield

    # Shutdown
    await stop_scheduler()
    await cleanup()
    logger.info("lexora_shutdown")


_settings = get_settings()

app = FastAPI(
    title="Lexora API",
    description="Türk avukatları için AI destekli hukuk araştırma asistanı",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if _settings.env != "production" else None,
    redoc_url="/redoc" if _settings.env != "production" else None,
    openapi_url="/openapi.json" if _settings.env != "production" else None,
)

# Request metrics (module-level counters for monitoring)
import threading
from collections import deque

class _RequestMetrics:
    """Thread-safe request metrics collector."""
    def __init__(self):
        self._lock = threading.Lock()
        self.total = 0
        self.errors = 0
        self.total_duration_ms = 0.0
        self._recent: deque[tuple[float, float]] = deque(maxlen=500)  # (timestamp, duration_ms)

    def record(self, duration_ms: float, is_error: bool):
        with self._lock:
            self.total += 1
            self.total_duration_ms += duration_ms
            if is_error:
                self.errors += 1
            now = time.time()
            self._recent.append((now, duration_ms))

    @property
    def requests_per_minute(self) -> float:
        with self._lock:
            if not self._recent:
                return 0.0
            now = time.time()
            cutoff = now - 60
            count = sum(1 for t, _ in self._recent if t > cutoff)
            return round(count, 1)

    @property
    def avg_response_time_ms(self) -> float:
        with self._lock:
            if self.total == 0:
                return 0.0
            return round(self.total_duration_ms / self.total, 2)

    @property
    def error_rate_pct(self) -> float:
        with self._lock:
            if self.total == 0:
                return 0.0
            return round((self.errors / self.total) * 100, 2)

request_metrics = _RequestMetrics()

# Request logging middleware
class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(_uuid.uuid4())[:8]
        start = time.monotonic()

        # Store request_id for use in route handlers
        request.state.request_id = request_id

        response = await call_next(request)

        duration_ms = round((time.monotonic() - start) * 1000, 1)
        is_error = response.status_code >= 500
        request_metrics.record(duration_ms, is_error)

        # Add request ID to response headers
        response.headers["X-Request-ID"] = request_id

        if not request.url.path.startswith("/health"):
            logger.info(
                "request",
                request_id=request_id,
                method=request.method,
                path=request.url.path,
                status=response.status_code,
                duration_ms=duration_ms,
            )
        return response

app.add_middleware(RequestLoggingMiddleware)

# CORS — frontend icin (environment-based)
_settings = get_settings()
_cors_origins = [o.strip() for o in _settings.cors_origins.split(",") if o.strip()] if _settings.cors_origins else [
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
app.include_router(notifications.router, prefix="/api/v1")


@app.get("/")
async def root():
    return {
        "name": "Lexora API",
        "version": "0.1.0",
        "description": "Türk avukatları için AI destekli hukuk araştırma asistanı",
        "docs": "/docs",
    }
