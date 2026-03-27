# LEGACY: Cross-encoder reranker. PostgreSQL-first mimaride kullanılmaz.
# Phase 2'de embedding katmanı eklendiğinde tekrar aktif olacak.
"""
LEGACY — Cross-encoder Reranking Service.
sentence-transformers cross-encoder modeli ile sonuçları yeniden sıralar.
PostgreSQL-first mimaride bu servis kullanılmaz.
Config ile açılıp kapatılabilir.
"""

import structlog
from typing import Any

logger = structlog.get_logger()


class RerankerService:
    """
    Cross-encoder tabanlı reranking servisi.
    Arama sonuçlarını sorguya göre yeniden sıralar.
    """

    def __init__(self, model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2", enabled: bool = True):
        self.model_name = model_name
        self.enabled = enabled
        self._model = None

        if self.enabled:
            self._load_model()

    def _load_model(self) -> None:
        """Model'i lazy load et."""
        if self._model is not None:
            return
        try:
            from sentence_transformers import CrossEncoder
            logger.info("reranker_loading", model=self.model_name)
            self._model = CrossEncoder(self.model_name)
            logger.info("reranker_loaded", model=self.model_name)
        except Exception as e:
            logger.warning(
                "reranker_load_failed",
                model=self.model_name,
                error=str(e),
                hint="Cross-encoder yüklenemedi, reranking devre dışı",
            )
            self.enabled = False

    def rerank(
        self,
        query: str,
        results: list[dict[str, Any]],
        text_key: str = "ozet",
        top_k: int | None = None,
        min_score: float | None = None,
    ) -> list[dict[str, Any]]:
        """
        Sonuçları cross-encoder ile yeniden sırala.

        Args:
            query: Arama sorgusu
            results: Sıralanacak sonuç listesi (dict'ler)
            text_key: Sonuç dict'inde metin içeren alanın anahtarı
            top_k: Döndürülecek maksimum sonuç (None = hepsi)
            min_score: Minimum cross-encoder skoru (None = filtre yok)

        Returns:
            Yeniden sıralanmış sonuç listesi (her birine 'rerank_score' eklenir)
        """
        if not self.enabled or not results:
            return results

        if self._model is None:
            self._load_model()
            if self._model is None:
                return results

        try:
            # Metin çıkar
            texts = []
            for r in results:
                text = r.get(text_key, "")
                if not text and "tam_metin" in r:
                    text = r["tam_metin"][:500]  # Tam metinden ilk 500 karakter
                if not text and "payload" in r:
                    payload = r["payload"]
                    text = payload.get(text_key, payload.get("tam_metin", ""))[:500]
                texts.append(text or "")

            # Cross-encoder çiftleri oluştur
            pairs = [(query, text) for text in texts]

            # Skor hesapla
            scores = self._model.predict(pairs)

            # Sonuçlara skor ekle
            scored_results = []
            for i, r in enumerate(results):
                r_copy = dict(r)
                r_copy["rerank_score"] = float(scores[i])
                scored_results.append(r_copy)

            # Skora göre sırala (yüksekten düşüğe)
            scored_results.sort(key=lambda x: x["rerank_score"], reverse=True)

            # min_score filtresi
            if min_score is not None:
                scored_results = [r for r in scored_results if r["rerank_score"] >= min_score]

            # top_k
            if top_k is not None:
                scored_results = scored_results[:top_k]

            logger.debug(
                "reranking_done",
                query=query[:50],
                input_count=len(results),
                output_count=len(scored_results),
                top_score=scored_results[0]["rerank_score"] if scored_results else 0,
            )

            return scored_results

        except Exception as e:
            logger.warning("reranking_error", error=str(e))
            return results

    def rerank_ictihat(
        self,
        query: str,
        results: list,
        top_k: int | None = None,
    ) -> list:
        """
        IctihatResult listesini rerank et.
        Pydantic model nesneleri için özelleştirilmiş versiyon.
        """
        if not self.enabled or not results:
            return results

        if self._model is None:
            self._load_model()
            if self._model is None:
                return results

        try:
            # Metin çıkar
            texts = []
            for r in results:
                text = getattr(r, "ozet", "") or ""
                if not text:
                    tam = getattr(r, "tam_metin", "") or ""
                    text = tam[:500]
                texts.append(text)

            pairs = [(query, text) for text in texts]
            raw_scores = self._model.predict(pairs)

            # Normalize all rerank scores to [0,1] using min-max across the batch
            float_scores = [float(s) for s in raw_scores]
            min_score = min(float_scores)
            max_score = max(float_scores)
            score_range = max_score - min_score if max_score > min_score else 1.0

            # (normalized_score, raw_score, result) tuples
            scored = []
            for i, r in enumerate(results):
                normalized_rerank = (float_scores[i] - min_score) / score_range
                scored.append((normalized_rerank, float_scores[i], r))
            scored.sort(key=lambda x: x[0], reverse=True)

            reranked = []
            for normalized_rerank, raw_score, r in scored:
                # Store raw rerank score for debugging
                r.rerank_score = raw_score
                # Original relevance already in [0,1]
                original = getattr(r, "relevance_score", 0.5) or 0.5
                # Blend: 40% original + 60% normalized rerank
                r.relevance_score = round(original * 0.4 + normalized_rerank * 0.6, 4)
                reranked.append(r)

            if top_k:
                reranked = reranked[:top_k]

            logger.debug(
                "reranking_ictihat_done",
                query=query[:50],
                input_count=len(results),
                output_count=len(reranked),
            )

            return reranked

        except Exception as e:
            logger.warning("reranking_ictihat_error", error=str(e))
            return results

    @staticmethod
    def _normalize_score(score: float) -> float:
        """Cross-encoder skorunu 0-1 arasına normalize et (sigmoid-like)."""
        import math
        return 1.0 / (1.0 + math.exp(-score))
