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
from datetime import datetime

import structlog

from app.services.yargi import YargiService, ITEM_TYPES, YARGITAY_HUKUK_DAIRELERI, YARGITAY_CEZA_DAIRELERI
from app.services.vector_store import VectorStoreService
from app.services.embedding import EmbeddingService
from app.ingestion.chunker import LegalChunker
from app.ingestion.html_cleaner import clean_legal_html
from app.config import get_settings

logger = structlog.get_logger()

CHECKPOINT_FILE = "/app/data/ingestion_checkpoint.json"

# ── In-memory log buffer (son 200 satır) ──────────────────
_ingest_logs: list[dict] = []
_ingest_running = False
MAX_LOG_LINES = 200

_ingest_state = {
    "running": False,
    "source": None,
    "task": None,
    "started_at": None,
    "fetched": 0,
    "embedded": 0,
    "errors": 0,
    "total_topics": 0,
    "completed_topics": 0,
}


def _update_state(**kwargs):
    """Ingestion state güncelle."""
    global _ingest_state
    _ingest_state.update(kwargs)


def _log(level: str, message: str):
    """Log buffer'a ekle."""
    global _ingest_logs
    _ingest_logs.append({
        "ts": datetime.now().isoformat(),
        "level": level,
        "msg": message,
    })
    if len(_ingest_logs) > MAX_LOG_LINES:
        _ingest_logs = _ingest_logs[-MAX_LOG_LINES:]
    # Ayrıca structlog'a da yaz
    if level == "error":
        logger.error("ingest_log", msg=message)
    else:
        logger.info("ingest_log", msg=message)


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

                        metadata = {
                            "karar_id": doc_id,
                            "mahkeme": ct,
                            "daire": item.get("birimAdi", ""),
                            "esas_no": esas_no,
                            "karar_no": karar_no,
                            "tarih": item.get("kararTarihiStr", ""),
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
            daireler = {**YARGITAY_HUKUK_DAIRELERI, **YARGITAY_CEZA_DAIRELERI}
        else:
            daireler = {}

        if daire_id:
            if daire_id not in daireler:
                return {"error": f"Daire bulunamadı: {daire_id}"}
            daireler = {daire_id: daireler[daire_id]}

        checkpoint = self._load_checkpoint()
        completed_daireler = set(checkpoint.get("completed_daireler", []))
        total_embedded = 0

        for d_id, d_name in daireler.items():
            key = f"{court_type}:{d_id}"
            if key in completed_daireler:
                logger.info("ingest_daire_skipped", daire=d_name, reason="checkpoint")
                continue

            logger.info("ingest_daire_start", daire=d_name)

            item_type = ITEM_TYPES.get(court_type, "YARGITAYKARARI")

            for page in range(1, pages + 1):
                try:
                    result = await self.yargi.search_bedesten(
                        keyword="*",
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

                        metadata = {
                            "karar_id": doc_id,
                            "mahkeme": court_type,
                            "daire": d_name,
                            "esas_no": esas_no,
                            "karar_no": karar_no,
                            "tarih": item.get("kararTarihiStr", ""),
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

        _log("info", f"📅 Tarih bazlı ingestion: {start_date} → {end_date}")

        for ct in court_types:
            item_type = ITEM_TYPES.get(ct, "YARGITAYKARARI")

            for page in range(1, max_pages + 1):
                try:
                    result = await self.yargi.search_bedesten(
                        keyword="*",
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

                        metadata = {
                            "karar_id": doc_id,
                            "mahkeme": ct,
                            "daire": item.get("birimAdi", ""),
                            "esas_no": esas_no,
                            "karar_no": karar_no,
                            "tarih": item.get("kararTarihiStr", ""),
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

    async def ingest_aihm(
        self,
        max_results: int = 500,
        turkish_only: bool = False,
    ) -> dict:
        """AİHM Türkiye aleyhine kararları ingest et."""
        from app.services.hudoc import HudocService

        hudoc = HudocService()
        total_fetched = 0
        total_embedded = 0
        batch_size = 50

        _log("info", f"🇪🇺 AİHM ingestion başladı — max: {max_results}")
        _update_state(
            running=True, source="aihm", task="HUDOC",
            started_at=datetime.now().isoformat(),
            fetched=0, embedded=0, errors=0,
            total_topics=max_results // 50, completed_topics=0,
        )

        try:
            for start in range(0, max_results, batch_size):
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
                            "karar_id": item.get("karar_id", f"aihm_{itemid}"),
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

                    _log("info", f"🌍 AİHM batch {start}-{start+batch_size} — {total_embedded} embedding")
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
        }
        _log("success", f"✅ AİHM tamamlandı — {total_embedded} embedding")
        return summary

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
