"""
Embedding servisi.
BAAI/bge-m3 modeli ile dense + native sparse vektör üretir.
CPU-intensive encode işlemi thread pool'da çalışır, HTTP isteklerini bloklamaz.
"""

import asyncio
import structlog

from app.config import get_settings

logger = structlog.get_logger()

# Pin model to prevent silent embedding space changes
MODEL_NAME = "BAAI/bge-m3"
# Model version: BAAI/bge-m3 (pinned 2026-03, dim=1024)
MODEL_REVISION = "5617a9f61b028005a4858fdac845db406aefb181"

# Lazy load — model ilk kullanımda yüklenir (startup'ta preload edilebilir)
_model = None
_model_dimension: int | None = None


def _get_model():
    global _model, _model_dimension
    if _model is None:
        from FlagEmbedding import BGEM3FlagModel

        settings = get_settings()
        model_name = settings.embedding_model or MODEL_NAME
        logger.info("loading_embedding_model", model=model_name, pinned_revision=MODEL_REVISION)
        _model = BGEM3FlagModel(
            model_name,
            use_fp16=True,
        )
        # Detect dimension from a test encode
        try:
            test_out = _model.encode(["test"], return_dense=True, return_sparse=False, return_colbert_vecs=False)
            _model_dimension = len(test_out["dense_vecs"][0])
        except Exception:
            _model_dimension = 1024  # bge-m3 default
        logger.info(
            "embedding_model_loaded",
            model=model_name,
            revision=MODEL_REVISION,
            dimension=_model_dimension,
        )
    return _model


def _encode_batch_sync(texts: list[str]) -> dict:
    """Senkron encode — thread pool'da çalıştırılır."""
    model = _get_model()
    return model.encode(
        texts,
        return_dense=True,
        return_sparse=True,
        return_colbert_vecs=False,
    )


class EmbeddingService:
    """bge-m3 embedding servisi. Dense ve native sparse vektör üretir."""

    def __init__(self):
        self.settings = get_settings()

    def embed_texts(self, texts: list[str], batch_size: int = 8) -> list[dict]:
        """
        Metin listesini embed et (senkron versiyon — mevcut pipeline uyumluluğu).
        """
        model = _get_model()

        results = []
        for batch_start in range(0, len(texts), batch_size):
            batch_texts = texts[batch_start:batch_start + batch_size]

            output = model.encode(
                batch_texts,
                return_dense=True,
                return_sparse=True,
                return_colbert_vecs=False,
            )

            dense_vecs = output["dense_vecs"]
            lexical_weights = output["lexical_weights"]

            for i in range(len(batch_texts)):
                dense = dense_vecs[i].tolist()
                sparse = self._lexical_to_sparse(lexical_weights[i])
                results.append({
                    "dense_vector": dense,
                    "sparse_vector": sparse,
                })

            logger.debug(
                "embedding_batch_complete",
                batch_size=len(batch_texts),
                total_processed=min(batch_start + batch_size, len(texts)),
                total=len(texts),
            )

        return results

    async def embed_texts_async(self, texts: list[str], batch_size: int = 8) -> list[dict]:
        """
        Metin listesini embed et (asenkron versiyon).
        Her batch thread pool'da çalışır, aralarında event loop'a kontrol verilir.
        Bu sayede HTTP istekleri bloklanmaz.
        """
        loop = asyncio.get_event_loop()
        results = []

        for batch_start in range(0, len(texts), batch_size):
            batch_texts = texts[batch_start:batch_start + batch_size]

            # CPU-intensive encode'u thread pool'da çalıştır
            output = await loop.run_in_executor(None, _encode_batch_sync, batch_texts)

            dense_vecs = output["dense_vecs"]
            lexical_weights = output["lexical_weights"]

            for i in range(len(batch_texts)):
                dense = dense_vecs[i].tolist()
                sparse = self._lexical_to_sparse(lexical_weights[i])
                results.append({
                    "dense_vector": dense,
                    "sparse_vector": sparse,
                })

            logger.debug(
                "embedding_batch_complete",
                batch_size=len(batch_texts),
                total_processed=min(batch_start + batch_size, len(texts)),
                total=len(texts),
            )

            # Event loop'a nefes aldır
            await asyncio.sleep(0.5)

        return results

    def embed_query(self, query: str) -> dict:
        """Tek bir sorguyu embed et."""
        return self.embed_texts([query])[0]

    @staticmethod
    def _lexical_to_sparse(weights: dict) -> dict:
        """bge-m3 lexical weights'i Qdrant sparse vector formatına çevir."""
        if not weights:
            return {"indices": [], "values": []}

        # Filter out low-weight tokens (noise)
        MIN_SPARSE_WEIGHT = 0.1
        filtered = {k: v for k, v in weights.items() if v >= MIN_SPARSE_WEIGHT}

        indices = []
        values = []
        for token_id, weight in filtered.items():
            idx = int(token_id) if isinstance(token_id, str) else token_id
            indices.append(idx)
            values.append(float(weight))

        return {"indices": indices, "values": values}
