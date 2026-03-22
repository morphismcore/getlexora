"""
Redis cache service.
Caches search results, document content, and verification results.
"""

import json
import hashlib
import structlog
import redis.asyncio as redis

from app.config import get_settings

logger = structlog.get_logger()


class CacheService:
    def __init__(self):
        settings = get_settings()
        self.client = redis.from_url(settings.redis_url, decode_responses=True)

    async def get(self, key: str) -> dict | None:
        """Get cached value."""
        try:
            raw = await self.client.get(key)
            if raw is not None:
                logger.debug("cache_hit", key=key)
                return json.loads(raw)
            logger.debug("cache_miss", key=key)
            return None
        except Exception as e:
            logger.warning("cache_get_error", key=key, error=str(e))
            return None

    async def set(self, key: str, value: dict, ttl: int = 3600):
        """Set cache with TTL in seconds."""
        try:
            await self.client.set(key, json.dumps(value, ensure_ascii=False, default=str), ex=ttl)
            logger.debug("cache_set", key=key, ttl=ttl)
        except Exception as e:
            logger.warning("cache_set_error", key=key, error=str(e))

    async def delete(self, key: str):
        """Delete cached value."""
        try:
            await self.client.delete(key)
        except Exception as e:
            logger.warning("cache_delete_error", key=key, error=str(e))

    async def exists(self, key: str) -> bool:
        """Check if key exists."""
        try:
            return bool(await self.client.exists(key))
        except Exception as e:
            logger.warning("cache_exists_error", key=key, error=str(e))
            return False

    # ── Specialized cache methods ────────────────────────────────────

    async def cache_search(self, query: str, filters: dict, results: dict, ttl: int = 1800):
        """Cache search results. Key: hash of query+filters. TTL: 30 min."""
        key = self.make_key("search", query, json.dumps(filters, sort_keys=True))
        await self.set(key, results, ttl=ttl)

    async def get_cached_search(self, query: str, filters: dict) -> dict | None:
        """Get cached search results."""
        key = self.make_key("search", query, json.dumps(filters, sort_keys=True))
        return await self.get(key)

    async def cache_document(self, document_id: str, content: dict, ttl: int = 86400):
        """Cache full document content. TTL: 24 hours."""
        key = self.make_key("doc", document_id)
        await self.set(key, content, ttl=ttl)

    async def get_cached_document(self, document_id: str) -> dict | None:
        """Get cached document."""
        key = self.make_key("doc", document_id)
        return await self.get(key)

    async def cache_verification(self, text_hash: str, results: dict, ttl: int = 86400):
        """Cache verification results. TTL: 24 hours."""
        key = self.make_key("verify", text_hash)
        await self.set(key, results, ttl=ttl)

    async def get_cached_verification(self, text_hash: str) -> dict | None:
        """Get cached verification."""
        key = self.make_key("verify", text_hash)
        return await self.get(key)

    async def get_stats(self) -> dict:
        """Return cache stats: total keys, memory usage."""
        try:
            info = await self.client.info("memory")
            db_size = await self.client.dbsize()
            return {
                "total_keys": db_size,
                "used_memory": info.get("used_memory_human", "unknown"),
                "used_memory_bytes": info.get("used_memory", 0),
                "status": "ok",
            }
        except Exception as e:
            logger.warning("cache_stats_error", error=str(e))
            return {"status": "error", "error": str(e)}

    async def close(self):
        try:
            await self.client.aclose()
        except Exception as e:
            logger.warning("cache_close_error", error=str(e))

    @staticmethod
    def make_key(*parts) -> str:
        """Create deterministic cache key from parts."""
        raw = ":".join(str(p) for p in parts)
        return f"lexora:{hashlib.md5(raw.encode()).hexdigest()}"
