"""
Citation Verification Pipeline.
LLM çıktısındaki her içtihat ve mevzuat referansını otomatik doğrular.
"""

import re
import asyncio
import hashlib
import time
import structlog

from app.models.schemas import (
    CitationRef,
    CitationVerification,
    VerificationReport,
    VerificationStatus,
)
from app.services.yargi import YargiService
from app.services.mevzuat import MevzuatService

logger = structlog.get_logger()

# Türk hukuk referansı regex kalıpları
PATTERNS = {
    "yargitay": re.compile(
        r"Yargıtay\s+(\d+)\.\s*(HD|CD|HGK|CGK|İBK|İBHGK|İBCGK)\s+"
        r"(\d{4})/(\d+)\s*E\.?\s*,?\s*(\d{4})/(\d+)\s*K\.?",
        re.IGNORECASE,
    ),
    "danistay": re.compile(
        r"Danıştay\s+(\d+)\.\s*(D|Daire|İDDK|VDDK)\s+"
        r"(\d{4})/(\d+)\s*E\.?\s*,?\s*(\d{4})/(\d+)\s*K\.?",
        re.IGNORECASE,
    ),
    "aym_norm": re.compile(
        r"AYM\s+(\d{4})/(\d+)\s*E\.?\s*,?\s*(\d{4})/(\d+)\s*K\.?",
        re.IGNORECASE,
    ),
    "aym_bireysel": re.compile(
        r"(?:AYM|Anayasa\s+Mahkemesi)\s+(?:Bireysel\s+Başvuru\s+)?(?:No\.?\s*:?\s*)?(\d{4}/\d+)",
        re.IGNORECASE,
    ),
    "kanun_sayili": re.compile(
        r"(\d{3,5})\s*sayılı\s+(?:Kanun|KHK|Yasa)",
        re.IGNORECASE,
    ),
    "kanun_madde": re.compile(
        r"(?:TCK|TBK|TMK|CMK|HMK|İYUK|İK|TTK|4857|5237|6098|6100|6102)\s*"
        r"(?:m(?:d)?\.?\s*|madde\s+)(\d+)(?:/(\d+))?",
        re.IGNORECASE,
    ),
}


class CitationVerifierService:
    """LLM çıktısındaki referansları doğrular."""

    def __init__(self, yargi: YargiService, mevzuat: MevzuatService, cache=None):
        self.yargi = yargi
        self.mevzuat = mevzuat
        self.cache = cache

    def extract_citations(self, text: str) -> list[CitationRef]:
        """Metinden tüm hukuki referansları çıkar."""
        citations = []

        # Yargıtay kararları
        for m in PATTERNS["yargitay"].finditer(text):
            citations.append(
                CitationRef(
                    raw_text=m.group(0),
                    citation_type="ictihat",
                    mahkeme=f"Yargıtay {m.group(1)}. {m.group(2)}",
                    esas_no=f"{m.group(3)}/{m.group(4)}",
                    karar_no=f"{m.group(5)}/{m.group(6)}",
                )
            )

        # Danıştay kararları
        for m in PATTERNS["danistay"].finditer(text):
            citations.append(
                CitationRef(
                    raw_text=m.group(0),
                    citation_type="ictihat",
                    mahkeme=f"Danıştay {m.group(1)}. {m.group(2)}",
                    esas_no=f"{m.group(3)}/{m.group(4)}",
                    karar_no=f"{m.group(5)}/{m.group(6)}",
                )
            )

        # AYM norm denetimi
        for m in PATTERNS["aym_norm"].finditer(text):
            citations.append(
                CitationRef(
                    raw_text=m.group(0),
                    citation_type="ictihat",
                    mahkeme="Anayasa Mahkemesi",
                    esas_no=f"{m.group(1)}/{m.group(2)}",
                    karar_no=f"{m.group(3)}/{m.group(4)}",
                )
            )

        # AYM bireysel başvuru
        for m in PATTERNS["aym_bireysel"].finditer(text):
            # aym_norm ile çakışmayı önle
            if not any(c.raw_text in m.group(0) or m.group(0) in c.raw_text for c in citations):
                citations.append(
                    CitationRef(
                        raw_text=m.group(0),
                        citation_type="ictihat",
                        mahkeme="AYM Bireysel Başvuru",
                        esas_no=m.group(1),
                    )
                )

        # Kanun numarası
        for m in PATTERNS["kanun_sayili"].finditer(text):
            citations.append(
                CitationRef(
                    raw_text=m.group(0),
                    citation_type="mevzuat",
                    kanun_no=m.group(1),
                )
            )

        # Kanun madde referansı
        for m in PATTERNS["kanun_madde"].finditer(text):
            citations.append(
                CitationRef(
                    raw_text=m.group(0),
                    citation_type="mevzuat",
                    madde_no=m.group(1),
                )
            )

        # Deduplicate (aynı raw_text'i tekrar ekleme)
        seen = set()
        unique = []
        for c in citations:
            if c.raw_text not in seen:
                seen.add(c.raw_text)
                unique.append(c)

        return unique

    async def verify_all(self, text: str) -> VerificationReport:
        """Metindeki tüm referansları paralel olarak doğrula."""
        citations = self.extract_citations(text)

        if not citations:
            return VerificationReport(
                total_citations=0,
                verified=0,
                not_found=0,
                partial_match=0,
                details=[],
                overall_confidence=1.0,
            )

        # Paralel doğrulama
        tasks = [self._verify_single(c) for c in citations]
        results = await asyncio.gather(*tasks)

        verified = sum(1 for r in results if r.status == VerificationStatus.VERIFIED)
        not_found = sum(1 for r in results if r.status == VerificationStatus.NOT_FOUND)
        partial = sum(1 for r in results if r.status == VerificationStatus.PARTIAL_MATCH)

        total = len(results)
        confidence = verified / total if total > 0 else 0.0

        return VerificationReport(
            total_citations=total,
            verified=verified,
            not_found=not_found,
            partial_match=partial,
            details=results,
            overall_confidence=confidence,
        )

    async def _verify_single(self, citation: CitationRef) -> CitationVerification:
        """Tek bir referansı doğrula."""
        start = time.monotonic()

        # Check cache first
        citation_hash = hashlib.md5(citation.raw_text.encode()).hexdigest()
        if self.cache:
            try:
                cached = await self.cache.get_cached_verification(citation_hash)
                if cached is not None:
                    logger.debug("verification_cache_hit", citation=citation.raw_text)
                    return CitationVerification(
                        reference=citation,
                        status=VerificationStatus(cached["status"]),
                        found_match=cached.get("found_match"),
                        suggestion=cached.get("suggestion"),
                        verification_ms=0,
                    )
            except Exception:
                pass

        verification = None
        try:
            if citation.citation_type == "ictihat":
                result = await self.yargi.verify_citation(
                    mahkeme=citation.mahkeme,
                    daire=None,
                    esas_no=citation.esas_no,
                    karar_no=citation.karar_no,
                )

                elapsed = int((time.monotonic() - start) * 1000)

                if result.get("verified"):
                    verification = CitationVerification(
                        reference=citation,
                        status=VerificationStatus.VERIFIED,
                        found_match=str(result.get("match", {}).get("karar_id", "")),
                        verification_ms=elapsed,
                    )
                elif result.get("partial_matches"):
                    verification = CitationVerification(
                        reference=citation,
                        status=VerificationStatus.PARTIAL_MATCH,
                        suggestion=f"Yakın eşleşme: {result['partial_matches'][0].get('esas_no', '')}",
                        verification_ms=elapsed,
                    )
                else:
                    verification = CitationVerification(
                        reference=citation,
                        status=VerificationStatus.NOT_FOUND,
                        suggestion=result.get("reason", ""),
                        verification_ms=elapsed,
                    )

            elif citation.citation_type == "mevzuat":
                result = await self.mevzuat.verify_madde(
                    kanun_no=citation.kanun_no,
                    madde_no=citation.madde_no,
                )

                elapsed = int((time.monotonic() - start) * 1000)

                if result.get("verified"):
                    verification = CitationVerification(
                        reference=citation,
                        status=VerificationStatus.VERIFIED,
                        found_match=result.get("kanun", ""),
                        verification_ms=elapsed,
                    )
                else:
                    verification = CitationVerification(
                        reference=citation,
                        status=VerificationStatus.NOT_FOUND,
                        suggestion=result.get("reason", ""),
                        verification_ms=elapsed,
                    )

        except Exception as e:
            elapsed = int((time.monotonic() - start) * 1000)
            logger.error("verify_single_error", error=str(e), citation=citation.raw_text)
            return CitationVerification(
                reference=citation,
                status=VerificationStatus.UNVERIFIED,
                suggestion=f"Doğrulama hatası: {str(e)}",
                verification_ms=elapsed,
            )

        if verification is None:
            elapsed = int((time.monotonic() - start) * 1000)
            verification = CitationVerification(
                reference=citation,
                status=VerificationStatus.UNVERIFIED,
                verification_ms=elapsed,
            )

        # Cache the verification result (TTL: 24 hours)
        if self.cache and verification.status != VerificationStatus.UNVERIFIED:
            try:
                await self.cache.cache_verification(
                    citation_hash,
                    {
                        "status": verification.status.value,
                        "found_match": verification.found_match,
                        "suggestion": verification.suggestion,
                    },
                    ttl=86400,
                )
            except Exception:
                pass

        return verification
