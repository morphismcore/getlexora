"""
KVKK (Kişisel Verileri Koruma Kurumu) karar servisi.
kvkk.gov.tr üzerinden Kurul kararlarını ve karar özetlerini çeker.

Kararlar sayfası: https://www.kvkk.gov.tr/Icerik/5269/Kurul-Kararlari
Karar özetleri: https://www.kvkk.gov.tr/Icerik/5270/Karar-Ozetleri
Karar detay: https://www.kvkk.gov.tr/Icerik/{id}/{slug}
~800 karar, HTML scraping gerekli.
"""

import asyncio
import re
import structlog
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.ingestion.html_cleaner import clean_legal_html

logger = structlog.get_logger()

KVKK_BASE_URL = "https://www.kvkk.gov.tr"

KVKK_LIST_PAGES = [
    f"{KVKK_BASE_URL}/Icerik/5269/Kurul-Kararlari",
    f"{KVKK_BASE_URL}/Icerik/5270/Karar-Ozetleri",
]

KVKK_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "tr-TR,tr;q=0.9",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Referer": "https://www.kvkk.gov.tr/",
}


class KvkkService:
    """KVKK Kurul kararları servisi."""

    def __init__(self):
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers=KVKK_HEADERS,
            follow_redirects=True,
        )

    async def close(self):
        await self.client.aclose()

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=3, max=20))
    async def list_decisions(self) -> list[dict]:
        """
        Her iki karar sayfasından (5269, 5270) /Icerik/{id}/ linklerini topla.
        Return: [{"id": str, "url": str, "title": str}]
        Duplicate id'ler filtrelenir.
        """
        seen: set[str] = set()
        all_decisions: list[dict] = []

        for page_url in KVKK_LIST_PAGES:
            try:
                resp = await self.client.get(page_url)
                resp.raise_for_status()
                html = resp.text

                decisions = self._parse_decision_links(html)
                for d in decisions:
                    if d["id"] not in seen:
                        seen.add(d["id"])
                        all_decisions.append(d)

                logger.info(
                    "kvkk_list_page_ok",
                    url=page_url,
                    found=len(decisions),
                    unique_total=len(all_decisions),
                )
                await asyncio.sleep(2.0)
            except httpx.HTTPError as e:
                logger.error("kvkk_list_page_error", url=page_url, error=str(e))
                raise

        logger.info("kvkk_list_complete", total=len(all_decisions))
        return all_decisions

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=3, max=20))
    async def get_decision(self, url: str) -> dict:
        """
        Karar detay sayfasından içerik ve metadata çıkar.
        Return: {"content": str, "metadata": {"tarih": str, "karar_no": str, "konu": str}}
        """
        try:
            resp = await self.client.get(url)
            resp.raise_for_status()
            html = resp.text

            content = self._extract_decision_content(html)
            metadata = self._extract_decision_metadata(html)

            logger.info(
                "kvkk_decision_ok",
                url=url,
                content_len=len(content),
            )
            return {
                "content": content,
                "metadata": metadata,
            }
        except httpx.HTTPError as e:
            logger.error("kvkk_decision_error", url=url, error=str(e))
            raise

    def _parse_decision_links(self, html: str) -> list[dict]:
        """HTML'den /Icerik/{id}/{slug} formatındaki karar linklerini çıkar."""
        decisions = []
        seen = set()

        # /Icerik/{id}/{slug} formatındaki tüm linkleri bul
        # Ana liste sayfalarını (5269, 5270) ve statik sayfaları atla
        for match in re.finditer(
            r'<a[^>]*href=["\'](?:https?://www\.kvkk\.gov\.tr)?(/Icerik/(\d+)/([^"\']+))["\'][^>]*>(.*?)</a>',
            html,
            re.DOTALL | re.IGNORECASE,
        ):
            path = match.group(1)
            content_id = match.group(2)
            # slug = match.group(3)
            link_text = match.group(4)

            # Liste sayfalarını atla
            if content_id in ("5269", "5270"):
                continue

            if content_id in seen:
                continue
            seen.add(content_id)

            # Link text'inden title çıkar
            title = re.sub(r"<[^>]+>", "", link_text).strip()
            if not title:
                title = f"KVKK Kurul Kararı {content_id}"

            decisions.append({
                "id": content_id,
                "url": f"{KVKK_BASE_URL}{path}",
                "title": title,
            })

        return decisions

    def _extract_decision_content(self, html: str) -> str:
        """Karar detay sayfasından karar metnini çıkar."""
        # blog-post-inner veya text-align:justify div'leri dene
        patterns = [
            r'<div[^>]*class=["\'][^"\']*blog-post-inner[^"\']*["\'][^>]*>(.*?)</div>\s*(?:</div>|<footer)',
            r'<div[^>]*style=["\'][^"\']*text-align\s*:\s*justify[^"\']*["\'][^>]*>(.*?)</div>',
            r'<div[^>]*(?:id|class)=["\'][^"\']*(?:content|icerik|detail|karar)[^"\']*["\'][^>]*>(.*?)</div>\s*(?:</div>|<footer)',
            r'<article[^>]*>(.*?)</article>',
        ]

        for pattern in patterns:
            match = re.search(pattern, html, re.DOTALL | re.IGNORECASE)
            if match:
                text = clean_legal_html(match.group(1))
                if len(text) > 100:
                    return text

        # Fallback: body content
        body = re.search(r'<body[^>]*>(.*?)</body>', html, re.DOTALL)
        if body:
            return clean_legal_html(body.group(1))

        return clean_legal_html(html)

    def _extract_decision_metadata(self, html: str) -> dict:
        """Karar metadatasını çıkar."""
        metadata = {
            "tarih": "",
            "karar_no": "",
            "konu": "",
        }

        # Karar numarası
        for pattern in [
            r'(?:Karar\s*(?:No|Sayı|Numarası))\s*[:\s]*([\d\-/\.]+)',
            r'(\d{4}/\d+[\-\.\d]*)',
        ]:
            match = re.search(pattern, html, re.IGNORECASE)
            if match:
                metadata["karar_no"] = match.group(1).strip()
                break

        # Tarih
        for pattern in [
            r'(?:Karar\s*Tarihi|Tarih)\s*[:\s]*(\d{2}[./]\d{2}[./]\d{4})',
            r'(\d{2}[./]\d{2}[./]\d{4})',
        ]:
            match = re.search(pattern, html, re.IGNORECASE)
            if match:
                metadata["tarih"] = match.group(1).strip()
                break

        # Konu — title tag veya h1/h2
        title_match = re.search(r'<title[^>]*>(.*?)</title>', html, re.DOTALL | re.IGNORECASE)
        if title_match:
            metadata["konu"] = re.sub(r'<[^>]+>', '', title_match.group(1)).strip()

        for tag in ["h1", "h2"]:
            heading_match = re.search(rf'<{tag}[^>]*>(.*?)</{tag}>', html, re.DOTALL | re.IGNORECASE)
            if heading_match:
                heading_text = re.sub(r'<[^>]+>', '', heading_match.group(1)).strip()
                if heading_text and len(heading_text) > 5:
                    metadata["konu"] = heading_text
                    break

        return metadata
