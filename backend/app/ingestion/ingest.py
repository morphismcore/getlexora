"""
Veri ingestion pipeline.
Bedesten API'den kararları çeker, chunk'lar, embed eder, Qdrant'a yükler.
"""

import asyncio
import hashlib
import json
import math
import os
import re
import threading
import traceback
from datetime import datetime

import structlog

from app.services.yargi import YargiService, ITEM_TYPES, YARGITAY_HUKUK_DAIRELERI, YARGITAY_CEZA_DAIRELERI, DANISTAY_DAIRELERI
from app.services.vector_store import VectorStoreService
from app.services.embedding import EmbeddingService
from app.ingestion.chunker import LegalChunker
from app.ingestion.html_cleaner import clean_legal_html
from app.config import get_settings

logger = structlog.get_logger()

CHECKPOINT_FILE = "/app/data/ingestion_checkpoint.json"

# ── In-memory log buffer (son 200 satır) ──────────────────
_state_lock = threading.Lock()
_ingest_logs: list[dict] = []
_ingest_running = False
MAX_LOG_LINES = 200

_ingest_state = {
    "running": False,
    "source": None,
    "task": None,
    "started_at": None,
    "last_update": None,
    "fetched": 0,
    "embedded": 0,
    "errors": 0,
    "total_topics": 0,
    "completed_topics": 0,
    "progress_pct": 0,
}


def _update_state(**kwargs):
    """Ingestion state guncelle — last_update ve progress_pct otomatik. Thread-safe."""
    global _ingest_state
    with _state_lock:
        _ingest_state.update(kwargs)
        _ingest_state["last_update"] = datetime.now().isoformat()
        total = _ingest_state.get("total_topics", 0)
        completed = _ingest_state.get("completed_topics", 0)
        _ingest_state["progress_pct"] = round((completed / total) * 100) if total > 0 else 0


def _log(level: str, message: str):
    """Log buffer'a ekle. Thread-safe."""
    global _ingest_logs
    with _state_lock:
        _ingest_logs.append({
            "ts": datetime.now().isoformat(),
            "level": level,
            "msg": message,
        })
        if len(_ingest_logs) > MAX_LOG_LINES:
            _ingest_logs = _ingest_logs[-MAX_LOG_LINES:]
    # Ayrıca structlog'a da yaz
    if level == "error":
        logger.error("ingest_log", msg=message, stack=traceback.format_exc() if "Error" in message or "error" in message else None)
    else:
        logger.info("ingest_log", msg=message)


def _make_dedup_key(doc: dict) -> str:
    """Create dedup key from multiple fields to catch cross-source duplicates."""
    esas = (doc.get("esas_no") or doc.get("esasNo") or "").strip()
    karar = (doc.get("karar_no") or doc.get("kararNo") or "").strip()
    tarih = (doc.get("tarih") or doc.get("karar_tarihi") or "").strip()
    mahkeme = (doc.get("mahkeme") or "").strip().lower()

    # Also try Bedesten-specific field names
    if not esas:
        yil = doc.get("esasNoYil", "")
        sira = doc.get("esasNoSira", "")
        if yil and sira:
            esas = f"{yil}/{sira}"
    if not karar:
        yil = doc.get("kararNoYil", "")
        sira = doc.get("kararNoSira", "")
        if yil and sira:
            karar = f"{yil}/{sira}"
    if not tarih:
        tarih = (doc.get("kararTarihiStr") or "").strip()

    # If we have structured fields, use them
    if esas and karar:
        key = f"{mahkeme}:{esas}:{karar}:{tarih}"
        return hashlib.md5(key.encode()).hexdigest()

    # Fallback to documentId for unstructured docs
    doc_id = doc.get("documentId") or doc.get("id") or ""
    return str(doc_id)


class IngestionPipeline:
    """Bedesten API → Chunking → Embedding → Qdrant."""

    def __init__(
        self,
        yargi: YargiService,
        vector_store: VectorStoreService,
        embedding: EmbeddingService,
    ):
        self.yargi = yargi
        self.vector_store = vector_store
        self.embedding = embedding
        self.chunker = LegalChunker()
        self.settings = get_settings()

    async def ingest_search_results(
        self,
        keyword: str,
        court_types: list[str] | None = None,
        pages: int = 5,
        page_size: int = 10,
    ) -> dict:
        """
        Belirli bir arama terimi için Bedesten'den kararları çek,
        tam metinlerini al, chunk'la, embed et ve Qdrant'a yükle.
        """
        if court_types is None:
            court_types = ["yargitay", "danistay"]

        total_fetched = 0
        total_chunks = 0
        total_embedded = 0
        seen_dedup_keys: set[str] = set()

        for ct in court_types:
            item_type = ITEM_TYPES.get(ct, "YARGITAYKARARI")

            for page in range(1, pages + 1):
                try:
                    result = await self.yargi.search_bedesten(
                        keyword=keyword,
                        item_type=item_type,
                        page=page,
                        page_size=page_size,
                    )

                    items = result.get("data", {}).get("emsalKararList", [])
                    total = result.get("data", {}).get("total", 0)
                    if not items:
                        break

                    total_fetched += len(items)
                    _update_state(fetched=total_fetched)

                    # Her karar için tam metin çek ve chunk'la
                    all_chunks = []
                    for item in items:
                        doc_id = item.get("documentId", "")
                        if not doc_id:
                            continue

                        # Multi-field deduplication: catch cross-source duplicates
                        dedup_key = _make_dedup_key(item)
                        if dedup_key in seen_dedup_keys:
                            continue
                        seen_dedup_keys.add(dedup_key)

                        # Tam metin çek
                        try:
                            doc = await self.yargi.get_document(doc_id)
                            content = doc.get("data", {}).get("decoded_content", "")
                            if not content:
                                continue

                            clean = clean_legal_html(content)

                            if len(clean) < self.settings.min_karar_chars:
                                continue

                        except Exception as e:
                            logger.warning("ingest_doc_fetch_error", doc_id=doc_id, error=str(e))
                            continue

                        esas_no = f"{item.get('esasNoYil', '')}/{item.get('esasNoSira', '')}"
                        karar_no = f"{item.get('kararNoYil', '')}/{item.get('kararNoSira', '')}"
                        mahkeme = ct.lower().strip()
                        daire = item.get("birimAdi", "").strip()
                        tarih = item.get("kararTarihiStr", "")
                        yil = int(tarih.split(".")[-1]) if tarih and "." in tarih else None

                        metadata = {
                            "karar_id": doc_id,
                            "mahkeme": mahkeme,
                            "daire": daire,
                            "esas_no": esas_no,
                            "karar_no": karar_no,
                            "tarih": tarih,
                            "yil": yil,
                            "kaynak": "bedesten",
                        }

                        chunks = self.chunker.chunk_karar(clean, metadata)
                        if not chunks:
                            chunks = self.chunker.chunk_generic(clean, metadata)
                        all_chunks.extend(chunks)

                        # Rate limiting — karar başına bekleme
                        await asyncio.sleep(3.0)

                    if not all_chunks:
                        continue

                    total_chunks += len(all_chunks)

                    # Batch embed
                    texts = [c["text"] for c in all_chunks]
                    embeddings = await self.embedding.embed_texts_async(texts)

                    # Qdrant'a yükle
                    points = []
                    for i, (chunk, emb) in enumerate(zip(all_chunks, embeddings)):
                        point_id = self._generate_id(
                            chunk["metadata"].get("karar_id", "") + str(i)
                        )
                        points.append({
                            "id": point_id,
                            "dense_vector": emb["dense_vector"],
                            "sparse_vector": emb.get("sparse_vector"),
                            "payload": {
                                **chunk["metadata"],
                                "text": chunk["text"][:self.settings.max_payload_text_chars],
                                "ozet": chunk["text"][:500],
                            },
                        })

                    await self.vector_store.upsert_points(
                        collection=self.settings.qdrant_collection_ictihat,
                        points=points,
                    )
                    total_embedded += len(points)
                    _update_state(embedded=total_embedded)

                    logger.info(
                        "ingest_page_complete",
                        court_type=ct,
                        page=page,
                        fetched=len(items),
                        chunks=len(all_chunks),
                        embedded=len(points),
                    )

                    await asyncio.sleep(5.0)

                except Exception as e:
                    logger.error(
                        "ingest_page_error",
                        court_type=ct,
                        page=page,
                        error=str(e),
                    )
                    _update_state(errors=_ingest_state["errors"] + 1)
                    continue

        summary = {
            "total_fetched": total_fetched,
            "total_chunks": total_chunks,
            "total_embedded": total_embedded,
            "keyword": keyword,
            "court_types": court_types,
        }
        logger.info("ingest_complete", **summary)
        _log("success", f"✅ {keyword} tamamlandı — {total_embedded} embedding")
        return summary

    async def ingest_topics(self, topics: list[str], pages_per_topic: int = 3) -> dict:
        """Birden fazla hukuk konusu için toplu ingestion."""
        global _ingest_running
        _ingest_running = True
        _update_state(
            running=True, source="bedesten", task=None,
            started_at=datetime.now().isoformat(),
            fetched=0, embedded=0, errors=0,
            total_topics=len(topics), completed_topics=0,
        )
        _log("info", f"📋 Ingestion başladı — {len(topics)} konu, sayfa/konu: {pages_per_topic}")

        checkpoint = self._load_checkpoint()
        completed_topics = set(checkpoint.get("completed_topics", []))
        all_summaries = []

        try:
            for topic in topics:
                if topic in completed_topics:
                    logger.info("ingest_topic_skipped", topic=topic, reason="checkpoint")
                    continue

                logger.info("ingest_topic_start", topic=topic)
                _log("info", f"🔄 {topic} konusu başladı")
                _update_state(task=topic)
                summary = await self.ingest_search_results(
                    keyword=topic,
                    pages=pages_per_topic,
                )
                all_summaries.append(summary)

                # Save checkpoint
                completed_topics.add(topic)
                _update_state(completed_topics=len(completed_topics))
                checkpoint["completed_topics"] = list(completed_topics)
                checkpoint["last_update"] = datetime.now().isoformat()
                self._save_checkpoint(checkpoint)

                await asyncio.sleep(3.0)

            total = {
                "topics": len(topics),
                "topics_skipped": len(topics) - len(all_summaries),
                "total_fetched": sum(s["total_fetched"] for s in all_summaries),
                "total_chunks": sum(s["total_chunks"] for s in all_summaries),
                "total_embedded": sum(s["total_embedded"] for s in all_summaries),
            }
            logger.info("ingest_all_topics_complete", **total)
            _log("success", f"🎉 Ingestion tamamlandı — {total['total_embedded']} embedding")
            return total
        finally:
            _ingest_running = False
            _update_state(running=False, source=None, task=None)

    async def ingest_by_daire(
        self,
        court_type: str = "yargitay",
        daire_id: str | None = None,
        pages: int = 10,
    ) -> dict:
        """
        Belirli bir daireden sistematik karar çekme.
        daire_id: "9" -> "9. Hukuk Dairesi" veya "HGK" -> "Hukuk Genel Kurulu"
        daire_id None ise tüm daireleri çeker.
        """
        if court_type == "yargitay":
            # Prefix ile birleştir — key collision önlenir
            daireler = {}
            for k, v in YARGITAY_HUKUK_DAIRELERI.items():
                daireler[f"hukuk:{k}"] = v
            for k, v in YARGITAY_CEZA_DAIRELERI.items():
                daireler[f"ceza:{k}"] = v
        else:
            daireler = {}

        if daire_id:
            # Hem Hukuk hem Ceza'da ara
            matches = {k: v for k, v in daireler.items() if k.endswith(f":{daire_id}")}
            if not matches:
                return {"error": f"Daire bulunamadı: {daire_id}"}
            daireler = matches

        checkpoint = self._load_checkpoint()
        completed_daireler = set(checkpoint.get("completed_daireler", []))
        total_embedded = 0
        seen_dedup_keys: set[str] = set()

        for d_composite_id, d_name in daireler.items():
            d_id = d_composite_id.split(":")[-1] if ":" in d_composite_id else d_composite_id
            key = f"{court_type}:{d_composite_id}"
            if key in completed_daireler:
                logger.info("ingest_daire_skipped", daire=d_name, reason="checkpoint")
                continue

            logger.info("ingest_daire_start", daire=d_name)

            item_type = ITEM_TYPES.get(court_type, "YARGITAYKARARI")

            for page in range(1, pages + 1):
                try:
                    result = await self.yargi.search_bedesten(
                        keyword="karar",
                        item_type=item_type,
                        birim_adi=d_name,
                        page=page,
                        page_size=10,
                    )

                    items = result.get("data", {}).get("emsalKararList", [])
                    total = result.get("data", {}).get("total", 0)
                    if not items:
                        break

                    all_chunks = []
                    for item in items:
                        doc_id = item.get("documentId", "")
                        if not doc_id:
                            continue

                        # Multi-field deduplication: catch cross-source duplicates
                        dedup_key = _make_dedup_key(item)
                        if dedup_key in seen_dedup_keys:
                            continue
                        seen_dedup_keys.add(dedup_key)

                        try:
                            doc = await self.yargi.get_document(doc_id)
                            content = doc.get("data", {}).get("decoded_content", "")
                            if not content:
                                continue

                            clean = clean_legal_html(content)

                            if len(clean) < self.settings.min_karar_chars:
                                continue
                        except Exception as e:
                            logger.warning("ingest_doc_fetch_error", doc_id=doc_id, error=str(e))
                            continue

                        esas_no = f"{item.get('esasNoYil', '')}/{item.get('esasNoSira', '')}"
                        karar_no = f"{item.get('kararNoYil', '')}/{item.get('kararNoSira', '')}"
                        mahkeme = court_type.lower().strip()
                        daire = d_name.strip()
                        tarih = item.get("kararTarihiStr", "")
                        yil = int(tarih.split(".")[-1]) if tarih and "." in tarih else None

                        metadata = {
                            "karar_id": doc_id,
                            "mahkeme": mahkeme,
                            "daire": daire,
                            "esas_no": esas_no,
                            "karar_no": karar_no,
                            "tarih": tarih,
                            "yil": yil,
                            "kaynak": "bedesten",
                        }

                        chunks = self.chunker.chunk_karar(clean, metadata)
                        if not chunks:
                            chunks = self.chunker.chunk_generic(clean, metadata)
                        all_chunks.extend(chunks)

                        await asyncio.sleep(3.0)

                    if all_chunks:
                        texts = [c["text"] for c in all_chunks]
                        embeddings = await self.embedding.embed_texts_async(texts)

                        points = []
                        for i, (chunk, emb) in enumerate(zip(all_chunks, embeddings)):
                            point_id = self._generate_id(
                                chunk["metadata"].get("karar_id", "") + str(i)
                            )
                            points.append({
                                "id": point_id,
                                "dense_vector": emb["dense_vector"],
                                "sparse_vector": emb.get("sparse_vector"),
                                "payload": {
                                    **chunk["metadata"],
                                    "text": chunk["text"][:self.settings.max_payload_text_chars],
                                    "ozet": chunk["text"][:500],
                                },
                            })

                        await self.vector_store.upsert_points(
                            collection=self.settings.qdrant_collection_ictihat,
                            points=points,
                        )
                        total_embedded += len(points)

                    await asyncio.sleep(5.0)

                except Exception as e:
                    logger.error("ingest_daire_page_error", daire=d_name, page=page, error=str(e))
                    continue

            completed_daireler.add(key)
            checkpoint["completed_daireler"] = list(completed_daireler)
            checkpoint["last_update"] = datetime.now().isoformat()
            self._save_checkpoint(checkpoint)

            logger.info("ingest_daire_complete", daire=d_name, embedded=total_embedded)
            await asyncio.sleep(3.0)

        return {
            "court_type": court_type,
            "daireler_processed": len(daireler),
            "total_embedded": total_embedded,
        }

    async def ingest_by_date_range(
        self,
        start_date: str,
        end_date: str,
        court_types: list[str] | None = None,
        max_pages: int = 50,
    ) -> dict:
        """
        Tarih aralığına göre sistematik ingestion.
        start_date, end_date: "DD.MM.YYYY" formatında.
        """
        if court_types is None:
            court_types = ["yargitay", "danistay"]

        total_fetched = 0
        total_embedded = 0
        seen_dedup_keys: set[str] = set()

        _log("info", f"📅 Tarih bazlı ingestion: {start_date} → {end_date}")

        for ct in court_types:
            item_type = ITEM_TYPES.get(ct, "YARGITAYKARARI")

            for page in range(1, max_pages + 1):
                try:
                    result = await self.yargi.search_bedesten(
                        keyword="karar",
                        item_type=item_type,
                        page=page,
                        page_size=10,
                        date_from=start_date,
                        date_to=end_date,
                    )

                    items = result.get("data", {}).get("emsalKararList", [])
                    total = result.get("data", {}).get("total", 0)
                    if not items:
                        break

                    total_fetched += len(items)

                    all_chunks = []
                    for item in items:
                        doc_id = item.get("documentId", "")
                        if not doc_id:
                            continue

                        # Multi-field deduplication: catch cross-source duplicates
                        dedup_key = _make_dedup_key(item)
                        if dedup_key in seen_dedup_keys:
                            continue
                        seen_dedup_keys.add(dedup_key)

                        try:
                            doc = await self.yargi.get_document(doc_id)
                            content = doc.get("data", {}).get("decoded_content", "")
                            if not content:
                                continue

                            clean = clean_legal_html(content)
                            if len(clean) < self.settings.min_karar_chars:
                                continue
                        except Exception as e:
                            logger.warning("ingest_doc_fetch_error", doc_id=doc_id, error=str(e))
                            continue

                        esas_no = f"{item.get('esasNoYil', '')}/{item.get('esasNoSira', '')}"
                        karar_no = f"{item.get('kararNoYil', '')}/{item.get('kararNoSira', '')}"
                        mahkeme = ct.lower().strip()
                        daire = item.get("birimAdi", "").strip()
                        tarih = item.get("kararTarihiStr", "")
                        yil = int(tarih.split(".")[-1]) if tarih and "." in tarih else None

                        metadata = {
                            "karar_id": doc_id,
                            "mahkeme": mahkeme,
                            "daire": daire,
                            "esas_no": esas_no,
                            "karar_no": karar_no,
                            "tarih": tarih,
                            "yil": yil,
                            "kaynak": "bedesten",
                        }

                        chunks = self.chunker.chunk_karar(clean, metadata)
                        if not chunks:
                            chunks = self.chunker.chunk_generic(clean, metadata)
                        all_chunks.extend(chunks)

                        await asyncio.sleep(3.0)

                    if all_chunks:
                        texts = [c["text"] for c in all_chunks]
                        embeddings = await self.embedding.embed_texts_async(texts)

                        points = []
                        for i, (chunk, emb) in enumerate(zip(all_chunks, embeddings)):
                            point_id = self._generate_id(
                                chunk["metadata"].get("karar_id", "") + str(i)
                            )
                            points.append({
                                "id": point_id,
                                "dense_vector": emb["dense_vector"],
                                "sparse_vector": emb.get("sparse_vector"),
                                "payload": {
                                    **chunk["metadata"],
                                    "text": chunk["text"][:self.settings.max_payload_text_chars],
                                    "ozet": chunk["text"][:self.settings.max_ozet_chars],
                                },
                            })

                        await self.vector_store.upsert_points(
                            collection=self.settings.qdrant_collection_ictihat,
                            points=points,
                        )
                        total_embedded += len(points)

                    # Stop if we've fetched all available
                    if page >= math.ceil(total / 10):
                        break

                    await asyncio.sleep(5.0)

                except Exception as e:
                    logger.error("ingest_date_range_error", page=page, error=str(e))
                    continue

        summary = {
            "date_range": f"{start_date} - {end_date}",
            "total_fetched": total_fetched,
            "total_embedded": total_embedded,
        }
        _log("success", f"✅ Tarih bazlı ingestion tamamlandı — {total_embedded} embedding")
        return summary

    async def ingest_exhaustive(
        self,
        court_types: list[str] | None = None,
        concurrent_docs: int = 5,
        doc_delay: float = 0.5,
        page_delay: float = 1.5,
        year_from: int | None = None,
        year_to: int | None = None,
        priority_daireler: list[str] | None = None,
    ) -> dict:
        """
        Tüm daireleri sayfa sayfa, bitene kadar çek.
        "*" yerine "karar" kullanır (API wildcard desteklemiyor).
        Paralel belge çekme + daire+sayfa checkpoint ile sürdürülebilir.
        """
        # Load ingestion config (admin panel settings)
        from app.ingestion.config import load_ingestion_config
        ing_config = load_ingestion_config()

        if court_types is None:
            court_types = ["yargitay", "danistay"]

        # Use config year range if not explicitly provided
        # Config can also have per-daire year_from overrides
        if year_from is None:
            # Try global config (will also check per-daire below)
            pass

        # Date range parameters for Bedesten API
        api_date_from = f"01.01.{year_from}" if year_from else None
        api_date_to = f"31.12.{year_to}" if year_to else None

        # Telegram reporting
        from app.services.telegram import TelegramService
        telegram = TelegramService()
        import time as _time
        last_telegram_report = _time.time()
        start_time = _time.time()

        checkpoint = self._load_checkpoint()
        exhaustive_cp = checkpoint.get("exhaustive", {})
        total_embedded = 0
        total_fetched = 0
        total_skipped = 0
        sem = asyncio.Semaphore(concurrent_docs)

        # Daire listesini oluştur — Hukuk ve Ceza ayrı tutulur (key collision önlenir)
        all_daireler = []
        for ct in court_types:
            if ct == "yargitay":
                item_type = ITEM_TYPES["yargitay"]
                # Hukuk ve Ceza dairelerini AYRI iterate et — dict merge key collision yapar
                for d_id, d_name in YARGITAY_HUKUK_DAIRELERI.items():
                    all_daireler.append(("yargitay_hukuk", item_type, d_id, d_name))
                for d_id, d_name in YARGITAY_CEZA_DAIRELERI.items():
                    all_daireler.append(("yargitay_ceza", item_type, d_id, d_name))
            elif ct == "danistay":
                item_type = ITEM_TYPES["danistay"]
                for d_id, d_name in DANISTAY_DAIRELERI.items():
                    all_daireler.append((ct, item_type, d_id, d_name))
            else:
                continue

        # Priority daireler: move them to the front
        if priority_daireler:
            priority_set = set(priority_daireler)
            priority_items = [d for d in all_daireler if d[2] in priority_set]
            rest_items = [d for d in all_daireler if d[2] not in priority_set]
            all_daireler = priority_items + rest_items

        # Set Redis flag so other tasks know exhaustive is running
        import redis as sync_redis
        _redis_flag = sync_redis.from_url(self.settings.redis_url, socket_timeout=2)
        _redis_flag.set("ingestion:exhaustive_running", "1", ex=86400)
        _redis_flag.close()

        _log("info", f"🚀 Exhaustive ingestion başladı — {len(all_daireler)} daire, {len(court_types)} mahkeme")
        _update_state(
            running=True, source="exhaustive",
            started_at=datetime.now().isoformat(),
            fetched=0, embedded=0, errors=0,
            total_topics=len(all_daireler), completed_topics=0,
        )

        async def _fetch_doc(doc_id: str) -> tuple[str, str]:
            """Semaphore ile rate-limited belge çekme."""
            async with sem:
                try:
                    doc = await self.yargi.get_document(doc_id)
                    content = doc.get("data", {}).get("decoded_content", "")
                    await asyncio.sleep(doc_delay)
                    return doc_id, content
                except Exception as e:
                    logger.warning("exhaustive_doc_error", doc_id=doc_id, error=str(e))
                    await asyncio.sleep(doc_delay * 2)
                    return doc_id, ""

        completed_daire_count = 0

        try:
            for ct, item_type, d_id, d_name in all_daireler:
                daire_key = f"{ct}:{d_id}"
                daire_cp = exhaustive_cp.get(daire_key, {})

                if daire_cp.get("done"):
                    completed_daire_count += 1
                    _update_state(completed_topics=completed_daire_count)
                    continue

                start_page = daire_cp.get("last_page", 0) + 1
                daire_embedded = daire_cp.get("embedded", 0)
                daire_total_api = None
                consecutive_empty = 0

                # Per-daire year config override
                # ct may be "yargitay_hukuk" or "yargitay_ceza" — map back to base court type for config
                ct_base = ct.split("_")[0]  # "yargitay_hukuk" -> "yargitay"
                ct_config = ing_config.get(ct_base, {})
                daire_year_from = year_from  # explicit param takes priority
                if daire_year_from is None:
                    # Check daire-specific config
                    daire_cfg = ct_config.get("daire_config", {}).get(d_id, {})
                    daire_year_from = daire_cfg.get("year_from") or ct_config.get("year_from")
                daire_year_to = year_to or ct_config.get("year_to")
                daire_date_from = f"01.01.{daire_year_from}" if daire_year_from else api_date_from
                daire_date_to = f"31.12.{daire_year_to}" if daire_year_to else api_date_to

                _log("info", f"📋 {ct.upper()} {d_name} — sayfa {start_page}'den devam" + (f" (yıl: {daire_year_from}+)" if daire_year_from else ""))
                _update_state(task=f"{ct} {d_name} (p{start_page})")

                page = start_page
                while True:
                    try:
                        result = await self.yargi.search_bedesten(
                            keyword="karar",
                            item_type=item_type,
                            birim_adi=d_name,
                            page=page,
                            page_size=10,
                            date_from=daire_date_from,
                            date_to=daire_date_to,
                        )

                        items = result.get("data", {}).get("emsalKararList", [])
                        api_total = result.get("data", {}).get("total", 0)

                        if daire_total_api is None:
                            daire_total_api = api_total
                            _log("info", f"📊 {d_name}: API toplam {api_total:,} karar")

                        if not items:
                            consecutive_empty += 1
                            if consecutive_empty >= 3:
                                break
                            page += 1
                            await asyncio.sleep(page_delay)
                            continue

                        consecutive_empty = 0
                        total_fetched += len(items)

                        # Paralel belge çekme
                        doc_ids = [item.get("documentId", "") for item in items if item.get("documentId")]
                        doc_results = await asyncio.gather(*[_fetch_doc(did) for did in doc_ids])

                        # Chunk ve embed
                        all_chunks = []
                        for item, (doc_id, content) in zip(
                            [i for i in items if i.get("documentId")],
                            doc_results,
                        ):
                            if not content:
                                continue

                            clean = clean_legal_html(content)
                            if len(clean) < self.settings.min_karar_chars:
                                continue

                            esas_no = f"{item.get('esasNoYil', '')}/{item.get('esasNoSira', '')}"
                            karar_no = f"{item.get('kararNoYil', '')}/{item.get('kararNoSira', '')}"
                            tarih = item.get("kararTarihiStr", "")
                            yil = int(tarih.split(".")[-1]) if tarih and "." in tarih else None

                            metadata = {
                                "karar_id": doc_id,
                                "mahkeme": ct_base.lower().strip(),
                                "daire": d_name.strip(),
                                "esas_no": esas_no,
                                "karar_no": karar_no,
                                "tarih": tarih,
                                "yil": yil,
                                "kaynak": "bedesten",
                            }

                            chunks = self.chunker.chunk_karar(clean, metadata)
                            if not chunks:
                                chunks = self.chunker.chunk_generic(clean, metadata)
                            all_chunks.extend(chunks)

                        if all_chunks:
                            texts = [c["text"] for c in all_chunks]
                            embeddings = await self.embedding.embed_texts_async(texts)

                            points = []
                            for i, (chunk, emb) in enumerate(zip(all_chunks, embeddings)):
                                point_id = self._generate_id(
                                    chunk["metadata"].get("karar_id", "") + str(i)
                                )
                                points.append({
                                    "id": point_id,
                                    "dense_vector": emb["dense_vector"],
                                    "sparse_vector": emb.get("sparse_vector"),
                                    "payload": {
                                        **chunk["metadata"],
                                        "text": chunk["text"][:self.settings.max_payload_text_chars],
                                        "ozet": chunk["text"][:500],
                                    },
                                })

                            await self.vector_store.upsert_points(
                                collection=self.settings.qdrant_collection_ictihat,
                                points=points,
                            )
                            daire_embedded += len(points)
                            total_embedded += len(points)

                        # Checkpoint her sayfa
                        exhaustive_cp[daire_key] = {
                            "last_page": page,
                            "embedded": daire_embedded,
                            "api_total": daire_total_api,
                        }
                        checkpoint["exhaustive"] = exhaustive_cp
                        self._save_checkpoint(checkpoint)

                        _update_state(
                            fetched=total_fetched,
                            embedded=total_embedded,
                            task=f"{ct} {d_name} (p{page}/{math.ceil((daire_total_api or 1)/10)})",
                        )

                        # Telegram report every 2 hours
                        now_ts = _time.time()
                        if now_ts - last_telegram_report >= 7200:
                            elapsed_str = f"{(now_ts - start_time) / 3600:.1f}h"
                            await telegram.send_ingestion_report({
                                "source": "exhaustive",
                                "embedded": total_embedded,
                                "fetched": total_fetched,
                                "errors": _ingest_state.get("errors", 0),
                                "daire": d_name,
                                "page": f"{page}/{math.ceil((daire_total_api or 1) / 10)}",
                                "elapsed": elapsed_str,
                                "status": "devam ediyor",
                            })
                            last_telegram_report = now_ts

                        # Her 50 sayfada log
                        if page % 50 == 0:
                            _log("info", f"📄 {d_name} sayfa {page} — {daire_embedded} embedding (API toplam: {daire_total_api:,})")

                        # Son sayfaya ulaştıysak dur
                        max_page = math.ceil((daire_total_api or 1) / 10)
                        if page >= max_page:
                            break

                        page += 1
                        await asyncio.sleep(page_delay)

                    except Exception as e:
                        logger.error("exhaustive_page_error", daire=d_name, page=page, error=str(e))
                        _update_state(errors=_ingest_state["errors"] + 1)
                        await telegram.send_message(
                            f"\u26a0\ufe0f *Exhaustive hata*\n"
                            f"Daire: `{d_name}` sayfa {page}\n"
                            f"Hata: `{str(e)[:200]}`"
                        )
                        # Rate limit veya geçici hata — biraz bekle ve devam et
                        await asyncio.sleep(10.0)
                        page += 1
                        continue

                # Daire tamamlandı
                if daire_key not in exhaustive_cp:
                    exhaustive_cp[daire_key] = {}
                exhaustive_cp[daire_key]["done"] = True
                checkpoint["exhaustive"] = exhaustive_cp
                self._save_checkpoint(checkpoint)

                completed_daire_count += 1
                _update_state(completed_topics=completed_daire_count)
                _log("info", f"✅ {d_name} tamamlandı — {daire_embedded} embedding ({page} sayfa)")
                await asyncio.sleep(3.0)

        finally:
            _update_state(running=False, source=None, task=None)
            # Clear Redis exhaustive flag
            try:
                _redis_cleanup = sync_redis.from_url(self.settings.redis_url, socket_timeout=2)
                _redis_cleanup.delete("ingestion:exhaustive_running")
                _redis_cleanup.close()
            except Exception:
                pass

        summary = {
            "court_types": court_types,
            "daireler_total": len(all_daireler),
            "daireler_completed": completed_daire_count,
            "total_fetched": total_fetched,
            "total_embedded": total_embedded,
        }
        _log("success", f"🎉 Exhaustive ingestion tamamlandı — {total_embedded} embedding, {completed_daire_count} daire")

        # Final Telegram completion report
        elapsed_str = f"{(_time.time() - start_time) / 3600:.1f}h"
        await telegram.send_ingestion_report({
            "source": "exhaustive",
            "embedded": total_embedded,
            "fetched": total_fetched,
            "errors": _ingest_state.get("errors", 0),
            "elapsed": elapsed_str,
            "status": f"TAMAMLANDI ({completed_daire_count}/{len(all_daireler)} daire)",
        })

        return summary

    async def ingest_aym(
        self,
        pages: int = 10,
        ihlal_only: bool = True,
    ) -> dict:
        """AYM bireysel basvuru kararlarini ingest et."""
        from app.services.aym import AymService

        aym = AymService()
        total_fetched = 0
        total_embedded = 0

        _log("info", f"⚖️ AYM ingestion başladı — sayfa: {pages}")
        _update_state(
            running=True, source="aym", task="Bireysel Başvuru",
            started_at=datetime.now().isoformat(),
            fetched=0, embedded=0, errors=0,
            total_topics=pages, completed_topics=0,
        )

        try:
            for page in range(1, pages + 1):
                try:
                    result = await aym.search_bireysel_basvuru(
                        page=page,
                        ihlal_only=ihlal_only,
                    )

                    items = result.get("results", [])
                    if not items:
                        break

                    total_fetched += len(items)
                    _update_state(fetched=total_fetched, task=f"Sayfa {page}/{pages}")

                    all_chunks = []
                    for item in items:
                        basvuru_no = item.get("basvuru_no", "")
                        if not basvuru_no:
                            continue

                        try:
                            doc = await aym.get_document(basvuru_no)
                            content = doc.get("content", "")
                            if not content or len(content) < self.settings.min_karar_chars:
                                continue
                        except Exception as e:
                            logger.warning("aym_doc_error", basvuru_no=basvuru_no, error=str(e))
                            continue

                        metadata = {
                            "karar_id": f"aym_{basvuru_no}",
                            "mahkeme": "aym",
                            "daire": "Bireysel Başvuru",
                            "esas_no": basvuru_no,
                            "karar_no": basvuru_no,
                            "tarih": doc.get("metadata", {}).get("karar_tarihi", ""),
                            "kaynak": "aym",
                            "konu": doc.get("metadata", {}).get("konu", ""),
                            "ihlal_edilen_hak": doc.get("metadata", {}).get("ihlal_edilen_hak", ""),
                        }

                        chunks = self.chunker.chunk_karar(content, metadata)
                        if not chunks:
                            chunks = self.chunker.chunk_generic(content, metadata)
                        all_chunks.extend(chunks)

                        await asyncio.sleep(3.0)

                    if all_chunks:
                        texts = [c["text"] for c in all_chunks]
                        embeddings = await self.embedding.embed_texts_async(texts)

                        points = []
                        for i, (chunk, emb) in enumerate(zip(all_chunks, embeddings)):
                            point_id = self._generate_id(
                                chunk["metadata"].get("karar_id", "") + str(i)
                            )
                            points.append({
                                "id": point_id,
                                "dense_vector": emb["dense_vector"],
                                "sparse_vector": emb.get("sparse_vector"),
                                "payload": {
                                    **chunk["metadata"],
                                    "text": chunk["text"][:self.settings.max_payload_text_chars],
                                    "ozet": chunk["text"][:self.settings.max_ozet_chars],
                                },
                            })

                        await self.vector_store.upsert_points(
                            collection=self.settings.qdrant_collection_ictihat,
                            points=points,
                        )
                        total_embedded += len(points)
                    _update_state(embedded=total_embedded, completed_topics=page)

                    _log("info", f"📄 AYM sayfa {page} — {len(items)} karar, {total_embedded} embedding")
                    await asyncio.sleep(5.0)

                except Exception as e:
                    logger.error("aym_page_error", page=page, error=str(e))
                    _update_state(errors=_ingest_state["errors"] + 1)
                    continue
        finally:
            await aym.close()
            _update_state(running=False, source=None, task=None)

        summary = {
            "source": "aym",
            "total_fetched": total_fetched,
            "total_embedded": total_embedded,
        }
        _log("success", f"✅ AYM tamamlandı — {total_embedded} embedding")
        return summary

    async def ingest_rekabet(self, max_pages: int = 1100) -> dict:
        """Rekabet Kurumu kararlarını ingest et."""
        from app.services.rekabet import RekabetService

        rekabet = RekabetService()
        total_fetched = 0
        total_embedded = 0
        total_errors = 0

        checkpoint = self._load_checkpoint()
        start_page = checkpoint.get("rekabet_last_page", 0) + 1

        _log("info", f"Rekabet Kurumu ingestion basladi — sayfa {start_page}/{max_pages}")
        _update_state(
            running=True, source="rekabet", task="Rekabet Kurulu",
            started_at=datetime.now().isoformat(),
            fetched=0, embedded=0, errors=0,
            total_topics=max_pages, completed_topics=start_page - 1,
        )

        try:
            for page in range(start_page, max_pages + 1):
                try:
                    result = await rekabet.search_decisions(page=page)
                    decisions = result.get("decisions", [])

                    if not decisions:
                        _log("info", f"Rekabet sayfa {page} bos — bitis")
                        break

                    # Gercek toplam sayfa bilgisi
                    actual_total = result.get("total_pages", max_pages)
                    if page > actual_total:
                        _log("info", f"Rekabet son sayfa asildi ({page} > {actual_total})")
                        break

                    total_fetched += len(decisions)
                    _update_state(fetched=total_fetched, task=f"Sayfa {page}/{actual_total}")

                    all_chunks = []
                    for decision in decisions:
                        karar_id = decision.get("karar_id", "")
                        if not karar_id:
                            continue

                        try:
                            doc = await rekabet.get_decision(karar_id)
                            content = doc.get("content", "")
                            if not content or len(content) < self.settings.min_karar_chars:
                                continue
                        except Exception as e:
                            logger.warning("rekabet_doc_error", karar_id=karar_id, error=str(e))
                            total_errors += 1
                            continue

                        doc_meta = doc.get("metadata", {})
                        metadata = {
                            "karar_id": f"rekabet_{karar_id}",
                            "mahkeme": "rekabet",
                            "daire": "Rekabet Kurulu",
                            "esas_no": doc_meta.get("decision_no", ""),
                            "karar_no": doc_meta.get("decision_no", ""),
                            "tarih": doc_meta.get("date", decision.get("date", "")),
                            "kaynak": "rekabet_kurumu",
                            "konu": doc_meta.get("title", decision.get("title", "")),
                        }

                        chunks = self.chunker.chunk_karar(content, metadata)
                        if not chunks:
                            chunks = self.chunker.chunk_generic(content, metadata)
                        all_chunks.extend(chunks)

                        await asyncio.sleep(2.0)

                    if all_chunks:
                        texts = [c["text"] for c in all_chunks]
                        embeddings = await self.embedding.embed_texts_async(texts)

                        points = []
                        for i, (chunk, emb) in enumerate(zip(all_chunks, embeddings)):
                            point_id = self._generate_id(
                                chunk["metadata"].get("karar_id", "") + str(i)
                            )
                            points.append({
                                "id": point_id,
                                "dense_vector": emb["dense_vector"],
                                "sparse_vector": emb.get("sparse_vector"),
                                "payload": {
                                    **chunk["metadata"],
                                    "text": chunk["text"][:self.settings.max_payload_text_chars],
                                    "ozet": chunk["text"][:self.settings.max_ozet_chars],
                                },
                            })

                        await self.vector_store.upsert_points(
                            collection=self.settings.qdrant_collection_ictihat,
                            points=points,
                        )
                        total_embedded += len(points)

                    _update_state(
                        embedded=total_embedded,
                        completed_topics=page,
                        errors=total_errors,
                    )

                    # Checkpoint kaydet
                    checkpoint["rekabet_last_page"] = page
                    self._save_checkpoint(checkpoint)

                    if page % 50 == 0:
                        _log("info", f"Rekabet sayfa {page}/{actual_total} — {total_fetched} karar, {total_embedded} embedding, {total_errors} hata")

                    await asyncio.sleep(1.5)

                except Exception as e:
                    logger.error("rekabet_page_error", page=page, error=str(e))
                    _update_state(errors=total_errors + 1)
                    total_errors += 1
                    continue
        finally:
            await rekabet.close()
            _update_state(running=False, source=None, task=None)

        summary = {
            "source": "rekabet",
            "total_fetched": total_fetched,
            "total_embedded": total_embedded,
            "total_errors": total_errors,
            "last_page": checkpoint.get("rekabet_last_page", 0),
        }
        _log("success", f"Rekabet tamamlandi — {total_embedded} embedding, {total_errors} hata")
        return summary

    async def ingest_kvkk(self, max_decisions: int = 1000) -> dict:
        """KVKK Kurul kararlarını ingest et."""
        from app.services.kvkk import KvkkService

        kvkk = KvkkService()
        total_fetched = 0
        total_embedded = 0
        total_errors = 0

        checkpoint = self._load_checkpoint()
        completed_ids = set(checkpoint.get("kvkk_completed_ids", []))

        _log("info", f"KVKK ingestion basladi — maks {max_decisions} karar, {len(completed_ids)} onceden tamamlanmis")
        _update_state(
            running=True, source="kvkk", task="KVKK Kurul Kararlari",
            started_at=datetime.now().isoformat(),
            fetched=0, embedded=0, errors=0,
            total_topics=max_decisions, completed_topics=len(completed_ids),
        )

        try:
            # Karar listesini cek
            decisions = await kvkk.list_decisions()
            _log("info", f"KVKK toplam {len(decisions)} karar bulundu")

            # Limit uygula
            decisions = decisions[:max_decisions]
            _update_state(total_topics=len(decisions))

            for idx, decision in enumerate(decisions, 1):
                decision_id = decision["id"]

                if decision_id in completed_ids:
                    continue

                try:
                    doc = await kvkk.get_decision(decision["url"])
                    content = doc.get("content", "")
                    total_fetched += 1

                    if not content or len(content) < self.settings.min_karar_chars:
                        logger.warning("kvkk_content_too_short", id=decision_id, length=len(content))
                        total_errors += 1
                        continue

                    doc_meta = doc.get("metadata", {})
                    metadata = {
                        "karar_id": f"kvkk_{decision_id}",
                        "mahkeme": "kvkk",
                        "daire": "Kurul Kararı",
                        "esas_no": "",
                        "karar_no": doc_meta.get("karar_no", ""),
                        "tarih": doc_meta.get("tarih", ""),
                        "kaynak": "kvkk",
                        "konu": doc_meta.get("konu", decision.get("title", "")),
                    }

                    chunks = self.chunker.chunk_karar(content, metadata)
                    if not chunks:
                        chunks = self.chunker.chunk_generic(content, metadata)

                    if chunks:
                        texts = [c["text"] for c in chunks]
                        embeddings = await self.embedding.embed_texts_async(texts)

                        points = []
                        for i, (chunk, emb) in enumerate(zip(chunks, embeddings)):
                            point_id = self._generate_id(
                                chunk["metadata"].get("karar_id", "") + str(i)
                            )
                            points.append({
                                "id": point_id,
                                "dense_vector": emb["dense_vector"],
                                "sparse_vector": emb.get("sparse_vector"),
                                "payload": {
                                    **chunk["metadata"],
                                    "text": chunk["text"][:self.settings.max_payload_text_chars],
                                    "ozet": chunk["text"][:self.settings.max_ozet_chars],
                                },
                            })

                        await self.vector_store.upsert_points(
                            collection=self.settings.qdrant_collection_ictihat,
                            points=points,
                        )
                        total_embedded += len(points)

                    # Checkpoint kaydet
                    completed_ids.add(decision_id)
                    checkpoint["kvkk_completed_ids"] = list(completed_ids)
                    checkpoint["last_update"] = datetime.now().isoformat()
                    self._save_checkpoint(checkpoint)

                    _update_state(
                        fetched=total_fetched,
                        embedded=total_embedded,
                        completed_topics=len(completed_ids),
                        errors=total_errors,
                        task=f"KVKK {idx}/{len(decisions)}",
                    )

                    if idx % 50 == 0:
                        _log("info", f"KVKK {idx}/{len(decisions)} — {total_embedded} embedding, {total_errors} hata")

                    # Polite delay
                    await asyncio.sleep(2.5)

                except Exception as e:
                    logger.error("kvkk_decision_error", id=decision_id, error=str(e))
                    total_errors += 1
                    _update_state(errors=total_errors)
                    continue
        finally:
            await kvkk.close()
            _update_state(running=False, source=None, task=None)

        summary = {
            "source": "kvkk",
            "total_fetched": total_fetched,
            "total_embedded": total_embedded,
            "total_errors": total_errors,
            "completed_ids": len(completed_ids),
        }
        _log("success", f"KVKK tamamlandi — {total_embedded} embedding, {total_errors} hata")
        return summary

    async def ingest_aihm(
        self,
        max_results: int = 50000,
        turkish_only: bool = False,
    ) -> dict:
        """AİHM Türkiye aleyhine kararları ingest et."""
        from app.services.hudoc import HudocService

        hudoc = HudocService()
        total_fetched = 0
        total_embedded = 0
        total_skipped = 0
        batch_size = 50

        # Checkpoint: kaldığımız yerden devam et
        checkpoint = self._load_checkpoint()
        start_offset = checkpoint.get("aihm_last_offset", 0)
        seen_ids: set[str] = set(checkpoint.get("aihm_seen_ids", []))

        _log("info", f"🇪🇺 AİHM ingestion başladı — max: {max_results}, offset: {start_offset}, seen: {len(seen_ids)}")
        _update_state(
            running=True, source="aihm", task="HUDOC",
            started_at=datetime.now().isoformat(),
            fetched=0, embedded=0, errors=0,
            total_topics=max_results // batch_size, completed_topics=start_offset // batch_size,
        )

        try:
            for start in range(start_offset, max_results, batch_size):
                try:
                    result = await hudoc.search_judgments(
                        start=start,
                        length=batch_size,
                        language="TUR" if turkish_only else None,
                    )

                    items = result.get("results", [])
                    if not items:
                        break

                    total_fetched += len(items)
                    _update_state(fetched=total_fetched, task=f"Batch {start}-{start+batch_size}")

                    all_chunks = []
                    for item in items:
                        itemid = item.get("itemid", "")
                        if not itemid:
                            continue

                        # Dedup: zaten işlenmiş kararları atla
                        karar_id = item.get("karar_id", f"aihm_{itemid}")
                        if karar_id in seen_ids:
                            total_skipped += 1
                            continue

                        try:
                            content = await hudoc.get_document(itemid)
                            if not content or len(content) < self.settings.min_karar_chars:
                                # Metadata'dan en azından conclusion'ı kullan
                                content = item.get("sonuc", "")
                                if not content or len(content) < 100:
                                    continue
                        except Exception as e:
                            logger.warning("aihm_doc_error", itemid=itemid, error=str(e))
                            content = item.get("sonuc", "")
                            if not content or len(content) < 100:
                                continue

                        metadata = {
                            "karar_id": karar_id,
                            "mahkeme": "aihm",
                            "daire": item.get("daire_tipi", ""),
                            "esas_no": item.get("basvuru_no", ""),
                            "karar_no": item.get("basvuru_no", ""),
                            "tarih": item.get("tarih", ""),
                            "kaynak": "aihm",
                            "ihlal_maddeleri": ", ".join(item.get("ihlal_maddeleri", [])),
                            "onem": item.get("onem", ""),
                            "baslik": item.get("baslik", ""),
                        }

                        chunks = self.chunker.chunk_karar(content, metadata)
                        if not chunks:
                            chunks = self.chunker.chunk_generic(content, metadata)
                        all_chunks.extend(chunks)

                        seen_ids.add(karar_id)
                        await asyncio.sleep(2.0)

                    if all_chunks:
                        texts = [c["text"] for c in all_chunks]
                        embeddings = await self.embedding.embed_texts_async(texts)

                        points = []
                        for i, (chunk, emb) in enumerate(zip(all_chunks, embeddings)):
                            point_id = self._generate_id(
                                chunk["metadata"].get("karar_id", "") + str(i)
                            )
                            points.append({
                                "id": point_id,
                                "dense_vector": emb["dense_vector"],
                                "sparse_vector": emb.get("sparse_vector"),
                                "payload": {
                                    **chunk["metadata"],
                                    "text": chunk["text"][:self.settings.max_payload_text_chars],
                                    "ozet": chunk["text"][:self.settings.max_ozet_chars],
                                },
                            })

                        await self.vector_store.upsert_points(
                            collection=self.settings.qdrant_collection_ictihat,
                            points=points,
                        )
                        total_embedded += len(points)
                    _update_state(embedded=total_embedded, completed_topics=(start // batch_size) + 1)

                    # Checkpoint kaydet (her batch sonrası)
                    checkpoint["aihm_last_offset"] = start + batch_size
                    checkpoint["aihm_seen_ids"] = list(seen_ids)
                    checkpoint["last_update"] = datetime.now().isoformat()
                    self._save_checkpoint(checkpoint)

                    _log("info", f"🌍 AİHM batch {start}-{start+batch_size} — {total_embedded} embedding, {total_skipped} atlandı")
                    await asyncio.sleep(3.0)

                except Exception as e:
                    logger.error("aihm_batch_error", start=start, error=str(e))
                    _update_state(errors=_ingest_state["errors"] + 1)
                    continue
        finally:
            await hudoc.close()
            _update_state(running=False, source=None, task=None)

        summary = {
            "source": "aihm",
            "total_fetched": total_fetched,
            "total_embedded": total_embedded,
            "total_skipped": total_skipped,
            "last_offset": checkpoint.get("aihm_last_offset", 0),
        }
        _log("success", f"✅ AİHM tamamlandı — {total_embedded} embedding, {total_skipped} atlandı")
        return summary

    async def _fetch_all_mevzuat_list(
        self,
        turleri: list[str],
    ) -> list[tuple[str, str, str]]:
        """Bedesten'deki tüm mevzuatı sayfa sayfa tarayıp liste oluşturur."""
        from app.services.mevzuat import MevzuatService

        svc = MevzuatService()
        all_items = []

        try:
            for tur in turleri:
                page = 1
                while True:
                    try:
                        result = await svc.search(
                            keyword="", mevzuat_turu=tur,
                            page=page, page_size=20,
                        )
                    except Exception as e:
                        _log("info", f"⚠️ Mevzuat listesi çekilemedi: {tur} sayfa {page}: {e}")
                        break

                    items = result.get("sonuclar", [])
                    if not items:
                        break

                    for it in items:
                        no = str(it.get("kanun_no", ""))
                        adi = it.get("kanun_adi", "")
                        mid = it.get("mevzuat_id", "")
                        if no and adi and mid:
                            all_items.append((no, adi, tur))

                    total = result.get("toplam", 0)
                    if page * 20 >= total:
                        break
                    page += 1
                    await asyncio.sleep(1.0)

                _log("info", f"📋 {tur}: {len([x for x in all_items if x[2] == tur])} mevzuat bulundu")
        finally:
            await svc.close()

        _log("info", f"📋 Toplam {len(all_items)} mevzuat çekilecek")
        return all_items

    async def ingest_mevzuat(
        self,
        mevzuat_list: list[tuple] | None = None,
        fetch_all: bool = False,
        mevzuat_turleri: list[str] | None = None,
    ) -> dict:
        """
        Mevzuat ingestion — Bedesten mevzuat API'den kanun metinlerini çeker,
        madde bazlı chunk'lar, embed eder, mevzuat_embeddings koleksiyonuna yükler.

        fetch_all=True: Sabit liste yerine Bedesten'deki TÜM mevzuatı sayfa sayfa çeker.
        mevzuat_turleri: fetch_all modunda hangi türleri çekeceğini belirler (default: ["kanun", "khk"])
        """
        from app.services.mevzuat import MevzuatService
        from app.services.cache import CacheService

        if fetch_all:
            mevzuat_list = await self._fetch_all_mevzuat_list(
                mevzuat_turleri or ["kanun", "khk"]
            )
        elif mevzuat_list is None:
            mevzuat_list = DEFAULT_MEVZUAT

        cache = CacheService()
        mevzuat_svc = MevzuatService(cache=cache)

        total_fetched = 0
        total_embedded = 0
        total_chunks_count = 0

        _log("info", f"📜 Mevzuat ingestion başladı — {len(mevzuat_list)} kanun")
        _update_state(
            running=True, source="mevzuat", task="Mevzuat",
            started_at=datetime.now().isoformat(),
            fetched=0, embedded=0, errors=0,
            total_topics=len(mevzuat_list), completed_topics=0,
        )

        try:
            for idx, entry in enumerate(mevzuat_list, 1):
                # Eski format (no, ad) ve yeni format (no, ad, tur) desteği
                if len(entry) == 3:
                    kanun_no, kanun_adi, mevzuat_turu = entry
                else:
                    kanun_no, kanun_adi = entry
                    mevzuat_turu = "kanun"

                _update_state(task=f"{kanun_adi} ({kanun_no})", completed_topics=idx - 1)
                _log("info", f"📖 {kanun_adi} ({kanun_no}) çekiliyor...")

                try:
                    # Kanunu ara — tür filtresi ile doğru belgeyi bul
                    search_result = await mevzuat_svc.search(
                        keyword="",
                        mevzuat_no=kanun_no,
                        mevzuat_turu=mevzuat_turu,
                        page_size=5,
                    )

                    items = search_result.get("sonuclar", [])
                    if not items:
                        _log("info", f"⚠️ {kanun_adi} ({kanun_no}) bulunamadı")
                        _update_state(errors=_ingest_state["errors"] + 1)
                        continue

                    mevzuat_id = items[0].get("mevzuat_id", "")
                    if not mevzuat_id:
                        _log("info", f"⚠️ {kanun_adi} mevzuat_id yok")
                        continue

                    total_fetched += 1
                    _update_state(fetched=total_fetched)

                    # Tam metni çek
                    doc = await mevzuat_svc.get_content(mevzuat_id)
                    content_text = doc.get("content", "")

                    if not content_text or len(content_text) < 100:
                        _log("info", f"⚠️ {kanun_adi} içerik boş veya çok kısa")
                        continue

                    # PDF kontrolü — PDF parse edilemiyor, atla
                    if content_text.lstrip()[:5] == "%PDF-":
                        _log("info", f"⚠️ {kanun_adi} PDF formatında, HTML değil — atlanıyor")
                        _update_state(errors=_ingest_state["errors"] + 1)
                        continue

                    clean = clean_legal_html(content_text)

                    # Metadata — content_hash ile refresh karşılaştırması yapılabilir
                    content_hash = hashlib.md5(clean.encode()).hexdigest()
                    metadata = {
                        "mevzuat_id": mevzuat_id,
                        "kanun_no": kanun_no,
                        "kanun_adi": kanun_adi,
                        "tur": items[0].get("tur", "Kanun"),
                        "resmi_gazete_tarihi": items[0].get("resmi_gazete_tarihi", ""),
                        "kaynak": "bedesten_mevzuat",
                        "content_hash": content_hash,
                        "ingested_at": datetime.now().isoformat(),
                    }

                    # Madde bazlı chunk'la
                    chunks = self.chunker.chunk_mevzuat(clean, metadata)
                    if not chunks:
                        chunks = self.chunker.chunk_generic(clean, metadata)

                    if not chunks:
                        _log("info", f"⚠️ {kanun_adi} chunk üretilemedi")
                        continue

                    total_chunks_count += len(chunks)

                    # Embed et
                    texts = [c["text"] for c in chunks]
                    embeddings = await self.embedding.embed_texts_async(texts)

                    # Qdrant'a yükle — mevzuat_embeddings koleksiyonuna
                    points = []
                    for i, (chunk, emb) in enumerate(zip(chunks, embeddings)):
                        point_id = self._generate_id(
                            f"mevzuat_{kanun_no}_{i}"
                        )
                        points.append({
                            "id": point_id,
                            "dense_vector": emb["dense_vector"],
                            "sparse_vector": emb.get("sparse_vector"),
                            "payload": {
                                **chunk["metadata"],
                                "text": chunk["text"][:self.settings.max_payload_text_chars],
                                "ozet": chunk["text"][:500],
                            },
                        })

                    await self.vector_store.upsert_points(
                        collection=self.settings.qdrant_collection_mevzuat,
                        points=points,
                    )
                    total_embedded += len(points)
                    _update_state(embedded=total_embedded, completed_topics=idx)

                    _log("info", f"✅ {kanun_adi} — {len(chunks)} madde, {len(points)} embedding")

                    await asyncio.sleep(3.0)

                except Exception as e:
                    logger.error("mevzuat_ingest_error", kanun_no=kanun_no, error=str(e))
                    _log("error", f"❌ {kanun_adi} hatası: {str(e)}")
                    _update_state(errors=_ingest_state["errors"] + 1)
                    continue
        finally:
            await mevzuat_svc.close()
            _update_state(running=False, source=None, task=None)

        summary = {
            "source": "mevzuat",
            "total_fetched": total_fetched,
            "total_chunks": total_chunks_count,
            "total_embedded": total_embedded,
        }
        _log("success", f"🎉 Mevzuat tamamlandı — {total_embedded} embedding ({total_fetched} kanun)")
        return summary

    async def refresh_mevzuat(
        self,
        dry_run: bool = False,
        fetch_all: bool = True,
        mevzuat_turleri: list[str] | None = None,
    ) -> dict:
        """
        Mevzuat diff-based güncelleme.
        Bedesten'den güncel içeriği çeker, mevcut embedding'lerle hash karşılaştırır.
        Sadece değişenleri günceller (eski chunk'ları sil → yenilerini yaz).

        dry_run=True: Sadece karşılaştırma yapar, hiçbir şeyi değiştirmez.
        """
        from app.services.mevzuat import MevzuatService
        from app.services.cache import CacheService

        if fetch_all:
            mevzuat_list = await self._fetch_all_mevzuat_list(
                mevzuat_turleri or ["kanun", "khk"]
            )
        else:
            mevzuat_list = DEFAULT_MEVZUAT

        cache = CacheService()
        mevzuat_svc = MevzuatService(cache=cache)

        updated = 0
        skipped = 0
        errors = 0
        new_added = 0
        details = []

        _log("info", f"🔄 Mevzuat refresh başladı — {len(mevzuat_list)} kanun, dry_run={dry_run}")
        _update_state(
            running=True, source="mevzuat_refresh", task="Mevzuat Refresh",
            started_at=datetime.now().isoformat(),
            fetched=0, embedded=0, errors=0,
            total_topics=len(mevzuat_list), completed_topics=0,
        )

        try:
            for idx, entry in enumerate(mevzuat_list, 1):
                if len(entry) == 3:
                    kanun_no, kanun_adi, mevzuat_turu = entry
                else:
                    kanun_no, kanun_adi = entry
                    mevzuat_turu = "kanun"

                _update_state(task=f"Refresh: {kanun_adi} ({kanun_no})", completed_topics=idx - 1)

                try:
                    # 1) Bedesten'den güncel içeriği çek
                    search_result = await mevzuat_svc.search(
                        keyword="",
                        mevzuat_no=kanun_no,
                        mevzuat_turu=mevzuat_turu,
                        page_size=5,
                    )
                    items = search_result.get("sonuclar", [])
                    if not items:
                        skipped += 1
                        continue

                    mevzuat_id = items[0].get("mevzuat_id", "")
                    if not mevzuat_id:
                        skipped += 1
                        continue

                    doc = await mevzuat_svc.get_content(mevzuat_id)
                    content_text = doc.get("content", "")

                    if not content_text or len(content_text) < 100:
                        skipped += 1
                        continue

                    if content_text.lstrip()[:5] == "%PDF-":
                        skipped += 1
                        continue

                    # 2) Güncel içeriğin hash'i
                    clean = clean_legal_html(content_text)
                    new_hash = hashlib.md5(clean.encode()).hexdigest()

                    # 3) Qdrant'taki mevcut hash'i kontrol et
                    existing = await self.vector_store.scroll_by_filter(
                        collection=self.settings.qdrant_collection_mevzuat,
                        field="kanun_no",
                        value=kanun_no,
                        limit=1,
                    )

                    old_hash = ""
                    if existing:
                        old_hash = existing[0].get("payload", {}).get("content_hash", "")

                    # 4) Hash eşleşiyor mu?
                    if old_hash and old_hash == new_hash:
                        skipped += 1
                        continue

                    action = "UPDATE" if existing else "NEW"
                    _log("info", f"{'🆕' if action == 'NEW' else '♻️'} {kanun_adi} ({kanun_no}) — {action} (hash değişti)")

                    if dry_run:
                        details.append({
                            "kanun_no": kanun_no,
                            "kanun_adi": kanun_adi,
                            "action": action,
                            "old_hash": old_hash[:8] if old_hash else "yok",
                            "new_hash": new_hash[:8],
                        })
                        if action == "UPDATE":
                            updated += 1
                        else:
                            new_added += 1
                        continue

                    # 5) Eski chunk'ları sil (varsa)
                    if existing:
                        await self.vector_store.delete_by_filter(
                            collection=self.settings.qdrant_collection_mevzuat,
                            field="kanun_no",
                            value=kanun_no,
                        )

                    # 6) Yeni chunk'la ve embed et
                    metadata = {
                        "mevzuat_id": mevzuat_id,
                        "kanun_no": kanun_no,
                        "kanun_adi": kanun_adi,
                        "tur": items[0].get("tur", "Kanun"),
                        "resmi_gazete_tarihi": items[0].get("resmi_gazete_tarihi", ""),
                        "kaynak": "bedesten_mevzuat",
                        "content_hash": new_hash,
                        "ingested_at": datetime.now().isoformat(),
                    }

                    chunks = self.chunker.chunk_mevzuat(clean, metadata)
                    if not chunks:
                        chunks = self.chunker.chunk_generic(clean, metadata)

                    if not chunks:
                        errors += 1
                        continue

                    texts = [c["text"] for c in chunks]
                    embeddings = await self.embedding.embed_texts_async(texts)

                    points = []
                    for i, (chunk, emb) in enumerate(zip(chunks, embeddings)):
                        point_id = self._generate_id(f"mevzuat_{kanun_no}_{i}")
                        points.append({
                            "id": point_id,
                            "dense_vector": emb["dense_vector"],
                            "sparse_vector": emb.get("sparse_vector"),
                            "payload": {
                                **chunk["metadata"],
                                "text": chunk["text"][:self.settings.max_payload_text_chars],
                                "ozet": chunk["text"][:500],
                            },
                        })

                    await self.vector_store.upsert_points(
                        collection=self.settings.qdrant_collection_mevzuat,
                        points=points,
                    )

                    if action == "UPDATE":
                        updated += 1
                    else:
                        new_added += 1

                    _log("info", f"✅ {kanun_adi} — {len(points)} chunk güncellendi")
                    _update_state(embedded=updated + new_added, completed_topics=idx)

                    await asyncio.sleep(2.0)

                except Exception as e:
                    logger.error("mevzuat_refresh_error", kanun_no=kanun_no, error=str(e))
                    _log("error", f"❌ {kanun_adi} refresh hatası: {str(e)}")
                    errors += 1
                    continue
        finally:
            await mevzuat_svc.close()
            _update_state(running=False, source=None, task=None)

        summary = {
            "source": "mevzuat_refresh",
            "dry_run": dry_run,
            "total_checked": len(mevzuat_list),
            "updated": updated,
            "new_added": new_added,
            "skipped_unchanged": skipped,
            "errors": errors,
        }
        if dry_run and details:
            summary["changes"] = details

        _log("success", f"🎉 Mevzuat refresh tamamlandı — {updated} güncellendi, {new_added} yeni, {skipped} değişmemiş, {errors} hata")
        return summary

    async def ingest_batch(
        self,
        include_ictihat: bool = True,
        include_mevzuat: bool = True,
        include_aym: bool = True,
        include_aihm: bool = True,
        pages_per_topic: int = 3,
        aym_pages: int = 10,
        aihm_max: int = 500,
    ) -> dict:
        """
        Tüm kaynakları sırayla çalıştır: ictihat + mevzuat + AYM + AİHM.
        Batch ingestion tek çağrıyla tüm pipeline'ı tetikler.
        """
        results = {}

        _log("info", "🚀 Toplu ingestion başladı")

        try:
            if include_ictihat:
                _log("info", "📋 İçtihat ingestion başlatılıyor...")
                ictihat_result = await self.ingest_topics(
                    topics=DEFAULT_TOPICS,
                    pages_per_topic=pages_per_topic,
                )
                results["ictihat"] = ictihat_result

            if include_mevzuat:
                _log("info", "📜 Mevzuat ingestion başlatılıyor...")
                mevzuat_result = await self.ingest_mevzuat()
                results["mevzuat"] = mevzuat_result

            if include_aym:
                _log("info", "⚖️ AYM ingestion başlatılıyor...")
                aym_result = await self.ingest_aym(pages=aym_pages)
                results["aym"] = aym_result

            if include_aihm:
                _log("info", "🌍 AİHM ingestion başlatılıyor...")
                aihm_result = await self.ingest_aihm(max_results=aihm_max)
                results["aihm"] = aihm_result

        except Exception as e:
            _log("error", f"❌ Toplu ingestion hatası: {str(e)}")
            results["error"] = str(e)

        total_embedded = sum(
            r.get("total_embedded", 0) for r in results.values() if isinstance(r, dict)
        )
        _log("success", f"🎉 Toplu ingestion tamamlandı — toplam {total_embedded} embedding")

        return {
            "batch": True,
            "results": results,
            "total_embedded": total_embedded,
        }

    async def get_progress(self) -> dict:
        """Ingestion ilerleme durumunu döndür."""
        checkpoint = self._load_checkpoint()
        try:
            ictihat_info = await self.vector_store.get_collection_info(
                self.settings.qdrant_collection_ictihat
            )
            total_embeddings = ictihat_info.get("points_count", 0)
        except Exception:
            total_embeddings = 0

        return {
            "total_embeddings": total_embeddings,
            "completed_topics": len(checkpoint.get("completed_topics", [])),
            "completed_daireler": len(checkpoint.get("completed_daireler", [])),
            "last_update": checkpoint.get("last_update"),
            "topics_list": checkpoint.get("completed_topics", []),
        }

    def _generate_id(self, key: str) -> int:
        """Deterministik integer ID üret."""
        h = hashlib.md5(key.encode()).hexdigest()
        return int(h[:15], 16)

    @staticmethod
    def _load_checkpoint() -> dict:
        """Checkpoint dosyasını yükle."""
        try:
            if os.path.exists(CHECKPOINT_FILE):
                with open(CHECKPOINT_FILE) as f:
                    return json.load(f)
        except Exception:
            pass
        return {}

    @staticmethod
    def _save_checkpoint(data: dict):
        """Checkpoint dosyasını kaydet."""
        try:
            os.makedirs(os.path.dirname(CHECKPOINT_FILE), exist_ok=True)
            with open(CHECKPOINT_FILE, "w") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.warning("checkpoint_save_error", error=str(e))


DEFAULT_TOPICS = [
    # İş Hukuku (20)
    "işe iade",
    "kıdem tazminatı",
    "ihbar tazminatı",
    "fazla mesai ücreti",
    "haksız fesih",
    "geçerli fesih",
    "iş kazası tazminat",
    "meslek hastalığı tazminat",
    "mobbing işyeri",
    "sendikal tazminat",
    "toplu iş sözleşmesi",
    "mevsimlik işçi hakları",
    "alt işveren muvazaa",
    "iş güvencesi",
    "yıllık izin ücreti",
    "rekabet yasağı sözleşme",
    "belirli süreli iş sözleşmesi",
    "ücret alacağı",
    "işçilik alacakları zamanaşımı",
    "asıl işveren alt işveren",
    # Ceza Hukuku (16)
    "haksız tahrik ceza indirimi",
    "meşru müdafaa",
    "tutukluluk süresi",
    "hırsızlık suçu",
    "dolandırıcılık suçu",
    "kasten yaralama",
    "tehdit suçu",
    "şantaj suçu",
    "uyuşturucu madde ticareti",
    "cinsel saldırı suçu",
    "zimmet suçu",
    "rüşvet suçu",
    "görevi kötüye kullanma",
    "resmi belgede sahtecilik",
    "özel belgede sahtecilik",
    "taksirle öldürme",
    # Aile Hukuku (12)
    "boşanma tazminat",
    "velayet düzenlemesi",
    "nafaka artırım",
    "mal rejimi tasfiyesi",
    "evlat edinme",
    "soybağının reddi",
    "aile konutu şerhi",
    "zina sebebiyle boşanma",
    "şiddetli geçimsizlik",
    "tedbir nafakası",
    "yoksulluk nafakası",
    "iştirak nafakası",
    # Ticaret Hukuku (12)
    "ticari alacak temerrüt faizi",
    "çek iptali",
    "kambiyo senedi",
    "iflas erteleme",
    "konkordato",
    "anonim şirket genel kurul",
    "limited şirket ortaklık",
    "haksız rekabet",
    "marka ihlali",
    "patent ihlali",
    "ticari defter delil",
    "cari hesap alacağı",
    # Borçlar Hukuku (10)
    "sözleşme feshi",
    "haksız fiil tazminat",
    "sebepsiz zenginleşme",
    "kira tahliye",
    "kira tespit",
    "ecrimisil",
    "maddi manevi tazminat",
    "kefalet sözleşmesi",
    "ipotek paraya çevirme",
    "borca itiraz",
    # Miras Hukuku (6)
    "miras tenkis",
    "vasiyetname iptali",
    "mirasçılık belgesi",
    "miras paylaşımı",
    "saklı pay ihlali",
    "tereke tespiti",
    # İdare Hukuku (8)
    "idari işlem iptali",
    "tam yargı davası",
    "kamulaştırma bedel tespiti",
    "imar planı iptali",
    "memur disiplin cezası",
    "ihale iptali",
    "belediye encümen kararı",
    "idari para cezası",
    # İcra İflas Hukuku (6)
    "itirazın iptali",
    "menfi tespit davası",
    "istirdat davası",
    "ihalenin feshi",
    "sıra cetveline itiraz",
    "tasarrufun iptali",
    # Tüketici Hukuku (5)
    "ayıplı mal",
    "ayıplı hizmet",
    "tüketici kredisi",
    "mesafeli satış sözleşme",
    "abonelik iptali",
    # Gayrimenkul (5)
    "tapu iptali tescil",
    "ortaklığın giderilmesi",
    "müdahalenin meni",
    "kat mülkiyeti uyuşmazlık",
    "önalım hakkı",
]


# ── Temel mevzuat listesi (kanun numarası, kısa ad, mevzuat türü) ─────────
# Tür: "kanun" | "khk" | "cb_kararnamesi" | "yonetmelik" | "tuzuk" | None (filtre yok)
DEFAULT_MEVZUAT = [
    # Temel kanunlar
    ("2709", "Anayasa", "kanun"),
    ("5237", "Türk Ceza Kanunu", "kanun"),
    ("6098", "Türk Borçlar Kanunu", "kanun"),
    ("4721", "Türk Medeni Kanunu", "kanun"),
    ("6100", "Hukuk Muhakemeleri Kanunu", "kanun"),
    ("5271", "Ceza Muhakemesi Kanunu", "kanun"),
    ("2004", "İcra ve İflas Kanunu", "kanun"),
    ("6102", "Türk Ticaret Kanunu", "kanun"),
    ("4857", "İş Kanunu", "kanun"),
    ("2577", "İdari Yargılama Usulü Kanunu", "kanun"),
    ("6502", "Tüketicinin Korunması Hakkında Kanun", "kanun"),
    ("6698", "Kişisel Verilerin Korunması Kanunu", "kanun"),
    ("1136", "Avukatlık Kanunu", "kanun"),
    ("5510", "Sosyal Sigortalar ve Genel Sağlık Sigortası Kanunu", "kanun"),
    ("634", "Kat Mülkiyeti Kanunu", "kanun"),
    ("2942", "Kamulaştırma Kanunu", "kanun"),
    ("3194", "İmar Kanunu", "kanun"),
    ("657", "Devlet Memurları Kanunu", "kanun"),
    ("5235", "Adli Yargı İlk Derece Mahkemeleri Kuruluş Kanunu", "kanun"),
    ("7201", "Tebligat Kanunu", "kanun"),
    ("6706", "Cezai Konularda Uluslararası Adli İş Birliği Kanunu", "kanun"),
    ("7036", "İş Mahkemeleri Kanunu", "kanun"),
    ("6325", "Hukuk Uyuşmazlıklarında Arabuluculuk Kanunu", "kanun"),
    ("5326", "Kabahatler Kanunu", "kanun"),
    # Ek önemli kanunlar
    ("4734", "Kamu İhale Kanunu", "kanun"),
    ("5411", "Bankacılık Kanunu", "kanun"),
    ("6362", "Sermaye Piyasası Kanunu", "kanun"),
    ("5549", "Suç Gelirlerinin Aklanmasının Önlenmesi Kanunu", "kanun"),
    ("5651", "İnternet Ortamında Yapılan Yayınların Düzenlenmesi Kanunu", "kanun"),
    ("6331", "İş Sağlığı ve Güvenliği Kanunu", "kanun"),
    ("2886", "Devlet İhale Kanunu", "kanun"),
    ("213", "Vergi Usul Kanunu", "kanun"),
    ("193", "Gelir Vergisi Kanunu", "kanun"),
    ("3065", "Katma Değer Vergisi Kanunu", "kanun"),
    ("5520", "Kurumlar Vergisi Kanunu", "kanun"),
    ("4706", "Hazineye Ait Taşınmaz Malların Değerlendirilmesi Kanunu", "kanun"),
    # KHK'lar
    ("399", "KİT Personel Rejimi KHK", "khk"),
    ("375", "KHK/375 Ek Ödeme", "khk"),
]
