"""
Anayasa Mahkemesi karar servisi.
kararlarbilgibankasi.anayasa.gov.tr uzerinden
bireysel basvuru ve norm denetimi kararlarini arar.
"""

import asyncio
import re
import structlog
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import get_settings

logger = structlog.get_logger()

AYM_BASE_URL = "https://kararlarbilgibankasi.anayasa.gov.tr"

AYM_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "tr-TR,tr;q=0.9",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Referer": "https://kararlarbilgibankasi.anayasa.gov.tr/",
}


class AymService:
    """AYM karar arama servisi."""

    def __init__(self, cache=None):
        self.cache = cache
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers=AYM_HEADERS,
            follow_redirects=True,
        )

    async def close(self):
        await self.client.aclose()

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=5, max=30))
    async def search_bireysel_basvuru(
        self,
        keyword: str = "",
        page: int = 1,
        page_size: int = 20,
        ihlal_only: bool = True,
    ) -> dict:
        """
        Bireysel basvuru kararlari arama.
        ihlal_only=True: sadece ihlal kararlarini dondurur.
        """
        params = {
            "arananKelime": keyword,
            "sayfaNo": page,
            "sayfaBoyutu": page_size,
        }
        if ihlal_only:
            params["kararSonucu"] = "İhlal"

        try:
            resp = await self.client.get(
                f"{AYM_BASE_URL}/Ara",
                params=params,
            )
            resp.raise_for_status()
            html = resp.text

            results = self._parse_search_results(html)
            total = self._parse_total(html)

            logger.info(
                "aym_search_ok",
                keyword=keyword,
                total=total,
                returned=len(results),
            )

            return {
                "total": total,
                "results": results,
                "page": page,
            }
        except httpx.HTTPError as e:
            logger.error("aym_search_error", error=str(e), keyword=keyword)
            raise

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=5, max=30))
    async def get_document(self, basvuru_no: str) -> dict:
        """Bireysel basvuru kararinin tam metnini getir."""
        try:
            resp = await self.client.get(
                f"{AYM_BASE_URL}/Karar/{basvuru_no}",
            )
            resp.raise_for_status()
            html = resp.text

            content = self._extract_karar_content(html)
            metadata = self._extract_karar_metadata(html)

            return {
                "basvuru_no": basvuru_no,
                "content": content,
                "metadata": metadata,
            }
        except httpx.HTTPError as e:
            logger.error("aym_document_error", error=str(e), basvuru_no=basvuru_no)
            raise

    def _parse_search_results(self, html: str) -> list[dict]:
        """Arama sonuclarini HTML'den parse et."""
        results = []

        # Karar kartlarini bul
        pattern = re.compile(
            r'<tr[^>]*>.*?'
            r'(?:Başvuru\s*(?:No|Numarası)\s*[:\s]*)([\d/]+).*?'
            r'(?:Karar\s*Tarihi\s*[:\s]*)([\d./]+).*?'
            r'(?:Konu\s*[:\s]*)([^<]+)',
            re.DOTALL | re.IGNORECASE,
        )

        for match in pattern.finditer(html):
            results.append({
                "basvuru_no": match.group(1).strip(),
                "karar_tarihi": match.group(2).strip(),
                "konu": match.group(3).strip(),
                "kaynak": "aym",
            })

        # Fallback: link bazli parsing
        if not results:
            link_pattern = re.compile(
                r'href=["\']*/Karar/([^"\']+)["\'][^>]*>([^<]+)',
                re.IGNORECASE,
            )
            for match in link_pattern.finditer(html):
                results.append({
                    "basvuru_no": match.group(1).strip(),
                    "baslik": match.group(2).strip(),
                    "kaynak": "aym",
                })

        return results

    def _parse_total(self, html: str) -> int:
        """Toplam sonuc sayisini parse et."""
        match = re.search(r'(\d[\d.]*)\s*(?:sonuç|kayıt|karar)', html, re.IGNORECASE)
        if match:
            return int(match.group(1).replace(".", ""))
        return 0

    def _extract_karar_content(self, html: str) -> str:
        """Karar metnini HTML'den cikar."""
        # Ana icerik alanini bul
        content_match = re.search(
            r'<div[^>]*(?:class|id)=["\'][^"\']*(?:karar|content|metin)[^"\']*["\'][^>]*>(.*?)</div>',
            html,
            re.DOTALL | re.IGNORECASE,
        )

        if content_match:
            content = content_match.group(1)
        else:
            # Fallback: body icerigi
            body_match = re.search(r'<body[^>]*>(.*?)</body>', html, re.DOTALL)
            content = body_match.group(1) if body_match else html

        # HTML temizle
        from app.ingestion.html_cleaner import clean_legal_html
        return clean_legal_html(content)

    def _extract_karar_metadata(self, html: str) -> dict:
        """Karar metadatasini cikar."""
        metadata = {}

        patterns = {
            "basvuru_no": r'Başvuru\s*(?:No|Numarası)\s*[:\s]*([\d/]+)',
            "karar_tarihi": r'Karar\s*Tarihi\s*[:\s]*([\d./]+)',
            "basvuru_tarihi": r'Başvuru\s*Tarihi\s*[:\s]*([\d./]+)',
            "konu": r'Konu\s*[:\s]*([^<\n]+)',
            "sonuc": r'(?:Karar\s*Sonucu|Sonuç)\s*[:\s]*([^<\n]+)',
            "ihlal_edilen_hak": r'İhlal\s*(?:Edilen|edilen)\s*(?:Hak|hak)\s*[:\s]*([^<\n]+)',
        }

        for key, pattern in patterns.items():
            match = re.search(pattern, html, re.IGNORECASE)
            if match:
                metadata[key] = match.group(1).strip()

        return metadata
