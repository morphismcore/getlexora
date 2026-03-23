"""
AİHM (Avrupa İnsan Hakları Mahkemesi) karar servisi.
HUDOC API üzerinden Türkiye aleyhine kararları arar.

Çalışan query formatı: contentsitename=ECHR AND respondent=TUR
Sort: kpdate Descending (judgementdate Descending çalışmıyor)
Tırnaksız değerler kullanılmalı (respondent=TUR, respondent="TUR" değil)
Belge: /app/conversion/docx/html/body?library=ECHR&id={itemid}&filename=x.docx&logEvent=False
"""

import re
import structlog
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.ingestion.html_cleaner import clean_legal_html

logger = structlog.get_logger()

HUDOC_SEARCH_URL = "https://hudoc.echr.coe.int/app/query/results"
HUDOC_DOC_URL = "https://hudoc.echr.coe.int/app/conversion/docx/html/body"

# ECHR madde isimleri → Türkçe
ARTICLE_TR = {
    "2": "Yaşam hakkı",
    "3": "İşkence yasağı",
    "5": "Özgürlük ve güvenlik hakkı",
    "6": "Adil yargılanma hakkı",
    "8": "Özel ve aile hayatına saygı",
    "9": "Düşünce, vicdan ve din özgürlüğü",
    "10": "İfade özgürlüğü",
    "11": "Toplantı ve dernek kurma özgürlüğü",
    "13": "Etkili başvuru hakkı",
    "14": "Ayrımcılık yasağı",
    "P1-1": "Mülkiyet hakkı",
}


class HudocService:
    """HUDOC API üzerinden AİHM kararlarına erişim."""

    def __init__(self):
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers={
                "Accept": "application/json",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            },
            follow_redirects=True,
        )

    async def close(self):
        await self.client.aclose()

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=3, max=30))
    async def search_judgments(
        self,
        respondent: str = "TUR",
        start: int = 0,
        length: int = 50,
        importance: str | None = None,
        language: str | None = None,
    ) -> dict:
        """
        Türkiye aleyhine AİHM kararlarını ara.
        Tırnaksız query değerleri kullan, sort="" veya "kpdate Descending".
        """
        query_parts = ['contentsitename=ECHR']
        if respondent:
            query_parts.append(f'respondent={respondent}')
        if importance:
            query_parts.append(f'importance={importance}')
        if language:
            query_parts.append(f'languageisocode={language}')

        query = " AND ".join(query_parts)

        params = {
            "query": query,
            "select": "itemid,appno,docname,respondent,judgementdate,"
                      "violation,conclusion,importance,"
                      "languageisocode,doctypebranch",
            "sort": "kpdate Descending",
            "start": start,
            "length": min(length, 500),
            "rankingModelId": "11111111-0000-0000-0000-000000000000",
        }

        try:
            resp = await self.client.get(HUDOC_SEARCH_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

            results = data.get("results", [])
            total = data.get("resultcount", 0)

            parsed = [self._parse_result(r) for r in results if r.get("columns")]

            logger.info("hudoc_search_ok", respondent=respondent, total=total, returned=len(parsed))
            return {"total": total, "results": parsed, "start": start}
        except httpx.HTTPError as e:
            logger.error("hudoc_search_error", error=str(e))
            raise

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=3, max=30))
    async def get_document(self, itemid: str) -> str:
        """Kararın tam metnini HTML olarak getir ve temizle."""
        params = {
            "library": "ECHR",
            "id": itemid,
            "filename": "judgment.docx",
            "logEvent": "False",
        }
        try:
            resp = await self.client.get(HUDOC_DOC_URL, params=params)
            if resp.status_code == 204:
                return ""
            resp.raise_for_status()
            return clean_legal_html(resp.text)
        except httpx.HTTPError as e:
            logger.error("hudoc_document_error", error=str(e), itemid=itemid)
            raise

    def _parse_result(self, result: dict) -> dict:
        """HUDOC API sonucunu normalize et."""
        cols = result.get("columns", {})

        # İhlal edilen maddeleri Türkçeleştir
        violation = cols.get("violation", "") or ""
        violation_articles = []
        if violation:
            for article_num in re.findall(r"(\d+|P\d+-\d+)", violation):
                tr_name = ARTICLE_TR.get(article_num, f"Madde {article_num}")
                violation_articles.append(tr_name)

        importance_map = {"1": "Anahtar", "2": "Önemli", "3": "Standart", "4": "Düşük"}

        return {
            "karar_id": f"aihm_{cols.get('itemid', '')}",
            "itemid": cols.get("itemid", ""),
            "basvuru_no": cols.get("appno", ""),
            "baslik": cols.get("docname", ""),
            "tarih": (cols.get("judgementdate", "") or "")[:10],
            "ihlal_maddeleri": violation_articles,
            "ihlal_raw": violation,
            "sonuc": cols.get("conclusion", "") or "",
            "onem": importance_map.get(str(cols.get("importance", "")), ""),
            "dil": cols.get("languageisocode", ""),
            "daire_tipi": cols.get("doctypebranch", ""),
            "kaynak": "aihm",
        }
