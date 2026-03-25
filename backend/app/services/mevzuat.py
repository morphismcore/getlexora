"""
Türk mevzuat erişim servisi.
Bedesten API (bedesten.adalet.gov.tr/mevzuat) üzerinden
kanun, KHK, yönetmelik gibi mevzuatları arar.
"""

import base64
import httpx
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import get_settings

logger = structlog.get_logger()

# Mevzuat türleri
MEVZUAT_TURLERI = {
    "kanun": "KANUN",
    "khk": "KHK",
    "tuzuk": "TUZUK",
    "yonetmelik": "KURUM_YONETMELIGI",
    "cb_kararnamesi": "CB_KARARNAMESI",
    "cb_karari": "CB_KARARI",
    "cb_yonetmeligi": "CB_YONETMELIGI",
    "teblig": "TEBLIG",
}

BEDESTEN_HEADERS = {
    "Content-Type": "application/json; charset=utf-8",
    "AdaletApplicationName": "UyapMevzuat",
    "Origin": "https://mevzuat.adalet.gov.tr",
    "Referer": "https://mevzuat.adalet.gov.tr/",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
}


class MevzuatService:
    """Bedesten API üzerinden mevzuat arama servisi."""

    def __init__(self, cache=None):
        settings = get_settings()
        self.base_url = f"{settings.bedesten_base_url}/mevzuat"
        self.cache = cache
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers=BEDESTEN_HEADERS,
        )

    async def close(self):
        await self.client.aclose()

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
    async def search(
        self,
        keyword: str,
        mevzuat_turu: str | None = None,
        mevzuat_no: str | None = None,
        page: int = 1,
        page_size: int = 10,
    ) -> dict:
        """
        Bedesten mevzuat API'de arama.
        POST /mevzuat/searchDocuments
        """
        inner = {
            "pageSize": min(page_size, 25),
            "pageNumber": page,
            "sortFields": ["RESMI_GAZETE_TARIHI"],
            "sortDirection": "desc",
            "phrase": keyword,
        }

        if mevzuat_turu and mevzuat_turu in MEVZUAT_TURLERI:
            inner["mevzuatTurList"] = [MEVZUAT_TURLERI[mevzuat_turu]]

        if mevzuat_no:
            inner["mevzuatNo"] = mevzuat_no

        payload = {
            "data": inner,
            "applicationName": "UyapMevzuat",
            "paging": True,
        }

        # Check cache first (TTL: 6 hours for mevzuat — changes less frequently)
        if self.cache:
            try:
                filters = {"mevzuat_turu": mevzuat_turu, "mevzuat_no": mevzuat_no, "page": page, "page_size": page_size}
                cached = await self.cache.get_cached_search(keyword, filters)
                if cached is not None:
                    logger.info("mevzuat_search_cache_hit", keyword=keyword)
                    return cached
            except Exception:
                pass

        try:
            resp = await self.client.post(
                f"{self.base_url}/searchDocuments",
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()

            inner_data = data.get("data") or {}
            items = inner_data.get("mevzuatList") or []
            total = inner_data.get("total") or 0

            logger.info(
                "mevzuat_search_ok",
                keyword=keyword,
                total=total,
                returned=len(items),
            )

            # Normalize
            results = []
            for item in items:
                results.append({
                    "mevzuat_id": item.get("mevzuatId", ""),
                    "kanun_adi": item.get("mevzuatAdi", ""),
                    "kanun_no": item.get("mevzuatNo", ""),
                    "tur": item.get("mevzuatTur", {}).get("description", ""),
                    "resmi_gazete_tarihi": item.get("resmiGazeteTarihi", ""),
                    "resmi_gazete_sayisi": item.get("resmiGazeteSayisi", ""),
                })

            result = {"sonuclar": results, "toplam": total}

            # Store in cache (TTL: 6 hours)
            if self.cache:
                try:
                    filters = {"mevzuat_turu": mevzuat_turu, "mevzuat_no": mevzuat_no, "page": page, "page_size": page_size}
                    await self.cache.cache_search(keyword, filters, result, ttl=21600)
                except Exception:
                    pass

            return result
        except httpx.HTTPError as e:
            logger.error("mevzuat_search_error", error=str(e), keyword=keyword)
            raise

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
    async def get_content(self, mevzuat_id: str) -> dict:
        """Mevzuat tam metnini getir."""
        payload = {
            "data": {"documentType": "MEVZUAT", "id": mevzuat_id},
            "applicationName": "UyapMevzuat",
        }

        try:
            resp = await self.client.post(
                f"{self.base_url}/getDocumentContent",
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()

            content_b64 = data.get("data", {}).get("content", "")
            mime_type = data.get("data", {}).get("mimeType", "text/html")

            if content_b64:
                decoded = base64.b64decode(content_b64).decode("utf-8", errors="replace")
                return {"content": decoded, "mime_type": mime_type}

            return {"content": "", "error": "İçerik alınamadı"}
        except httpx.HTTPError as e:
            logger.error("mevzuat_content_error", error=str(e))
            raise

    async def get_madde(self, madde_id: str) -> dict:
        """Belirli bir maddenin metnini getir."""
        payload = {
            "data": {"documentType": "MADDE", "id": madde_id},
            "applicationName": "UyapMevzuat",
        }

        try:
            resp = await self.client.post(
                f"{self.base_url}/getDocumentContent",
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()

            content_b64 = data.get("data", {}).get("content", "")
            if content_b64:
                decoded = base64.b64decode(content_b64).decode("utf-8", errors="replace")
                return {"content": decoded}

            return {"content": "", "error": "Madde içeriği alınamadı"}
        except httpx.HTTPError as e:
            logger.error("mevzuat_madde_error", error=str(e))
            raise

    async def verify_madde(
        self,
        kanun_no: str | None = None,
        madde_no: str | None = None,
    ) -> dict:
        """Bir mevzuat referansını doğrula."""
        if not kanun_no:
            return {"verified": False, "reason": "kanun_no gerekli"}

        try:
            result = await self.search(keyword="", mevzuat_no=kanun_no, page_size=5)
            items = result.get("sonuclar", [])

            if items:
                return {
                    "verified": True,
                    "kanun": items[0].get("kanun_adi", ""),
                    "kanun_no": kanun_no,
                    "madde_no": madde_no,
                }

            return {"verified": False, "reason": f"{kanun_no} sayılı mevzuat bulunamadı"}
        except Exception as e:
            return {"verified": False, "reason": f"Doğrulama hatası: {str(e)}"}
