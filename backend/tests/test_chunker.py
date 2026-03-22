"""
Unit tests for LegalChunker.
"""

import pytest

from app.ingestion.chunker import LegalChunker


@pytest.fixture
def chunker():
    return LegalChunker(max_chunk_tokens=200, overlap_tokens=25)


class TestChunkKarar:
    def test_chunk_karar_basic(self, chunker):
        """Chunks a court decision text by detected sections."""
        text = (
            "DAVACI: Ahmet Yılmaz vekili Av. Mehmet Demir\n\n"
            "OLAY: Davacı, 01.01.2023 tarihinde iş akdinin haksız feshedildiğini ileri sürmüştür. "
            "İşveren tarafından herhangi bir geçerli neden gösterilmemiştir.\n\n"
            "DEĞERLENDİRME: Dosya kapsamındaki deliller incelendiğinde, "
            "feshin haklı bir nedene dayanmadığı anlaşılmaktadır.\n\n"
            "SONUÇ: Davanın kabulüne, işe iadesine karar verildi."
        )
        metadata = {"karar_id": "test-1", "mahkeme": "Yargıtay"}
        chunks = chunker.chunk_karar(text, metadata)
        assert len(chunks) >= 1
        assert all("text" in c and "metadata" in c for c in chunks)
        assert all(c["metadata"]["karar_id"] == "test-1" for c in chunks)

    def test_chunk_karar_empty(self, chunker):
        """Empty or very short text returns empty list."""
        assert chunker.chunk_karar("", {"id": "x"}) == []
        assert chunker.chunk_karar("kısa", {"id": "x"}) == []


class TestChunkMevzuat:
    def test_chunk_mevzuat(self, chunker):
        """Chunks legislation text by article boundaries."""
        text = (
            "Madde 1 - Bu Kanunun amacı, iş ilişkisini düzenlemektir.\n\n"
            "Madde 2 - Bu Kanun, işçi ve işveren arasındaki ilişkilere uygulanır.\n\n"
            "Madde 3 - İşçi, bir iş sözleşmesine dayanarak çalışan gerçek kişidir."
        )
        metadata = {"kanun_no": "4857"}
        chunks = chunker.chunk_mevzuat(text, metadata)
        assert len(chunks) >= 3
        assert all("text" in c and "metadata" in c for c in chunks)
        # Check that madde_no is extracted
        madde_nos = [c["metadata"].get("madde_no") for c in chunks]
        assert "1" in madde_nos
        assert "2" in madde_nos
        assert "3" in madde_nos


class TestChunkGeneric:
    def test_chunk_generic(self, chunker):
        """Chunks generic text with paragraph-based splitting and overlap."""
        paragraphs = ["Bu bir test paragrafıdır. " * 20 for _ in range(5)]
        text = "\n\n".join(paragraphs)
        metadata = {"source": "test"}
        chunks = chunker.chunk_generic(text, metadata)
        assert len(chunks) >= 1
        assert all("text" in c and "metadata" in c for c in chunks)
        # chunk_index should be assigned
        for i, c in enumerate(chunks):
            assert c["metadata"]["chunk_index"] == i

    def test_empty_text(self, chunker):
        """Empty input returns empty list."""
        chunks = chunker.chunk_generic("", {"source": "test"})
        assert chunks == []

    def test_short_text(self, chunker):
        """Text shorter than chunk size returns single chunk."""
        text = "Kısa bir metin."
        chunks = chunker.chunk_generic(text, {"source": "test"})
        assert len(chunks) == 1
        assert chunks[0]["text"] == "Kısa bir metin."
