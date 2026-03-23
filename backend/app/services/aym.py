"""
Anayasa Mahkemesi karar servisi.
kararlarbilgibankasi.anayasa.gov.tr üzerinden bireysel başvuru kararlarını arar.

URL formatı: /BB/{yıl}/{sıra} (örn: /BB/2021/31592)
İçerik: KararDetay class'ı içinde HTML metin
"""

import re
import structlog
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.ingestion.html_cleaner import clean_legal_html

logger = structlog.get_logger()

AYM_BASE_URL = "https://kararlarbilgibankasi.anayasa.gov.tr"

AYM_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "tr-TR,tr;q=0.9",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Referer": "https://kararlarbilgibankasi.anayasa.gov.tr/",
}


class AymService:
    """AYM bireysel başvuru karar servisi."""

    def __init__(self):
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
        """Bireysel başvuru kararları arama. Sonuçlar /BB/{yıl}/{sıra} formatında."""
        params = {
            "sayfaNo": page,
            "sayfaBoyutu": page_size,
        }
        if keyword:
            params["arananKelime"] = keyword
        if ihlal_only:
            params["kararSonucu"] = "İhlal"

        try:
            resp = await self.client.get(f"{AYM_BASE_URL}/Ara", params=params)
            resp.raise_for_status()
            html = resp.text

            results = self._parse_search_results(html)
            total = self._parse_total(html)

            logger.info("aym_search_ok", keyword=keyword, total=total, returned=len(results))
            return {"total": total, "results": results, "page": page}
        except httpx.HTTPError as e:
            logger.error("aym_search_error", error=str(e))
            raise

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=5, max=30))
    async def get_document(self, basvuru_no: str) -> dict:
        """
        Bireysel başvuru kararının tam metnini getir.
        URL: /BB/{yıl}/{sıra} (örn: basvuru_no="2021/31592" → /BB/2021/31592)
        """
        # URL formatı: /BB/2021/31592
        url_path = basvuru_no.replace("/", "/")
        try:
            resp = await self.client.get(f"{AYM_BASE_URL}/BB/{url_path}")
            resp.raise_for_status()
            html = resp.text

            content = self._extract_karar_content(html)
            metadata = self._extract_karar_metadata(html)

            logger.info("aym_document_ok", basvuru_no=basvuru_no, content_len=len(content))
            return {
                "basvuru_no": basvuru_no,
                "content": content,
                "metadata": metadata,
            }
        except httpx.HTTPError as e:
            logger.error("aym_document_error", error=str(e), basvuru_no=basvuru_no)
            raise

    def _parse_search_results(self, html: str) -> list[dict]:
        """Arama sayfasından /BB/ linklerindeki başvuru numaralarını çıkar."""
        results = []
        seen = set()

        # /BB/2021/31592 formatındaki linkleri bul
        for match in re.finditer(r'/BB/(\d{4}/\d+)', html):
            basvuru_no = match.group(1)
            if basvuru_no in seen:
                continue
            seen.add(basvuru_no)
            results.append({
                "basvuru_no": basvuru_no,
                "kaynak": "aym",
            })

        return results

    def _parse_total(self, html: str) -> int:
        """Toplam sonuç sayısını parse et."""
        match = re.search(r'(\d[\d.]*)\s*(?:sonuç|kayıt|karar)', html, re.IGNORECASE)
        if match:
            return int(match.group(1).replace(".", ""))
        return 0

    def _extract_karar_content(self, html: str) -> str:
        """KararDetay bölümünden karar metnini çıkar."""
        # KararDetay class'ı içindeki metni bul
        match = re.search(
            r'KararDetay[^>]*>(.*?)(?:<footer|<div[^>]*class=["\']footer)',
            html,
            re.DOTALL | re.IGNORECASE,
        )
        if match:
            return clean_legal_html(match.group(1))

        # Fallback: tüm body
        body = re.search(r'<body[^>]*>(.*?)</body>', html, re.DOTALL)
        if body:
            return clean_legal_html(body.group(1))

        return clean_legal_html(html)

    def _extract_karar_metadata(self, html: str) -> dict:
        """Karar metadatasını çıkar."""
        metadata = {}
        patterns = {
            "basvuru_no": r'B\.\s*No:\s*(\d{4}/\d+)',
            "karar_tarihi": r'Karar\s*Tarihi\s*[:\s]*([\d./]+)',
            "konu": r'Konu\s*[:\s]*([^<\n]+)',
            "sonuc": r'(?:Karar\s*Sonucu|Sonuç)\s*[:\s]*([^<\n]+)',
            "ihlal_edilen_hak": r'İhlal\s*(?:Edilen|edilen)\s*(?:Hak|hak)[^:]*[:\s]*([^<\n]+)',
        }
        for key, pattern in patterns.items():
            match = re.search(pattern, html, re.IGNORECASE)
            if match:
                metadata[key] = match.group(1).strip()
        return metadata
