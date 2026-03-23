"""
Türk yargı kararlarına erişim servisi.
Bedesten API (bedesten.adalet.gov.tr) üzerinden
Yargıtay, Danıştay, BAM ve yerel mahkeme kararlarını arar.
"""

import asyncio
import base64
import structlog
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.config import get_settings

logger = structlog.get_logger()

# Karar türleri (itemTypeList)
ITEM_TYPES = {
    "yargitay": "YARGITAYKARARI",
    "danistay": "DANISTAYKARAR",
    "yerel_hukuk": "YERELHUKUK",
    "istinaf_hukuk": "ISTINAFHUKUK",
    "kyb": "KYB",
}

# Yargıtay daire adları (birimAdi — tam Türkçe isim gerekli)
YARGITAY_HUKUK_DAIRELERI = {
    "1": "1. Hukuk Dairesi", "2": "2. Hukuk Dairesi", "3": "3. Hukuk Dairesi",
    "4": "4. Hukuk Dairesi", "5": "5. Hukuk Dairesi", "6": "6. Hukuk Dairesi",
    "7": "7. Hukuk Dairesi", "8": "8. Hukuk Dairesi", "9": "9. Hukuk Dairesi",
    "10": "10. Hukuk Dairesi", "11": "11. Hukuk Dairesi", "12": "12. Hukuk Dairesi",
    "13": "13. Hukuk Dairesi", "14": "14. Hukuk Dairesi", "15": "15. Hukuk Dairesi",
    "16": "16. Hukuk Dairesi", "17": "17. Hukuk Dairesi",
    "HGK": "Hukuk Genel Kurulu",
}

YARGITAY_CEZA_DAIRELERI = {
    "1": "1. Ceza Dairesi", "2": "2. Ceza Dairesi", "3": "3. Ceza Dairesi",
    "4": "4. Ceza Dairesi", "5": "5. Ceza Dairesi", "6": "6. Ceza Dairesi",
    "7": "7. Ceza Dairesi", "8": "8. Ceza Dairesi", "9": "9. Ceza Dairesi",
    "10": "10. Ceza Dairesi", "11": "11. Ceza Dairesi", "12": "12. Ceza Dairesi",
    "13": "13. Ceza Dairesi", "14": "14. Ceza Dairesi", "15": "15. Ceza Dairesi",
    "16": "16. Ceza Dairesi",
    "CGK": "Ceza Genel Kurulu",
}

# Bedesten API zorunlu header'lar
BEDESTEN_HEADERS = {
    "Accept": "*/*",
    "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
    "AdaletApplicationName": "UyapMevzuat",
    "Content-Type": "application/json; charset=utf-8",
    "Origin": "https://mevzuat.adalet.gov.tr",
    "Referer": "https://mevzuat.adalet.gov.tr/",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
}


class YargiService:
    """Bedesten API üzerinden içtihat arama servisi."""

    def __init__(self, cache=None):
        settings = get_settings()
        self.bedesten_url = settings.bedesten_base_url
        self.cache = cache
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers=BEDESTEN_HEADERS,
        )

    async def close(self):
        await self.client.aclose()

    @retry(stop=stop_after_attempt(5), wait=wait_exponential(min=5, max=60))
    async def search_bedesten(
        self,
        keyword: str,
        item_type: str = "YARGITAYKARARI",
        birim_adi: str | None = None,
        page: int = 1,
        page_size: int = 10,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> dict:
        """
        Bedesten API'de karar arama.
        POST /emsal-karar/searchDocuments
        """
        payload = {
            "data": {
                "pageSize": min(page_size, 10),  # API max 10
                "pageNumber": page,
                "itemTypeList": [item_type],
                "phrase": keyword,
                "sortFields": ["KARAR_TARIHI"],
                "sortDirection": "desc",
            },
            "applicationName": "UyapMevzuat",
            "paging": True,
        }

        if birim_adi:
            payload["data"]["birimAdi"] = birim_adi

        if date_from:
            payload["data"]["kararTarihiBaslangic"] = date_from
        if date_to:
            payload["data"]["kararTarihiBitis"] = date_to

        # Check cache first
        if self.cache:
            try:
                filters = {"item_type": item_type, "birim_adi": birim_adi, "page": page, "page_size": page_size}
                cached = await self.cache.get_cached_search(keyword, filters)
                if cached is not None:
                    logger.info("bedesten_search_cache_hit", keyword=keyword, item_type=item_type)
                    return cached
            except Exception:
                pass

        try:
            resp = await self.client.post(
                f"{self.bedesten_url}/emsal-karar/searchDocuments",
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()

            total = data.get("data", {}).get("total", 0)
            results = data.get("data", {}).get("emsalKararList", [])

            logger.info(
                "bedesten_search_ok",
                keyword=keyword,
                item_type=item_type,
                total=total,
                returned=len(results),
            )

            # Store in cache (TTL: 30 min)
            if self.cache:
                try:
                    filters = {"item_type": item_type, "birim_adi": birim_adi, "page": page, "page_size": page_size}
                    await self.cache.cache_search(keyword, filters, data, ttl=1800)
                except Exception:
                    pass

            return data
        except httpx.HTTPError as e:
            logger.error("bedesten_search_error", error=str(e), keyword=keyword)
            raise

    @retry(stop=stop_after_attempt(5), wait=wait_exponential(min=5, max=60))
    async def get_document(self, document_id: str) -> dict:
        """Tam karar metnini getir (base64 encoded HTML/PDF)."""
        # Check cache first
        if self.cache:
            try:
                cached = await self.cache.get_cached_document(document_id)
                if cached is not None:
                    logger.info("bedesten_document_cache_hit", doc_id=document_id)
                    return cached
            except Exception:
                pass

        payload = {
            "data": {"documentId": document_id},
            "applicationName": "UyapMevzuat",
        }

        try:
            resp = await self.client.post(
                f"{self.bedesten_url}/emsal-karar/getDocumentContent",
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()

            # Base64 decode
            content_b64 = data.get("data", {}).get("content", "")
            mime_type = data.get("data", {}).get("mimeType", "text/html")

            if content_b64:
                if mime_type == "text/html":
                    content = base64.b64decode(content_b64).decode("utf-8", errors="replace")
                    data["data"]["decoded_content"] = content
                elif mime_type == "application/pdf":
                    try:
                        from app.services.document_processor import DocumentProcessor
                        pdf_bytes = base64.b64decode(content_b64)
                        processor = DocumentProcessor()
                        extraction = processor.extract_text_from_pdf(pdf_bytes)
                        data["data"]["decoded_content"] = extraction["text"]
                        logger.info("bedesten_pdf_extracted", doc_id=document_id, pages=extraction["pages"])
                    except Exception as e:
                        logger.warning("bedesten_pdf_extract_error", doc_id=document_id, error=str(e))

            # Store in cache (TTL: 24 hours)
            if self.cache:
                try:
                    await self.cache.cache_document(document_id, data, ttl=86400)
                except Exception:
                    pass

            return data
        except httpx.HTTPError as e:
            logger.error("bedesten_document_error", error=str(e), doc_id=document_id)
            raise

    async def search_unified(
        self,
        keyword: str,
        court_types: list[str] | None = None,
        daire: str | None = None,
        max_results: int = 20,
    ) -> list[dict]:
        """
        Birden fazla karar türünde paralel arama.
        court_types: ["yargitay", "danistay", "yerel_hukuk", "istinaf_hukuk"]
        """
        if court_types is None:
            court_types = ["yargitay"]

        # Daire adını çöz
        birim_adi = None
        if daire:
            birim_adi = (
                YARGITAY_HUKUK_DAIRELERI.get(daire)
                or YARGITAY_CEZA_DAIRELERI.get(daire)
            )

        # Paralel arama
        tasks = []
        per_type = max(max_results // len(court_types), 10)

        for ct in court_types:
            item_type = ITEM_TYPES.get(ct, "YARGITAYKARARI")
            tasks.append(
                self.search_bedesten(
                    keyword=keyword,
                    item_type=item_type,
                    birim_adi=birim_adi,
                    page_size=min(per_type, 10),
                )
            )

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Birleştir ve normalize et
        unified = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.warning(
                    "search_partial_failure",
                    court_type=court_types[i],
                    error=str(result),
                )
                continue

            items = result.get("data", {}).get("emsalKararList", [])
            for item in items:
                unified.append(self._normalize_result(item, court_types[i]))

        unified = unified[:max_results]

        # İlk 5 sonuç için tam metin çek (paralel)
        await self._enrich_with_content(unified, limit=5)

        return unified

    async def _enrich_with_content(self, results: list[dict], limit: int = 5):
        """İlk N sonuç için tam karar metnini çek ve özet olarak ekle."""
        to_fetch = [r for r in results[:limit] if r.get("document_id")]
        if not to_fetch:
            return

        tasks = [self.get_document(r["document_id"]) for r in to_fetch]
        docs = await asyncio.gather(*tasks, return_exceptions=True)

        for r, doc in zip(to_fetch, docs):
            if isinstance(doc, Exception):
                logger.warning("content_fetch_failed", doc_id=r.get("document_id"), error=str(doc))
                continue

            content = doc.get("data", {}).get("decoded_content", "")
            if content:
                import re
                # HTML tag'leri ve entity'leri temizle
                clean = re.sub(r"<[^>]+>", " ", content)
                clean = clean.replace("&nbsp;", " ").replace("&amp;", "&")
                clean = clean.replace("&lt;", "<").replace("&gt;", ">")
                clean = re.sub(r"&\w+;", " ", clean)
                clean = re.sub(r"\s+", " ", clean).strip()
                r["ozet"] = clean[:500]
                r["tam_metin"] = clean[:5000]

    def _normalize_result(self, raw: dict, court_type: str) -> dict:
        """API sonucunu standart formata dönüştür."""
        esas_yil = raw.get("esasNoYil", "")
        esas_sira = raw.get("esasNoSira", "")
        karar_yil = raw.get("kararNoYil", "")
        karar_sira = raw.get("kararNoSira", "")

        esas_no = f"{esas_yil}/{esas_sira}" if esas_yil and esas_sira else raw.get("esasNo", "")
        karar_no = f"{karar_yil}/{karar_sira}" if karar_yil and karar_sira else raw.get("kararNo", "")

        return {
            "karar_id": raw.get("documentId", ""),
            "mahkeme": self._court_label(court_type),
            "daire": raw.get("birimAdi", ""),
            "esas_no": str(esas_no),
            "karar_no": str(karar_no),
            "tarih": raw.get("kararTarihiStr", raw.get("kararTarihi", "")),
            "ozet": "",  # Bedesten arama sonuçlarında özet yok, tam metin ayrıca çekilir
            "document_id": raw.get("documentId", ""),
            "kaynak": "bedesten",
            "relevance": 0.5,
        }

    def _court_label(self, court_type: str) -> str:
        return {
            "yargitay": "Yargıtay",
            "danistay": "Danıştay",
            "yerel_hukuk": "Yerel Mahkeme",
            "istinaf_hukuk": "İstinaf (BAM)",
            "kyb": "Kanun Yararına Bozma",
        }.get(court_type, court_type)

    async def verify_citation(
        self,
        mahkeme: str | None = None,
        daire: str | None = None,
        esas_no: str | None = None,
        karar_no: str | None = None,
    ) -> dict:
        """Bir içtihat referansının gerçek olup olmadığını doğrula."""
        if not esas_no and not karar_no:
            return {"verified": False, "reason": "esas_no veya karar_no gerekli"}

        search_term = esas_no or karar_no or ""

        try:
            result = await self.search_bedesten(
                keyword=search_term,
                item_type="YARGITAYKARARI",
                page_size=5,
            )

            items = result.get("data", {}).get("emsalKararList", [])
            if items:
                for item in items:
                    item_esas = f"{item.get('esasNoYil', '')}/{item.get('esasNoSira', '')}"
                    item_karar = f"{item.get('kararNoYil', '')}/{item.get('kararNoSira', '')}"

                    if esas_no and esas_no in item_esas:
                        return {"verified": True, "match": self._normalize_result(item, "yargitay")}
                    if karar_no and karar_no in item_karar:
                        return {"verified": True, "match": self._normalize_result(item, "yargitay")}

                return {
                    "verified": False,
                    "partial_matches": [self._normalize_result(i, "yargitay") for i in items[:3]],
                    "reason": "Tam eşleşme bulunamadı",
                }

            return {"verified": False, "reason": "Kayıt bulunamadı"}
        except Exception as e:
            return {"verified": False, "reason": f"Doğrulama hatası: {str(e)}"}
