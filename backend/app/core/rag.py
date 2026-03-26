"""
RAG (Retrieval-Augmented Generation) Pipeline.
Arama: LLM olmadan calisir (Bedesten API + Vector DB).
Soru-cevap: LLM gerektirir (opsiyonel).

Performance: Tum bagimsiz arama kaynaklari paralel calisir (asyncio.gather).
Hedef: <800ms (onceki: 1.5-4.5s).
"""

import asyncio
import hashlib
import json
import math
import re
import time
import structlog

from app.services.yargi import YargiService
from app.services.mevzuat import MevzuatService
from app.services.vector_store import VectorStoreService
from app.services.embedding import EmbeddingService
from app.services.citation_verifier import CitationVerifierService
from app.services.query_expansion import QueryExpansionService
from app.services.reranker import RerankerService
from app.models.schemas import (
    SearchRequest,
    SearchResponse,
    IctihatResult,
    RAGResponse,
    VerificationStatus,
)
from app.config import get_settings

logger = structlog.get_logger()


class RAGPipeline:
    """
    Ana pipeline.
    search() -> LLM gerektirmez, dogrudan Bedesten API + Vector DB.
    ask() -> LLM gerektirir (Claude API).
    """

    def __init__(
        self,
        yargi: YargiService,
        mevzuat: MevzuatService,
        vector_store: VectorStoreService,
        embedding: EmbeddingService,
        verifier: CitationVerifierService,
        llm=None,  # opsiyonel
        query_expander: QueryExpansionService | None = None,
        reranker: RerankerService | None = None,
        cache=None,  # CacheService for embedding caching
    ):
        self.yargi = yargi
        self.mevzuat = mevzuat
        self.vector_store = vector_store
        self.embedding = embedding
        self.verifier = verifier
        self.llm = llm
        self.query_expander = query_expander
        self.reranker = reranker
        self.cache = cache
        self.settings = get_settings()

    @property
    def llm_available(self) -> bool:
        return self.llm is not None and bool(self.settings.anthropic_api_key)

    async def search(self, request: SearchRequest) -> SearchResponse:
        """
        Ictihat arama. LLM GEREKTIRMEZ.
        Tum bagimsiz kaynaklar PARALEL calisir:
          - Bedesten API (ana sorgu + synonym sorgulari)
          - Vector DB (embedding + Qdrant hybrid search)
        Sonra merge + rerank.
        """
        start = time.monotonic()

        # Check search response cache
        cache_key = None
        if self.cache:
            cache_key = self._build_search_cache_key(request)
            try:
                cached = await self.cache.get(cache_key)
                if cached is not None:
                    logger.debug("search_cache_hit", query=request.query[:50])
                    # Reconstruct SearchResponse from cached dict
                    cached_response = SearchResponse(**cached)
                    # Update timing to reflect cache hit
                    cached_response.sure_ms = int((time.monotonic() - start) * 1000)
                    return cached_response
            except Exception as e:
                logger.debug("search_cache_check_error", error=str(e))

        # 0. Query expansion (instant, ~1ms — CPU only, no I/O)
        search_query = request.query
        expansion_info = None
        if self.query_expander and self.settings.query_expansion_enabled:
            expansion_info = self.query_expander.expand_query(request.query)
            search_query = expansion_info["expanded"]
            logger.debug(
                "query_expansion_applied",
                original=request.query,
                expanded=search_query,
                synonyms=expansion_info["synonyms"][:5],
            )

        # Mahkeme filtresi
        court_types = ["yargitay"]
        if request.mahkeme:
            court_map = {
                "yargitay": ["yargitay"],
                "danistay": ["danistay"],
                "bam": ["istinaf_hukuk"],
            }
            court_types = []
            for m in request.mahkeme:
                court_types.extend(court_map.get(m.value, ["yargitay"]))

        daire = request.daire if hasattr(request, "daire") and request.daire else None

        # 1. PARALLEL: Bedesten API + ALL synonyms + Vector search
        # These are independent — run them ALL at the same time
        tasks = []
        task_labels = []

        # Date filters for Bedesten API
        date_from = request.tarih_baslangic.isoformat() if request.tarih_baslangic else None
        date_to = request.tarih_bitis.isoformat() if request.tarih_bitis else None

        # Task A: Main Bedesten search
        tasks.append(self._search_bedesten(search_query, court_types, daire, request.max_sonuc, date_from, date_to))
        task_labels.append("bedesten_main")

        # Task B: Synonym Bedesten searches (up to 2)
        if expansion_info and expansion_info.get("expanded_queries"):
            for syn_query in expansion_info["expanded_queries"][1:3]:
                tasks.append(self._search_bedesten_safe(syn_query, court_types, daire, 5, date_from, date_to))
                task_labels.append("bedesten_synonym")

        # Task C: Vector search (embedding + Qdrant in one async call)
        # Fetch more candidates to support pagination
        vector_limit = max(request.max_sonuc * 3, 60)
        tasks.append(self._search_vectors(request.query, request, vector_limit))
        task_labels.append("vector")

        # Run ALL tasks in parallel
        all_results = await asyncio.gather(*tasks, return_exceptions=True)

        # Collect results (skip exceptions)
        api_results = []
        vector_results = []
        search_warnings = []

        for i, result in enumerate(all_results):
            label = task_labels[i]
            if isinstance(result, Exception):
                if label == "bedesten_main":
                    search_warnings.append("Ana arama kaynagi baglantisi basarisiz oldu")
                    logger.warning("search_bedesten_main_failed", error=str(result))
                elif label == "bedesten_synonym":
                    search_warnings.append("Ek arama basarisiz oldu, sonuclar kismi olabilir.")
                    logger.warning("search_bedesten_synonym_failed", error=str(result))
                else:
                    logger.warning("search_vector_failed", error=str(result))
                continue

            if label == "vector":
                vector_results = result if isinstance(result, list) else []
            else:
                # Bedesten results (main or synonym)
                if isinstance(result, list):
                    api_results.extend(result)

        # 2. Merge — collect ALL candidates (don't slice yet, pagination needs full set)
        merge_limit = max(request.max_sonuc * request.sayfa, 60)
        results = self._merge_results(api_results, vector_results, merge_limit)

        # 3. Cross-encoder reranking — only TOP results for speed
        if self.reranker and self.settings.reranking_enabled and len(results) > 1:
            try:
                rerank_top_k = min(len(results), self.settings.rag_rerank_top_k or 20)
                results = self.reranker.rerank_ictihat(
                    query=request.query,
                    results=results,
                    top_k=rerank_top_k,
                )
                logger.debug(
                    "reranking_applied",
                    query=request.query[:50],
                    result_count=len(results),
                )
            except Exception as e:
                logger.warning("reranking_skip", error=str(e))

        # 4. Sort based on siralama parameter
        if request.siralama == "tarih_desc":
            results.sort(key=lambda x: x.tarih or "", reverse=True)
        elif request.siralama == "tarih_asc":
            results.sort(key=lambda x: x.tarih or "")
        # else: None — keep relevance_score order (default)

        # 5. Pagination
        toplam_bulunan = len(results)
        toplam_sayfa = max(1, math.ceil(toplam_bulunan / request.max_sonuc))
        page_start = (request.sayfa - 1) * request.max_sonuc
        page_end = page_start + request.max_sonuc
        results = results[page_start:page_end]

        elapsed = int((time.monotonic() - start) * 1000)

        response = SearchResponse(
            sonuclar=results,
            toplam_bulunan=toplam_bulunan,
            sayfa=request.sayfa,
            toplam_sayfa=toplam_sayfa,
            sure_ms=elapsed,
            query_kullanilan=request.query,
            warnings=search_warnings if search_warnings else [],
        )

        # Cache the search response (TTL: 5 minutes)
        if self.cache and cache_key:
            try:
                await self.cache.set(cache_key, response.model_dump(), ttl=300)
                logger.debug("search_cache_stored", query=request.query[:50])
            except Exception as e:
                logger.debug("search_cache_store_error", error=str(e))

        return response

    # ── Search cache helper ─────────────────────────────────────────

    @staticmethod
    def _build_search_cache_key(request: SearchRequest) -> str:
        """Build deterministic cache key from search request parameters."""
        parts = {
            "q": request.query,
            "mahkeme": sorted([m.value for m in request.mahkeme]) if request.mahkeme else None,
            "daire": request.daire if hasattr(request, "daire") and request.daire else None,
            "tarih_baslangic": str(request.tarih_baslangic) if request.tarih_baslangic else None,
            "tarih_bitis": str(request.tarih_bitis) if request.tarih_bitis else None,
            "hukuk_alani": request.hukuk_alani.value if request.hukuk_alani else None,
            "max_sonuc": request.max_sonuc,
            "sayfa": request.sayfa,
            "siralama": request.siralama if hasattr(request, "siralama") else None,
        }
        raw = json.dumps(parts, sort_keys=True, ensure_ascii=False)
        digest = hashlib.md5(raw.encode()).hexdigest()
        return f"lexora:search:{digest}"

    # ── Parallel search helpers ────────────────────────────────────

    async def _search_bedesten(self, query, court_types, daire, max_results, date_from=None, date_to=None):
        """Bedesten API search."""
        return await self.yargi.search_unified(
            keyword=query, court_types=court_types, daire=daire, max_results=max_results,
            date_from=date_from, date_to=date_to,
        )

    async def _search_bedesten_safe(self, query, court_types, daire, max_results, date_from=None, date_to=None):
        """Bedesten API search — returns empty on error."""
        try:
            return await self.yargi.search_unified(
                keyword=query, court_types=court_types, daire=daire, max_results=max_results,
                date_from=date_from, date_to=date_to,
            )
        except Exception:
            return []

    async def _search_vectors(self, query, request, max_results):
        """Embedding + Qdrant search — async embedding to not block event loop."""
        try:
            info = await self.vector_store.get_collection_info(
                self.settings.qdrant_collection_ictihat
            )
            if info["points_count"] == 0:
                return []

            # Check embedding cache first
            query_embedding = None
            if self.cache:
                query_embedding = await self._get_cached_embedding(query)

            if query_embedding is None:
                # Use async embedding (GPU API when available, thread pool for CPU)
                embeddings = await self.embedding.embed_texts_async([query])
                query_embedding = embeddings[0]
                # Cache for next time
                if self.cache:
                    await self._cache_embedding(query, query_embedding)

            # Build filters from request
            filters = {}
            if request.hukuk_alani:
                filters["hukuk_alani"] = request.hukuk_alani.value
            if request.mahkeme:
                filters["mahkeme"] = [m.value for m in request.mahkeme]
            if request.daire:
                filters["daire"] = request.daire
            if request.tarih_baslangic:
                filters["yil_min"] = request.tarih_baslangic.year
            if request.tarih_bitis:
                filters["yil_max"] = request.tarih_bitis.year

            return await self.vector_store.search_hybrid(
                collection=self.settings.qdrant_collection_ictihat,
                dense_vector=query_embedding["dense_vector"],
                sparse_vector=query_embedding.get("sparse_vector"),
                filters=filters if filters else None,
                limit=max_results,
            )
        except Exception as e:
            logger.warning("vector_search_error", error=str(e))
            return []

    # ── Embedding cache helpers ────────────────────────────────────

    async def _get_cached_embedding(self, query: str) -> dict | None:
        """Get cached embedding for a query."""
        try:
            return await self.cache.get_cached_embedding(query)
        except Exception:
            return None

    async def _cache_embedding(self, query: str, embedding: dict, ttl: int = 3600):
        """Cache query embedding (1 hour TTL)."""
        try:
            await self.cache.cache_embedding(query, embedding, ttl=ttl)
        except Exception:
            pass

    # ── ask() — RAG soru-cevap ────────────────────────────────────

    async def ask(self, query: str, search_request: SearchRequest | None = None) -> RAGResponse:
        """
        RAG soru-cevap. LLM GEREKTIRIR.
        Ara -> Context olustur -> LLM -> Dogrula.
        """
        if not self.llm_available:
            # LLM yoksa sadece arama sonuclarini don
            if search_request is None:
                search_request = SearchRequest(query=query)
            search_response = await self.search(search_request)

            return RAGResponse(
                answer="LLM yapilandirilmamis. Arama sonuclari asagida listelenmistir. "
                       "ANTHROPIC_API_KEY ayarlandiginda AI destekli yanitlar uretilecektir.",
                sources=search_response.sonuclar,
                confidence_score=0.0,
                warning="ANTHROPIC_API_KEY tanimli degil. Sadece arama sonuclari gosteriliyor.",
            )

        start = time.monotonic()

        # 1. Arama
        if search_request is None:
            search_request = SearchRequest(query=query)
        search_response = await self.search(search_request)

        # 2. Context olustur
        context = self._build_context(search_response.sonuclar)

        if not context.strip():
            return RAGResponse(
                answer="Bu konuda kaynaklarimda yeterli bilgi bulunamadi. "
                       "Lutfen aramanizi farkli terimlerle tekrar deneyin.",
                sources=[],
                confidence_score=0.0,
                warning="Yeterli kaynak bulunamadi.",
            )

        # 3. LLM'den yanit uret
        answer = await self.llm.generate(query=query, context=context)

        # 3b. Post-generation citation re-verification against provided context
        context_sources = [
            {
                "esas_no": s.esas_no or "",
                "karar_no": s.karar_no or "",
                "content": s.ozet or "",
                "ozet": s.ozet or "",
            }
            for s in search_response.sonuclar
        ]
        post_verification = self._verify_response_citations(answer, context_sources)
        if post_verification["unverified"]:
            logger.warning(
                "rag_unverified_citations",
                count=len(post_verification["unverified"]),
                unverified=post_verification["unverified"],
            )
            answer += "\n\n\u26a0\ufe0f Dikkat: Yanittta dogrulanamayan atiflar tespit edildi. Lutfen kontrol ediniz."

        # 4. Citation verification
        verification = await self.verifier.verify_all(answer)

        # 5. Confidence score — weight by actual relevance scores, not just count
        if search_response.sonuclar:
            avg_relevance = sum(r.relevance_score for r in search_response.sonuclar) / len(search_response.sonuclar)
            count_factor = min(len(search_response.sonuclar) / 3, 1.0)  # 3 good results is enough
            source_confidence = avg_relevance * 0.6 + count_factor * 0.4
        else:
            source_confidence = 0.0
        citation_confidence = verification.overall_confidence
        confidence = (source_confidence * 0.4) + (citation_confidence * 0.6)

        # Reduce confidence if post-verification found issues
        if post_verification["unverified"]:
            penalty = len(post_verification["unverified"]) * 0.1
            confidence = max(0.0, confidence - penalty)

        # 6. Uyari
        warning = None
        if confidence < 0.5:
            warning = "Bu yanitin guvenilirligi dusuktur. Bagimsiz arastirma yapmaniz onerilir."
        elif verification.not_found > 0:
            warning = f"{verification.not_found} referans dogrulanamadi. Manuel kontrol onerilir."

        return RAGResponse(
            answer=answer,
            sources=search_response.sonuclar,
            verification=verification,
            confidence_score=round(confidence, 2),
            warning=warning,
            post_citation_check=post_verification,
        )

    def _build_context(self, results: list[IctihatResult], max_chars: int = 600_000) -> str:
        """
        Arama sonuclarindan LLM context'i olustur.

        Turkish text averages ~3.5 chars per token (more compact than English).
        Claude Sonnet 4 has 200K context. Reserve 20K for system prompt + query + response.
        That gives us ~180K tokens = ~630,000 chars for context.
        max_chars=600_000 (~170K tokens) provides a safe margin.
        """
        context_parts = []
        total_len = 0

        for i, r in enumerate(results, 1):
            part = f"""--- Kaynak {i} ---
Mahkeme: {r.mahkeme}
{f'Daire: {r.daire}' if r.daire else ''}
{f'Esas No: {r.esas_no}' if r.esas_no else ''}
{f'Karar No: {r.karar_no}' if r.karar_no else ''}
{f'Tarih: {r.tarih}' if r.tarih else ''}
Ozet: {r.ozet}
{f'Tam Metin: {r.tam_metin[:3000]}' if r.tam_metin else ''}
"""
            if total_len + len(part) > max_chars:
                break
            context_parts.append(part)
            total_len += len(part)

        return "\n".join(context_parts)

    def _verify_response_citations(self, response_text: str, context_sources: list[dict]) -> dict:
        """Post-generation: verify that every citation in the response exists in the provided context."""
        # Extract citations from response
        citation_patterns = [
            r'(\d+)\.\s*(?:Hukuk|Ceza)\s*Dairesi.*?(\d{4}/\d+)\s*E\.',  # Yargitay
            r'Yargitay.*?(\d{4}/\d+)\s*E\.\s*,?\s*(\d{4}/\d+)\s*K\.',
            r'(\d{4}/\d+)\s*E\.\s*,?\s*(\d{4}/\d+)\s*K\.',
            r'AYM.*?(\d{4}/\d+)',
        ]

        found_citations = []
        for pattern in citation_patterns:
            matches = re.findall(pattern, response_text)
            found_citations.extend(matches)

        if not found_citations:
            return {"verified": True, "citations_found": 0, "unverified": [], "verified_count": 0}

        # Build set of known citations from context
        known_citations = set()
        for source in context_sources:
            esas = source.get("esas_no", "")
            karar = source.get("karar_no", "")
            if esas:
                known_citations.add(esas.strip())
            if karar:
                known_citations.add(karar.strip())
            # Also add from content text
            content = source.get("content", "") or source.get("ozet", "")
            for pattern in citation_patterns:
                for match in re.findall(pattern, content):
                    if isinstance(match, tuple):
                        known_citations.update(m.strip() for m in match if m)
                    else:
                        known_citations.add(match.strip())

        # Check each found citation
        unverified = []
        for citation in found_citations:
            citation_str = citation if isinstance(citation, str) else "/".join(citation)
            if not any(citation_str.strip() in kc for kc in known_citations):
                unverified.append(citation_str)

        return {
            "verified": len(unverified) == 0,
            "citations_found": len(found_citations),
            "unverified": unverified,
            "verified_count": len(found_citations) - len(unverified),
        }

    def _merge_results(
        self,
        api_results: list[dict],
        vector_results: list[dict],
        max_results: int,
    ) -> list[IctihatResult]:
        """API ve vector search sonuclarini birlestir."""
        seen_ids = set()
        merged = []

        for r in api_results:
            kid = r.get("karar_id", "")
            if kid and kid not in seen_ids:
                seen_ids.add(kid)
                merged.append(
                    IctihatResult(
                        karar_id=kid,
                        mahkeme=r.get("mahkeme", ""),
                        daire=r.get("daire"),
                        esas_no=r.get("esas_no"),
                        karar_no=r.get("karar_no"),
                        tarih=r.get("tarih"),
                        ozet=r.get("ozet", ""),
                        tam_metin=r.get("tam_metin"),
                        relevance_score=r.get("relevance", 0.5),
                    )
                )

        for r in vector_results:
            payload = r.get("payload", {})
            kid = str(r.get("id", ""))
            if kid not in seen_ids:
                seen_ids.add(kid)
                merged.append(
                    IctihatResult(
                        karar_id=kid,
                        mahkeme=payload.get("mahkeme", ""),
                        daire=payload.get("daire"),
                        esas_no=payload.get("esas_no"),
                        karar_no=payload.get("karar_no"),
                        tarih=payload.get("tarih"),
                        ozet=payload.get("ozet", ""),
                        relevance_score=r.get("score", 0.3),
                    )
                )

        merged.sort(key=lambda x: x.relevance_score, reverse=True)
        return merged[:max_results]
