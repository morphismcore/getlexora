# LEGACY: Embedding-based incremental ingestion. PostgreSQL-first mimaride kullanılmaz.
# Phase 2'de embedding katmanı eklendiğinde tekrar aktif olacak.
"""
LEGACY — Incremental ingestion — gunluk otomatik guncelleme.
Son ingestion'dan bu yana eklenen yeni kararlari ceker.
Embedding pipeline (ingest.py) bağımlıdır. PG-first için pg_ingest.py kullanın.
"""

import asyncio
import json
import os
from datetime import datetime

import structlog

from app.config import get_settings
from app.services.yargi import YargiService, ITEM_TYPES
from app.services.vector_store import VectorStoreService
from app.services.embedding import EmbeddingService
from app.ingestion.chunker import LegalChunker
from app.ingestion.html_cleaner import clean_legal_html

logger = structlog.get_logger()

WATERMARK_FILE = "/app/data/ingestion_watermark.json"


class IncrementalIngestion:
    """Son cekimden bu yana yeni kararlari otomatik ingest eder."""

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

    async def run_incremental(self) -> dict:
        """
        Incremental ingestion calistir.
        Son watermark'tan itibaren yeni kararlari ceker.
        Zaten cekilmis documentId'lere ulasinca durur.
        """
        watermark = self._load_watermark()
        known_ids = set(watermark.get("known_document_ids", []))
        court_types = ["yargitay", "danistay"]

        total_new = 0
        total_embedded = 0
        new_ids = []

        logger.info("incremental_start", known_ids=len(known_ids))

        for ct in court_types:
            item_type = ITEM_TYPES.get(ct, "YARGITAYKARARI")
            found_known = False

            for page in range(1, 20):  # Max 20 sayfa (200 karar) kontrol
                if found_known:
                    break

                try:
                    result = await self.yargi.search_bedesten(
                        keyword="karar",
                        item_type=item_type,
                        page=page,
                        page_size=10,
                    )

                    items = result.get("data", {}).get("emsalKararList", [])
                    if not items:
                        break

                    all_chunks = []
                    for item in items:
                        doc_id = item.get("documentId", "")
                        if not doc_id:
                            continue

                        # Zaten bilinen ID'ye ulastik -> dur
                        if doc_id in known_ids:
                            found_known = True
                            break

                        # Yeni karar -- ingest et
                        try:
                            doc = await self.yargi.get_document(doc_id)
                            content = doc.get("data", {}).get("decoded_content", "")
                            if not content:
                                continue

                            clean = clean_legal_html(content)
                            if len(clean) < self.settings.min_karar_chars:
                                continue
                        except Exception as e:
                            logger.warning("incremental_doc_error", doc_id=doc_id, error=str(e))
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

                        new_ids.append(doc_id)
                        total_new += 1

                        await asyncio.sleep(1.5)

                    if all_chunks:
                        texts = [c["text"] for c in all_chunks]
                        embeddings = await self.embedding.embed_texts_async(texts)

                        points = []
                        for i, (chunk, emb) in enumerate(zip(all_chunks, embeddings)):
                            import hashlib
                            h = hashlib.md5(
                                (chunk["metadata"].get("karar_id", "") + str(i)).encode()
                            ).hexdigest()
                            point_id = int(h[:15], 16)

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

                    await asyncio.sleep(3.0)

                except Exception as e:
                    logger.error("incremental_page_error", ct=ct, page=page, error=str(e))
                    continue

        # Watermark guncelle -- son 200 ID'yi tut
        all_known = list(known_ids) + new_ids
        watermark["known_document_ids"] = all_known[-200:]
        watermark["last_run"] = datetime.now().isoformat()
        watermark["last_new_count"] = total_new
        self._save_watermark(watermark)

        summary = {
            "new_decisions": total_new,
            "new_embeddings": total_embedded,
            "timestamp": datetime.now().isoformat(),
        }
        logger.info("incremental_complete", **summary)
        return summary

    @staticmethod
    def _load_watermark() -> dict:
        try:
            if os.path.exists(WATERMARK_FILE):
                with open(WATERMARK_FILE) as f:
                    return json.load(f)
        except Exception:
            pass
        return {}

    @staticmethod
    def _save_watermark(data: dict):
        try:
            os.makedirs(os.path.dirname(WATERMARK_FILE), exist_ok=True)
            with open(WATERMARK_FILE, "w") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.warning("watermark_save_error", error=str(e))
