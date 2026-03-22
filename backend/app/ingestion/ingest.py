"""
Veri ingestion pipeline.
Bedesten API'den kararları çeker, chunk'lar, embed eder, Qdrant'a yükler.
"""

import asyncio
import hashlib
import json
import os
import re
from datetime import datetime

import structlog

from app.services.yargi import YargiService, ITEM_TYPES, YARGITAY_HUKUK_DAIRELERI, YARGITAY_CEZA_DAIRELERI
from app.services.vector_store import VectorStoreService
from app.services.embedding import EmbeddingService
from app.ingestion.chunker import LegalChunker
from app.config import get_settings

logger = structlog.get_logger()

CHECKPOINT_FILE = "/app/data/ingestion_checkpoint.json"


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
            court_types = ["yargitay"]

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
                    if not items:
                        break

                    total_fetched += len(items)

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

                            # HTML temizle — yapısal bilgiyi koru
                            clean = re.sub(r"<(?:br|BR)\s*/?>", "\n", content)
                            clean = re.sub(r"<(?:p|P|div|DIV)[^>]*>", "\n", clean)
                            clean = re.sub(r"<[^>]+>", " ", clean)
                            clean = clean.replace("&nbsp;", " ").replace("&amp;", "&")
                            clean = clean.replace("&lt;", "<").replace("&gt;", ">")
                            clean = clean.replace("&quot;", '"').replace("&apos;", "'")
                            clean = re.sub(r"&#\d+;", " ", clean)
                            clean = re.sub(r"&\w+;", " ", clean)
                            clean = re.sub(r"[ \t]+", " ", clean)
                            clean = re.sub(r"\n\s*\n+", "\n\n", clean).strip()

                            if len(clean) < 500:
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
                        await asyncio.sleep(0.5)

                    if not all_chunks:
                        continue

                    total_chunks += len(all_chunks)

                    # Batch embed
                    texts = [c["text"] for c in all_chunks]
                    embeddings = self.embedding.embed_texts(texts)

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
                                "text": chunk["text"],
                                "ozet": chunk["text"][:500],
                            },
                        })

                    await self.vector_store.upsert_points(
                        collection=self.settings.qdrant_collection_ictihat,
                        points=points,
                    )
                    total_embedded += len(points)

                    logger.info(
                        "ingest_page_complete",
                        court_type=ct,
                        page=page,
                        fetched=len(items),
                        chunks=len(all_chunks),
                        embedded=len(points),
                    )

                    await asyncio.sleep(1.0)

                except Exception as e:
                    logger.error(
                        "ingest_page_error",
                        court_type=ct,
                        page=page,
                        error=str(e),
                    )
                    continue

        summary = {
            "total_fetched": total_fetched,
            "total_chunks": total_chunks,
            "total_embedded": total_embedded,
            "keyword": keyword,
            "court_types": court_types,
        }
        logger.info("ingest_complete", **summary)
        return summary

    async def ingest_topics(self, topics: list[str], pages_per_topic: int = 3) -> dict:
        """Birden fazla hukuk konusu için toplu ingestion."""
        checkpoint = self._load_checkpoint()
        completed_topics = set(checkpoint.get("completed_topics", []))
        all_summaries = []

        for topic in topics:
            if topic in completed_topics:
                logger.info("ingest_topic_skipped", topic=topic, reason="checkpoint")
                continue

            logger.info("ingest_topic_start", topic=topic)
            summary = await self.ingest_search_results(
                keyword=topic,
                pages=pages_per_topic,
            )
            all_summaries.append(summary)

            # Save checkpoint
            completed_topics.add(topic)
            checkpoint["completed_topics"] = list(completed_topics)
            checkpoint["last_update"] = datetime.now().isoformat()
            self._save_checkpoint(checkpoint)

            await asyncio.sleep(2.0)

        total = {
            "topics": len(topics),
            "topics_skipped": len(topics) - len(all_summaries),
            "total_fetched": sum(s["total_fetched"] for s in all_summaries),
            "total_chunks": sum(s["total_chunks"] for s in all_summaries),
            "total_embedded": sum(s["total_embedded"] for s in all_summaries),
        }
        logger.info("ingest_all_topics_complete", **total)
        return total

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

                            clean = re.sub(r"<[^>]+>", " ", content)
                            clean = clean.replace("&nbsp;", " ").replace("&amp;", "&")
                            clean = re.sub(r"&\w+;", " ", clean)
                            clean = re.sub(r"\s+", " ", clean).strip()

                            if len(clean) < 100:
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

                        await asyncio.sleep(0.5)

                    if all_chunks:
                        texts = [c["text"] for c in all_chunks]
                        embeddings = self.embedding.embed_texts(texts)

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
                                    "text": chunk["text"][:2000],
                                    "ozet": chunk["text"][:500],
                                },
                            })

                        await self.vector_store.upsert_points(
                            collection=self.settings.qdrant_collection_ictihat,
                            points=points,
                        )
                        total_embedded += len(points)

                    await asyncio.sleep(1.0)

                except Exception as e:
                    logger.error("ingest_daire_page_error", daire=d_name, page=page, error=str(e))
                    continue

            completed_daireler.add(key)
            checkpoint["completed_daireler"] = list(completed_daireler)
            checkpoint["last_update"] = datetime.now().isoformat()
            self._save_checkpoint(checkpoint)

            logger.info("ingest_daire_complete", daire=d_name, embedded=total_embedded)
            await asyncio.sleep(2.0)

        return {
            "court_type": court_type,
            "daireler_processed": len(daireler),
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
