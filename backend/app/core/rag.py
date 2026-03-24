"""
RAG (Retrieval-Augmented Generation) Pipeline.
Arama: LLM olmadan çalışır (Bedesten API + Vector DB).
Soru-cevap: LLM gerektirir (opsiyonel).
"""

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
    search() → LLM gerektirmez, doğrudan Bedesten API + Vector DB.
    ask() → LLM gerektirir (Claude API).
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
    ):
        self.yargi = yargi
        self.mevzuat = mevzuat
        self.vector_store = vector_store
        self.embedding = embedding
        self.verifier = verifier
        self.llm = llm
        self.query_expander = query_expander
        self.reranker = reranker
        self.settings = get_settings()

    @property
    def llm_available(self) -> bool:
        return self.llm is not None and bool(self.settings.anthropic_api_key)

    async def search(self, request: SearchRequest) -> SearchResponse:
        """
        İçtihat arama. LLM GEREKTIRMEZ.
        1. Query expansion (kısaltma açma + eş anlamlı)
        2. Bedesten API'de keyword arama
        3. Vector DB'de semantic search (varsa)
        4. Sonuçları birleştir
        5. Cross-encoder reranking (etkinse)
        """
        start = time.monotonic()

        # 0. Query expansion
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

        # 1. Bedesten API'de doğrudan arama (genişletilmiş sorgu ile)
        api_results = await self.yargi.search_unified(
            keyword=search_query,
            court_types=court_types,
            daire=daire,
            max_results=request.max_sonuc,
        )

        # 1b. Eş anlamlı terimlerle ek arama (varsa, ilk 2 synonym)
        if expansion_info and expansion_info["synonyms"]:
            for syn_query in expansion_info["expanded_queries"][1:3]:
                try:
                    syn_results = await self.yargi.search_unified(
                        keyword=syn_query,
                        court_types=court_types,
                        daire=daire,
                        max_results=5,
                    )
                    api_results.extend(syn_results)
                except Exception:
                    pass

        # 2. Vector DB'de semantic search (koleksiyon doluysa)
        vector_results = []
        try:
            info = await self.vector_store.get_collection_info(
                self.settings.qdrant_collection_ictihat
            )
            if info["points_count"] > 0:
                query_embedding = self.embedding.embed_query(request.query)
                filters = {}
                if request.hukuk_alani:
                    filters["hukuk_alani"] = request.hukuk_alani.value

                vector_results = await self.vector_store.search_hybrid(
                    collection=self.settings.qdrant_collection_ictihat,
                    dense_vector=query_embedding["dense_vector"],
                    sparse_vector=query_embedding.get("sparse_vector"),
                    filters=filters if filters else None,
                    limit=request.max_sonuc,
                )
        except Exception as e:
            logger.warning("vector_search_skip", error=str(e))

        # 3. Sonuçları birleştir
        results = self._merge_results(api_results, vector_results, request.max_sonuc)

        # 4. Cross-encoder reranking
        if self.reranker and self.settings.reranking_enabled and len(results) > 1:
            try:
                results = self.reranker.rerank_ictihat(
                    query=request.query,
                    results=results,
                    top_k=self.settings.rag_rerank_top_k or request.max_sonuc,
                )
                logger.debug(
                    "reranking_applied",
                    query=request.query[:50],
                    result_count=len(results),
                )
            except Exception as e:
                logger.warning("reranking_skip", error=str(e))

        elapsed = int((time.monotonic() - start) * 1000)

        return SearchResponse(
            sonuclar=results,
            toplam_bulunan=len(results),
            sure_ms=elapsed,
            query_kullanilan=request.query,
        )

    async def ask(self, query: str, search_request: SearchRequest | None = None) -> RAGResponse:
        """
        RAG soru-cevap. LLM GEREKTİRİR.
        Ara → Context oluştur → LLM → Doğrula.
        """
        if not self.llm_available:
            # LLM yoksa sadece arama sonuçlarını dön
            if search_request is None:
                search_request = SearchRequest(query=query)
            search_response = await self.search(search_request)

            return RAGResponse(
                answer="LLM yapılandırılmamış. Arama sonuçları aşağıda listelenmiştir. "
                       "ANTHROPIC_API_KEY ayarlandığında AI destekli yanıtlar üretilecektir.",
                sources=search_response.sonuclar,
                confidence_score=0.0,
                warning="ANTHROPIC_API_KEY tanımlı değil. Sadece arama sonuçları gösteriliyor.",
            )

        start = time.monotonic()

        # 1. Arama
        if search_request is None:
            search_request = SearchRequest(query=query)
        search_response = await self.search(search_request)

        # 2. Context oluştur
        context = self._build_context(search_response.sonuclar)

        if not context.strip():
            return RAGResponse(
                answer="Bu konuda kaynaklarımda yeterli bilgi bulunamadı. "
                       "Lütfen aramanızı farklı terimlerle tekrar deneyin.",
                sources=[],
                confidence_score=0.0,
                warning="Yeterli kaynak bulunamadı.",
            )

        # 3. LLM'den yanıt üret
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
            answer += "\n\n⚠️ Dikkat: Yanıtta doğrulanamayan atıflar tespit edildi. Lütfen kontrol ediniz."

        # 4. Citation verification
        verification = await self.verifier.verify_all(answer)

        # 5. Confidence score
        source_confidence = min(len(search_response.sonuclar) / 5, 1.0)
        citation_confidence = verification.overall_confidence
        confidence = (source_confidence * 0.4) + (citation_confidence * 0.6)

        # Reduce confidence if post-verification found issues
        if post_verification["unverified"]:
            penalty = len(post_verification["unverified"]) * 0.1
            confidence = max(0.0, confidence - penalty)

        # 6. Uyarı
        warning = None
        if confidence < 0.5:
            warning = "Bu yanıtın güvenilirliği düşüktür. Bağımsız araştırma yapmanız önerilir."
        elif verification.not_found > 0:
            warning = f"{verification.not_found} referans doğrulanamadı. Manuel kontrol önerilir."

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
        Arama sonuçlarından LLM context'i oluştur.

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
Özet: {r.ozet}
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
            r'(\d+)\.\s*(?:Hukuk|Ceza)\s*Dairesi.*?(\d{4}/\d+)\s*E\.',  # Yargıtay
            r'Yargıtay.*?(\d{4}/\d+)\s*E\.\s*,?\s*(\d{4}/\d+)\s*K\.',
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
        """API ve vector search sonuçlarını birleştir."""
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
