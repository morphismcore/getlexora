"""
Embedding servisi.
BAAI/bge-m3 modeli ile dense + native sparse vektör üretir.
"""

import structlog

from app.config import get_settings

logger = structlog.get_logger()

# Lazy load — model sadece ilk kullanımda yüklenir
_model = None


def _get_model():
    global _model
    if _model is None:
        from FlagEmbedding import BGEM3FlagModel

        settings = get_settings()
        logger.info("loading_embedding_model", model=settings.embedding_model)
        _model = BGEM3FlagModel(
            settings.embedding_model,
            use_fp16=True,
        )
        logger.info("embedding_model_loaded", model=settings.embedding_model)
    return _model


class EmbeddingService:
    """bge-m3 embedding servisi. Dense ve native sparse vektör üretir."""

    def __init__(self):
        self.settings = get_settings()

    def embed_texts(self, texts: list[str], batch_size: int = 32) -> list[dict]:
        """
        Metin listesini embed et.
        Her metin için dense vector + sparse vector döner.
        bge-m3 native sparse (learned lexical weights) kullanır.
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
                # Dense vector
                dense = dense_vecs[i].tolist()

                # Sparse vector from bge-m3 lexical weights
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

    def embed_query(self, query: str) -> dict:
        """Tek bir sorguyu embed et."""
        return self.embed_texts([query])[0]

    @staticmethod
    def _lexical_to_sparse(weights: dict) -> dict:
        """
        bge-m3 lexical weights'i Qdrant sparse vector formatına çevir.
        weights: {token_id: weight, ...}
        """
        if not weights:
            return {"indices": [], "values": []}

        indices = []
        values = []
        for token_id, weight in weights.items():
            idx = int(token_id) if isinstance(token_id, str) else token_id
            indices.append(idx)
            values.append(float(weight))

        return {"indices": indices, "values": values}
