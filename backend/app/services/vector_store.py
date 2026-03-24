"""
Qdrant vector store servisi.
İçtihat ve mevzuat embedding'lerini saklar ve hybrid search yapar.
Dense + sparse aramaları paralel çalışır (asyncio.gather).
"""

import asyncio
import structlog
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    SparseVectorParams,
    SparseIndexParams,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
    Range,
    SearchParams,
    SparseVector,
    models,
)

from app.config import get_settings

logger = structlog.get_logger()


class VectorStoreService:
    """Qdrant üzerinden hybrid search (dense + sparse) servisi."""

    def __init__(self):
        settings = get_settings()
        self.client = AsyncQdrantClient(
            host=settings.qdrant_host,
            port=settings.qdrant_port,
        )
        self.ictihat_collection = settings.qdrant_collection_ictihat
        self.mevzuat_collection = settings.qdrant_collection_mevzuat
        self.embedding_dim = settings.embedding_dim

    async def initialize_collections(self):
        """Koleksiyonları oluştur (yoksa)."""
        for collection_name in [self.ictihat_collection, self.mevzuat_collection]:
            exists = await self.client.collection_exists(collection_name)
            if not exists:
                await self.client.create_collection(
                    collection_name=collection_name,
                    vectors_config={
                        "dense": VectorParams(
                            size=self.embedding_dim,
                            distance=Distance.COSINE,
                        ),
                    },
                    sparse_vectors_config={
                        "sparse": SparseVectorParams(
                            index=SparseIndexParams(on_disk=False),
                        ),
                    },
                )
                logger.info("collection_created", name=collection_name)
            else:
                logger.info("collection_exists", name=collection_name)

    async def upsert_points(
        self,
        collection: str,
        points: list[dict],
    ):
        """
        Noktaları Qdrant'a ekle/güncelle.

        Her point: {
            "id": str/int,
            "dense_vector": list[float],
            "sparse_vector": {"indices": [...], "values": [...]},
            "payload": {...}
        }
        """
        qdrant_points = []
        for p in points:
            vectors = {"dense": p["dense_vector"]}
            if "sparse_vector" in p and p["sparse_vector"]:
                vectors["sparse"] = SparseVector(
                    indices=p["sparse_vector"]["indices"],
                    values=p["sparse_vector"]["values"],
                )

            qdrant_points.append(
                PointStruct(
                    id=p["id"],
                    vector=vectors,
                    payload=p.get("payload", {}),
                )
            )

        await self.client.upsert(
            collection_name=collection,
            points=qdrant_points,
        )
        logger.info("upsert_ok", collection=collection, count=len(qdrant_points))

    async def search_hybrid(
        self,
        collection: str,
        dense_vector: list[float],
        sparse_vector: dict | None = None,
        filters: dict | None = None,
        limit: int = 20,
    ) -> list[dict]:
        """
        Hybrid search: dense (semantic) + sparse (keyword/BM25).
        PARALLEL: dense ve sparse aramaları aynı anda çalışır.
        RRF (Reciprocal Rank Fusion) ile birleştirir.
        """
        filter_obj = self._build_filter(filters) if filters else None

        # Run BOTH searches in parallel
        tasks = [
            self.client.query_points(
                collection_name=collection,
                query=dense_vector,
                using="dense",
                query_filter=filter_obj,
                limit=limit,
            )
        ]

        has_sparse = sparse_vector and sparse_vector.get("indices")
        if has_sparse:
            tasks.append(
                self.client.query_points(
                    collection_name=collection,
                    query=SparseVector(
                        indices=sparse_vector["indices"],
                        values=sparse_vector["values"],
                    ),
                    using="sparse",
                    query_filter=filter_obj,
                    limit=limit,
                )
            )

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Handle dense result
        dense_results = results[0]
        if isinstance(dense_results, Exception):
            logger.warning("dense_search_error", error=str(dense_results))
            dense_results = None

        # Handle sparse result
        sparse_results = None
        if has_sparse and len(results) > 1:
            sparse_results = results[1]
            if isinstance(sparse_results, Exception):
                logger.warning("sparse_search_error", error=str(sparse_results))
                sparse_results = None

        # RRF Fusion
        if dense_results and sparse_results:
            return self._rrf_fusion(dense_results.points, sparse_results.points, limit)
        elif dense_results:
            return [
                {
                    "id": p.id,
                    "score": p.score,
                    "payload": p.payload,
                }
                for p in dense_results.points
            ]
        elif sparse_results:
            return [
                {
                    "id": p.id,
                    "score": p.score,
                    "payload": p.payload,
                }
                for p in sparse_results.points
            ]
        else:
            return []

    def _rrf_fusion(
        self,
        dense_points: list,
        sparse_points: list,
        limit: int,
        k: int = 60,
        dense_weight: float = 0.55,
        sparse_weight: float = 0.45,
    ) -> list[dict]:
        """Weighted Reciprocal Rank Fusion — dense'e daha fazla ağırlık verir."""
        scores = {}

        for rank, p in enumerate(dense_points):
            pid = str(p.id)
            scores[pid] = scores.get(pid, {"score": 0, "payload": p.payload})
            scores[pid]["score"] += dense_weight * (1.0 / (k + rank + 1))

        for rank, p in enumerate(sparse_points):
            pid = str(p.id)
            scores[pid] = scores.get(pid, {"score": 0, "payload": p.payload})
            scores[pid]["score"] += sparse_weight * (1.0 / (k + rank + 1))

        ranked = sorted(scores.items(), key=lambda x: x[1]["score"], reverse=True)

        return [
            {"id": pid, "score": data["score"], "payload": data["payload"]}
            for pid, data in ranked[:limit]
        ]

    def _build_filter(self, filters: dict) -> Filter:
        """Filtre dict'ini Qdrant Filter'ına çevir."""
        conditions = []

        if "mahkeme" in filters:
            conditions.append(
                FieldCondition(key="mahkeme", match=MatchValue(value=filters["mahkeme"]))
            )
        if "daire" in filters:
            conditions.append(
                FieldCondition(key="daire", match=MatchValue(value=filters["daire"]))
            )
        if "hukuk_alani" in filters:
            conditions.append(
                FieldCondition(
                    key="hukuk_alani", match=MatchValue(value=filters["hukuk_alani"])
                )
            )
        if "yil_min" in filters:
            conditions.append(
                FieldCondition(key="yil", range=Range(gte=filters["yil_min"]))
            )
        if "yil_max" in filters:
            conditions.append(
                FieldCondition(key="yil", range=Range(lte=filters["yil_max"]))
            )

        return Filter(must=conditions) if conditions else None

    async def get_collection_info(self, collection: str) -> dict:
        """Koleksiyon bilgisi getir."""
        info = await self.client.get_collection(collection)
        return {
            "name": collection,
            "points_count": info.points_count,
            "vectors_count": info.vectors_count,
            "status": info.status.value,
        }

    async def count_by_filter(self, collection: str, field: str, value: str) -> int:
        """Filtreye göre point sayısı."""
        try:
            result = await self.client.count(
                collection_name=collection,
                count_filter=Filter(must=[
                    FieldCondition(key=field, match=MatchValue(value=value))
                ]),
            )
            return result.count
        except Exception:
            return 0

    async def close(self):
        await self.client.close()
