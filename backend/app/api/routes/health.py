import time

from fastapi import APIRouter, Depends, HTTPException
from app.config import get_settings
from app.api.deps import get_cache_service
from app.api.routes.auth import get_current_user
from app.models.database import User

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    return {"status": "ok", "service": "lexora-backend"}


@router.get("/health/details")
async def health_details(current_user: User = Depends(get_current_user)):
    if current_user.role != "platform_admin":
        raise HTTPException(status_code=403, detail="Platform admin yetkisi gerekli")
    """Tum bagimliliklarin durumunu kontrol et — response_time_ms dahil."""
    settings = get_settings()
    checks = {}

    # Qdrant — koleksiyon bazinda point count
    t0 = time.monotonic()
    try:
        from qdrant_client import QdrantClient
        client = QdrantClient(url=f"http://{settings.qdrant_host}:{settings.qdrant_port}", timeout=5)
        collections = client.get_collections().collections
        collection_details = {}
        for col in collections:
            try:
                info = client.get_collection(col.name)
                collection_details[col.name] = info.points_count or 0
            except Exception:
                collection_details[col.name] = -1
        elapsed = round((time.monotonic() - t0) * 1000, 1)
        checks["qdrant"] = {
            "status": "ok",
            "response_time_ms": elapsed,
            "collections": collection_details,
            "total_points": sum(v for v in collection_details.values() if v >= 0),
        }
    except Exception as e:
        elapsed = round((time.monotonic() - t0) * 1000, 1)
        checks["qdrant"] = {"status": "error", "error": str(e), "response_time_ms": elapsed}

    # Redis — ping + memory info
    t0 = time.monotonic()
    try:
        import redis as r
        rc = r.from_url(settings.redis_url, socket_timeout=5)
        rc.ping()
        info = rc.info(section="memory")
        elapsed = round((time.monotonic() - t0) * 1000, 1)
        checks["redis"] = {
            "status": "ok",
            "response_time_ms": elapsed,
            "used_memory_human": info.get("used_memory_human", "unknown"),
        }
    except Exception as e:
        elapsed = round((time.monotonic() - t0) * 1000, 1)
        checks["redis"] = {"status": "error", "error": str(e), "response_time_ms": elapsed}

    # PostgreSQL — SELECT 1
    t0 = time.monotonic()
    try:
        from sqlalchemy import text
        from app.models.db import async_session
        async with async_session() as session:
            await session.execute(text("SELECT 1"))
        elapsed = round((time.monotonic() - t0) * 1000, 1)
        checks["postgres"] = {"status": "ok", "response_time_ms": elapsed}
    except Exception as e:
        elapsed = round((time.monotonic() - t0) * 1000, 1)
        checks["postgres"] = {"status": "error", "error": str(e), "response_time_ms": elapsed}

    # Bedesten API
    t0 = time.monotonic()
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{settings.bedesten_base_url}")
            elapsed = round((time.monotonic() - t0) * 1000, 1)
            checks["bedesten"] = {
                "status": "ok" if resp.status_code < 500 else "error",
                "http_status": resp.status_code,
                "response_time_ms": elapsed,
            }
    except Exception as e:
        elapsed = round((time.monotonic() - t0) * 1000, 1)
        checks["bedesten"] = {"status": "error", "error": str(e), "response_time_ms": elapsed}

    all_ok = all(
        (c.get("status") if isinstance(c, dict) else c) == "ok"
        for c in checks.values()
    )
    return {"status": "ok" if all_ok else "degraded", "checks": checks}


@router.get("/health/llm")
async def health_llm():
    """Claude API key kontrolu — AI Asistan durumu. Public endpoint (hassas bilgi yok)."""
    settings = get_settings()

    if not settings.anthropic_api_key:
        return {"status": "unavailable"}

    try:
        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://api.anthropic.com/v1/models",
                headers={
                    "x-api-key": settings.anthropic_api_key,
                    "anthropic-version": "2023-06-01",
                },
            )
            if resp.status_code == 200:
                return {"status": "ok"}
            else:
                return {"status": "error"}
    except Exception as e:
        return {"status": "error"}


@router.get("/health/cache")
async def health_cache(current_user: User = Depends(get_current_user)):
    if current_user.role != "platform_admin":
        raise HTTPException(status_code=403, detail="Platform admin yetkisi gerekli")
    """Redis cache istatistikleri."""
    cache = get_cache_service()
    if cache is None:
        return {"status": "unavailable", "error": "Cache service not initialized"}
    stats = await cache.get_stats()
    return stats