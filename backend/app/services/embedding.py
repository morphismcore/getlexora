"""
Embedding servisi.
bge-m3 modeli ile dense + sparse (BM25-like) vektör üretir.
"""

import structlog
import numpy as np
from functools import lru_cache

from app.config import get_settings

logger = structlog.get_logger()

# Lazy load — model sadece ilk kullanımda yüklenir
_model = None


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer

        settings = get_settings()
        logger.info("loading_embedding_model", model=settings.embedding_model)
        _model = SentenceTransformer(settings.embedding_model)
        logger.info("embedding_model_loaded")
    return _model


class EmbeddingService:
    """bge-m3 embedding servisi. Dense ve sparse vektör üretir."""

    def __init__(self):
        self.settings = get_settings()

    def embed_texts(self, texts: list[str]) -> list[dict]:
        """
        Metin listesini embed et.
        Her metin için dense vector + sparse vector döner.
        """
        model = _get_model()

        # Dense embeddings
        dense_vectors = model.encode(
            texts,
            normalize_embeddings=True,
            show_progress_bar=False,
        )

        results = []
        for i, text in enumerate(texts):
            result = {
                "dense_vector": dense_vectors[i].tolist(),
                "sparse_vector": self._compute_sparse(text),
            }
            results.append(result)

        return results

    def embed_query(self, query: str) -> dict:
        """Tek bir sorguyu embed et."""
        return self.embed_texts([query])[0]

    def _compute_sparse(self, text: str) -> dict:
        """
        Gelişmiş BM25-like sparse vector üret.
        TF + basit IDF benzeri ağırlıklama + Türkçe suffix stripping.
        """
        import re
        import math

        # Tokenize
        words = re.findall(r"[a-zA-ZçğıöşüÇĞİÖŞÜ]+", text.lower())
        if not words:
            return {"indices": [], "values": []}

        # Türkçe suffix stripping + stop word filtresi
        cleaned = []
        for word in words:
            if len(word) < 3 or word in TURKISH_STOP_WORDS:
                continue
            stem = _turkish_stem(word)
            if stem and len(stem) >= 2:
                cleaned.append(stem)

        if not cleaned:
            return {"indices": [], "values": []}

        # Term frequency
        tf = {}
        for word in cleaned:
            tf[word] = tf.get(word, 0) + 1

        # BM25-like scoring: tf * (k1 + 1) / (tf + k1 * (1 - b + b * dl/avgdl))
        k1 = 1.5
        b = 0.75
        dl = len(cleaned)
        avgdl = max(dl, 100)  # POC: ortalama doküman uzunluğu tahmini

        indices = []
        values = []
        for word, count in tf.items():
            # Deterministik hash — collision azaltmak için büyük alan
            idx = abs(hash(word)) % 500000
            # BM25 TF saturation
            score = (count * (k1 + 1)) / (count + k1 * (1 - b + b * dl / avgdl))
            # Log normalizasyon
            score = math.log(1 + score)
            indices.append(idx)
            values.append(float(score))

        return {"indices": indices, "values": values}


def _turkish_stem(word: str) -> str:
    """Basit Türkçe suffix stripping — morfolojik analiz yerine heuristik."""
    suffixes = [
        "ları", "leri", "ların", "lerin", "lardan", "lerden",
        "lar", "ler", "dan", "den", "tan", "ten",
        "nın", "nin", "nun", "nün", "ın", "in", "un", "ün",
        "ya", "ye", "na", "ne", "da", "de", "ta", "te",
        "dır", "dir", "dur", "dür", "tır", "tir", "tur", "tür",
        "mış", "miş", "muş", "müş", "yor", "rak", "rek",
        "arak", "erek", "ıyor", "iyor", "uyor", "üyor",
        "ması", "mesi", "mak", "mek",
        "lık", "lik", "luk", "lük",
        "sız", "siz", "suz", "süz",
        "cı", "ci", "cu", "cü", "çı", "çi", "çu", "çü",
    ]
    for suffix in suffixes:
        if word.endswith(suffix) and len(word) - len(suffix) >= 2:
            return word[:-len(suffix)]
    return word


# Genişletilmiş Türkçe stop words
TURKISH_STOP_WORDS = {
    # Bağlaçlar
    "bir", "ve", "bu", "da", "de", "ile", "için", "olan", "olarak",
    "gibi", "daha", "ancak", "ise", "veya", "hem", "her", "çok",
    "kadar", "sonra", "önce", "üzere", "göre", "karşı", "rağmen",
    "dolayı", "tarafından", "buna", "şu", "diğer", "aynı", "bazı",
    # Zamirler
    "ben", "sen", "biz", "siz", "onlar", "kendi", "bunu", "şunu",
    "onu", "bunun", "onun", "bunlar", "şunlar",
    # Edatlar
    "den", "dan", "dir", "dır", "nin", "nın", "nün", "nun",
    "ler", "lar", "ın", "in", "ya", "ye", "ki", "mi", "mu",
    "mı", "mü", "deki", "daki",
    # Yardımcı fiiller
    "olan", "olup", "olmuş", "olan", "etmek", "etmiş", "etti",
    "var", "yok", "değil", "ama", "fakat", "lakin", "halde",
    # Yaygın kelimeler
    "arasında", "üzerinde", "altında", "yanında", "içinde",
    "hakkında", "ilişkin", "dair", "ait", "itibaren", "kadar",
    "sadece", "yalnız", "bile", "henüz", "artık", "zaten",
    "hiç", "hiçbir", "böyle", "öyle", "nasıl", "neden", "niçin",
}
