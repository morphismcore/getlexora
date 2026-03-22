from fastapi import APIRouter, Depends
from app.config import get_settings
from app.api.deps import get_cache_service

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    return {"status": "ok", "service": "lexora-backend"}


@router.get("/health/details")
async def health_details():
    """Tüm bağımlılıkların durumunu kontrol et."""
    settings = get_settings()
    checks = {}

    # Qdrant
    try:
        from qdrant_client import QdrantClient
        client = QdrantClient(host=settings.qdrant_host, port=settings.qdrant_port, timeout=5)
        client.get_collections()
        checks["qdrant"] = "ok"
    except Exception as e:
        checks["qdrant"] = f"error: {str(e)}"

    # Redis
    try:
        import redis as r
        rc = r.from_url(settings.redis_url, socket_timeout=5)
        rc.ping()
        checks["redis"] = "ok"
    except Exception as e:
        checks["redis"] = f"error: {str(e)}"

    # Bedesten API
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{settings.bedesten_base_url}")
            checks["bedesten"] = "ok" if resp.status_code < 500 else f"status: {resp.status_code}"
    except Exception as e:
        checks["bedesten"] = f"error: {str(e)}"

    all_ok = all(v == "ok" for v in checks.values())
    return {"status": "ok" if all_ok else "degraded", "checks": checks}


@router.get("/health/cache")
async def health_cache():
    """Redis cache istatistikleri."""
    cache = get_cache_service()
    if cache is None:
        return {"status": "unavailable", "error": "Cache service not initialized"}
    stats = await cache.get_stats()
    return stats
