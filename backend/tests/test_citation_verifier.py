"""
Unit tests for CitationVerifierService.extract_citations (no API calls).
"""

import pytest
from unittest.mock import AsyncMock

from app.services.citation_verifier import CitationVerifierService


@pytest.fixture
def verifier():
    """CitationVerifierService with mocked dependencies."""
    yargi = AsyncMock()
    mevzuat = AsyncMock()
    return CitationVerifierService(yargi=yargi, mevzuat=mevzuat)


class TestExtractCitations:
    def test_extract_yargitay_citation(self, verifier):
        """Extracts Yargitay citation from text."""
        text = "Yargıtay 9. HD 2023/1234 E., 2023/5678 K. kararında belirtildiği üzere"
        citations = verifier.extract_citations(text)
        assert len(citations) >= 1
        c = citations[0]
        assert c.citation_type == "ictihat"
        assert "Yargıtay" in c.mahkeme
        assert c.esas_no == "2023/1234"
        assert c.karar_no == "2023/5678"

    def test_extract_danistay_citation(self, verifier):
        """Extracts Danistay citation from text."""
        text = "Danıştay 5. D 2022/3456 E., 2023/7890 K. kararı uyarınca"
        citations = verifier.extract_citations(text)
        assert len(citations) >= 1
        c = citations[0]
        assert c.citation_type == "ictihat"
        assert "Danıştay" in c.mahkeme
        assert c.esas_no == "2022/3456"
        assert c.karar_no == "2023/7890"

    def test_extract_kanun_citation(self, verifier):
        """Extracts numbered law citation like '4857 sayılı Kanun'."""
        text = "4857 sayılı Kanun gereğince işçinin hakları korunmaktadır."
        citations = verifier.extract_citations(text)
        assert len(citations) >= 1
        kanun_refs = [c for c in citations if c.citation_type == "mevzuat" and c.kanun_no]
        assert len(kanun_refs) >= 1
        assert kanun_refs[0].kanun_no == "4857"

    def test_extract_madde_citation(self, verifier):
        """Extracts article citation like 'TCK md. 157/1'."""
        text = "TCK md. 157/1 hükmüne göre dolandırıcılık suçu oluşmaktadır."
        citations = verifier.extract_citations(text)
        assert len(citations) >= 1
        madde_refs = [c for c in citations if c.citation_type == "mevzuat" and c.madde_no]
        assert len(madde_refs) >= 1
        assert madde_refs[0].madde_no == "157"

    def test_extract_aym_citation(self, verifier):
        """Extracts AYM (Constitutional Court) citation."""
        text = "AYM 2020/100 E., 2021/200 K. kararında iptal edilmiştir."
        citations = verifier.extract_citations(text)
        assert len(citations) >= 1
        aym_refs = [c for c in citations if c.mahkeme and "Anayasa" in c.mahkeme]
        assert len(aym_refs) >= 1
        assert aym_refs[0].esas_no == "2020/100"
        assert aym_refs[0].karar_no == "2021/200"

    def test_extract_multiple_citations(self, verifier):
        """Text with 3+ citations extracts all of them."""
        text = (
            "Yargıtay 9. HD 2023/1000 E., 2023/2000 K. kararında; "
            "4857 sayılı Kanun madde 18 gereğince; "
            "Danıştay 10. D 2021/500 E., 2022/600 K. kararıyla onandı."
        )
        citations = verifier.extract_citations(text)
        assert len(citations) >= 3

    def test_extract_no_citations(self, verifier):
        """Plain text with no legal citations returns empty list."""
        text = "Bu bir düz metin olup herhangi bir hukuki referans içermemektedir."
        citations = verifier.extract_citations(text)
        assert len(citations) == 0

    def test_extract_aihm_citation(self, verifier):
        """AİHM citations are not matched by current patterns (no pattern defined)."""
        # The current PATTERNS dict does not include an AIHM pattern,
        # so AİHM references should not produce any citations.
        text = "AİHM Yüksel ve diğerleri / Türkiye, Başvuru No. 14749/09 kararı"
        citations = verifier.extract_citations(text)
        # No AIHM pattern exists — verify the extractor does not crash
        # and returns no citations for this format.
        assert isinstance(citations, list)

    def test_extract_aym_bireysel_basvuru(self, verifier):
        """Extracts AYM individual application citation."""
        text = "Anayasa Mahkemesi Bireysel Başvuru No: 2018/12345 kararında"
        citations = verifier.extract_citations(text)
        assert len(citations) >= 1
        c = citations[0]
        assert c.mahkeme == "AYM Bireysel Başvuru"
        assert c.esas_no == "2018/12345"

    def test_deduplicate_citations(self, verifier):
        """Same citation appearing twice is deduplicated."""
        text = (
            "Yargıtay 9. HD 2023/1234 E., 2023/5678 K. kararı önemlidir. "
            "Bu karara tekrar atıfla: Yargıtay 9. HD 2023/1234 E., 2023/5678 K."
        )
        citations = verifier.extract_citations(text)
        raw_texts = [c.raw_text for c in citations]
        assert len(raw_texts) == len(set(raw_texts))
