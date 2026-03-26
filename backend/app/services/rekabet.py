"""
Rekabet Kurumu karar servisi.
rekabet.gov.tr üzerinden Rekabet Kurulu kararlarını çeker.

Kararlar sayfası: https://www.rekabet.gov.tr/tr/Kararlar?page={page}
Karar detay: https://www.rekabet.gov.tr/Karar?kararId={id}
~10.200 karar, sayfa başına ~10, toplam ~1020 sayfa.
"""

import asyncio
import re
import structlog
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.ingestion.html_cleaner import clean_legal_html

logger = structlog.get_logger()

REKABET_BASE_URL = "https://www.rekabet.gov.tr"

REKABET_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "tr-TR,tr;q=0.9",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Referer": "https://www.rekabet.gov.tr/tr/Kararlar",
}


class RekabetService:
    """Rekabet Kurumu karar servisi."""

    def __init__(self):
        self.client = httpx.AsyncClient(
            timeout=60.0,
            headers=REKABET_HEADERS,
            follow_redirects=True,
        )

    async def close(self):
        await self.client.aclose()

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=15))
    async def search_decisions(self, page: int = 1) -> dict:
        """
        Kararlar listesi sayfasını parse et.
        Return: {"total_pages": int, "decisions": [{"karar_id", "title", "date", "url"}]}
        """
        try:
            resp = await self.client.get(
                f"{REKABET_BASE_URL}/tr/Kararlar",
                params={"page": page},
            )
            resp.raise_for_status()
            html = resp.text

            decisions = self._parse_decision_list(html)
            total_pages = self._parse_total_pages(html)

            logger.info(
                "rekabet_search_ok",
                page=page,
                total_pages=total_pages,
                returned=len(decisions),
            )
            return {"total_pages": total_pages, "decisions": decisions}
        except httpx.HTTPError as e:
            logger.error("rekabet_search_error", page=page, error=str(e))
            raise

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=15))
    async def get_decision(self, karar_id: str) -> dict:
        """
        Karar detay sayfasından tam metni çıkar.
        Return: {"karar_id", "content", "metadata": {"title", "date", "decision_no"}}
        """
        try:
            resp = await self.client.get(
                f"{REKABET_BASE_URL}/Karar",
                params={"kararId": karar_id},
            )
            resp.raise_for_status()
            html = resp.text

            content = self._extract_decision_content(html)
            metadata = self._extract_decision_metadata(html)

            logger.info(
                "rekabet_decision_ok",
                karar_id=karar_id,
                content_len=len(content),
            )
            return {
                "karar_id": karar_id,
                "content": content,
                "metadata": metadata,
            }
        except httpx.HTTPError as e:
            logger.error("rekabet_decision_error", karar_id=karar_id, error=str(e))
            raise

    def _parse_decision_list(self, html: str) -> list[dict]:
        """Kararlar listesinden karar bilgilerini çıkar."""
        decisions = []
        seen = set()

        # kararId parametreli linkleri bul
        for match in re.finditer(
            r'<a[^>]*href=["\'][^"\']*kararId=(\d+)[^"\']*["\'][^>]*>(.*?)</a>',
            html,
            re.DOTALL | re.IGNORECASE,
        ):
            karar_id = match.group(1)
            if karar_id in seen:
                continue
            seen.add(karar_id)

            # Link text'inden title çıkar
            title = re.sub(r"<[^>]+>", "", match.group(2)).strip()
            if not title:
                title = f"Rekabet Kurulu Kararı {karar_id}"

            decisions.append({
                "karar_id": karar_id,
                "title": title,
                "date": "",
                "url": f"{REKABET_BASE_URL}/Karar?kararId={karar_id}",
            })

        # Tarihleri yakın HTML'den çıkarmayı dene
        # Tarih formatı: dd.mm.yyyy veya dd/mm/yyyy
        date_matches = re.findall(
            r'(\d{2}[./]\d{2}[./]\d{4})',
            html,
        )
        # Tarihleri sırayla kararlarla eşleştir (best effort)
        for i, decision in enumerate(decisions):
            if i < len(date_matches):
                decision["date"] = date_matches[i]

        return decisions

    def _parse_total_pages(self, html: str) -> int:
        """Pagination'dan toplam sayfa sayısını çıkar."""
        # Son sayfa linkindeki page numarasını bul
        page_numbers = re.findall(r'[?&]page=(\d+)', html)
        if page_numbers:
            return max(int(p) for p in page_numbers)

        # Alternatif: pagination class'ından sayfa numarası
        page_nums = re.findall(
            r'<(?:a|li|span)[^>]*class=["\'][^"\']*pag[^"\']*["\'][^>]*>(\d+)<',
            html,
            re.IGNORECASE,
        )
        if page_nums:
            return max(int(p) for p in page_nums)

        return 1

    def _extract_decision_content(self, html: str) -> str:
        """Karar detay sayfasından karar metnini çıkar."""
        # Ana content alanını bul — çeşitli CSS class/id denemeleri
        patterns = [
            r'<div[^>]*(?:id|class)=["\'][^"\']*(?:karar|content|detail|icerik)[^"\']*["\'][^>]*>(.*?)</div>\s*(?:</div>|<footer|<div[^>]*class=["\']footer)',
            r'<article[^>]*>(.*?)</article>',
            r'<div[^>]*class=["\'][^"\']*(?:col-md|main-content|page-content)[^"\']*["\'][^>]*>(.*?)</div>\s*</div>',
        ]

        for pattern in patterns:
            match = re.search(pattern, html, re.DOTALL | re.IGNORECASE)
            if match:
                text = clean_legal_html(match.group(1))
                if len(text) > 200:
                    return text

        # Fallback: body content
        body = re.search(r'<body[^>]*>(.*?)</body>', html, re.DOTALL)
        if body:
            return clean_legal_html(body.group(1))

        return clean_legal_html(html)

    def _extract_decision_metadata(self, html: str) -> dict:
        """Karar metadatasını çıkar."""
        metadata = {
            "title": "",
            "date": "",
            "decision_no": "",
        }

        # Karar numarası
        for pattern in [
            r'(?:Karar\s*(?:No|Sayı|Numarası))\s*[:\s]*([\d\-/]+)',
            r'(?:Dosya\s*(?:No|Sayı))\s*[:\s]*([\d\-/]+)',
        ]:
            match = re.search(pattern, html, re.IGNORECASE)
            if match:
                metadata["decision_no"] = match.group(1).strip()
                break

        # Tarih
        for pattern in [
            r'(?:Karar\s*Tarihi|Tarih)\s*[:\s]*(\d{2}[./]\d{2}[./]\d{4})',
            r'(\d{2}[./]\d{2}[./]\d{4})',
        ]:
            match = re.search(pattern, html, re.IGNORECASE)
            if match:
                metadata["date"] = match.group(1).strip()
                break

        # Title — <title> tag veya h1
        title_match = re.search(r'<title[^>]*>(.*?)</title>', html, re.DOTALL | re.IGNORECASE)
        if title_match:
            metadata["title"] = re.sub(r'<[^>]+>', '', title_match.group(1)).strip()

        h1_match = re.search(r'<h1[^>]*>(.*?)</h1>', html, re.DOTALL | re.IGNORECASE)
        if h1_match:
            h1_text = re.sub(r'<[^>]+>', '', h1_match.group(1)).strip()
            if h1_text:
                metadata["title"] = h1_text

        return metadata
