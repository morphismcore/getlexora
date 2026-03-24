"""
Hukuk metni chunking stratejisi.
Karar, mevzuat ve makale türlerine göre özelleşmiş chunking.
"""

import re
import structlog

logger = structlog.get_logger()


class LegalChunker:
    """Hukuk metni türüne göre özelleşmiş chunking."""

    def __init__(self, max_chunk_tokens: int = 512, overlap_tokens: int = 64):
        self.max_chunk_chars = max_chunk_tokens * 4  # Türkçe ortalama 4 char/token
        self.overlap_chars = overlap_tokens * 4

    def chunk_karar(self, karar_metni: str, metadata: dict) -> list[dict]:
        """
        Yargıtay/Danıştay kararı chunking.
        Bölüm tespiti yapar: taraflar, olaylar, değerlendirme, sonuç.
        """
        if not karar_metni or len(karar_metni.strip()) < 50:
            return []

        sections = self._detect_karar_sections(karar_metni)

        chunks = []
        for section_type, section_text in sections:
            if len(section_text) > self.max_chunk_chars:
                sub_chunks = self._split_by_paragraph(section_text)
                for i, sc in enumerate(sub_chunks):
                    chunks.append({
                        "text": sc,
                        "metadata": {
                            **metadata,
                            "section_type": section_type,
                            "chunk_index": i,
                        },
                    })
            else:
                chunks.append({
                    "text": section_text,
                    "metadata": {
                        **metadata,
                        "section_type": section_type,
                        "chunk_index": 0,
                    },
                })

        return chunks

    def chunk_mevzuat(self, kanun_metni: str, metadata: dict) -> list[dict]:
        """
        Kanun/yönetmelik chunking — madde bazlı.
        Her madde bir chunk, uzun maddeler fıkra bazlı bölünür.
        """
        maddeler = re.split(r"(?=(?:MADDE|Madde)\s+\d+)", kanun_metni)

        chunks = []
        for madde in maddeler:
            madde = madde.strip()
            if not madde or len(madde) < 20:
                continue

            # Madde numarasını çıkar
            madde_match = re.match(r"(?:MADDE|Madde)\s+(\d+)", madde)
            madde_no = madde_match.group(1) if madde_match else None

            if len(madde) > self.max_chunk_chars:
                # Fıkra bazlı böl
                fikralar = re.split(r"\n\s*\((\d+)\)", madde)
                for i in range(0, len(fikralar), 2):
                    fikra_text = fikralar[i].strip()
                    if fikra_text:
                        chunks.append({
                            "text": fikra_text,
                            "metadata": {
                                **metadata,
                                "madde_no": madde_no,
                                "fikra_index": i // 2,
                            },
                        })
            else:
                chunks.append({
                    "text": madde,
                    "metadata": {
                        **metadata,
                        "madde_no": madde_no,
                    },
                })

        return chunks

    def chunk_generic(self, text: str, metadata: dict) -> list[dict]:
        """Genel metin chunking — paragraf bazlı, overlap ile."""
        paragraphs = text.split("\n\n")
        chunks = []
        current = ""

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            if len(current) + len(para) + 2 > self.max_chunk_chars:
                if current:
                    chunks.append({
                        "text": current,
                        "metadata": {**metadata, "chunk_index": len(chunks)},
                    })
                    # Overlap: son paragrafın bir kısmını tut
                    overlap = current[-self.overlap_chars:] if len(current) > self.overlap_chars else ""
                    current = overlap + "\n\n" + para if overlap else para
                else:
                    # Tek paragraf çok uzun → zorla böl
                    for i in range(0, len(para), self.max_chunk_chars - self.overlap_chars):
                        chunk_text = para[i:i + self.max_chunk_chars]
                        chunks.append({
                            "text": chunk_text,
                            "metadata": {**metadata, "chunk_index": len(chunks)},
                        })
                    current = ""
            else:
                current = current + "\n\n" + para if current else para

        if current.strip():
            chunks.append({
                "text": current,
                "metadata": {**metadata, "chunk_index": len(chunks)},
            })

        return chunks

    def _detect_karar_sections(self, text: str) -> list[tuple[str, str]]:
        """Karar metnindeki bölümleri tespit et — case-insensitive, tüm eşleşmeler."""
        section_patterns = [
            (r"(?:Davacı|DAVACI|Şüpheli|SANIK|Başvurucu)", "taraflar"),
            (r"(?:OLAY|Dava\s+konusu|Olaylar)", "olaylar"),
            (r"(?:İLK\s+DERECE|İlk\s+derece|Yerel\s+mahkeme)", "ilk_derece"),
            (r"(?:TEMYİZ|İSTİNAF|Temyiz\s+nedenleri|İstinaf\s+nedenleri)", "temyiz_nedenleri"),
            (r"(?:DEĞERLENDİRME|Değerlendirme|GEREKÇE|Gerekçe|İNCELEME)", "degerlendirme"),
            (r"(?:SONUÇ|HÜKÜM|Sonuç|Hüküm|KARAR)", "sonuc"),
        ]

        # Tüm eşleşmeleri bul (case-insensitive)
        positions = []
        seen_types = set()
        for pattern, section_type in section_patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                # Her bölüm türünden sadece ilkini al (duplikat başlıkları atla)
                if section_type not in seen_types:
                    positions.append((match.start(), section_type))
                    seen_types.add(section_type)

        positions.sort(key=lambda x: x[0])

        if not positions:
            # Bölüm tespit edilemedi → paragraf bazlı bölme
            if len(text) > 2000:
                paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
                if len(paragraphs) > 1:
                    return [(f"bolum_{i}", p) for i, p in enumerate(paragraphs)]
            return [("tam_metin", text)]

        sections = []

        # İlk bölümden önceki kısım
        if positions[0][0] > 100:
            sections.append(("baslik", text[:positions[0][0]].strip()))

        # Bölümleri ayır
        for i, (pos, section_type) in enumerate(positions):
            end = positions[i + 1][0] if i + 1 < len(positions) else len(text)
            section_text = text[pos:end].strip()
            if len(section_text) > 50:
                sections.append((section_type, section_text))

        return sections if sections else [("tam_metin", text)]

    def _split_by_paragraph(self, text: str) -> list[str]:
        """Uzun metni paragraf sınırlarında böl."""
        paragraphs = text.split("\n\n")
        chunks = []
        current = ""

        for para in paragraphs:
            if len(current) + len(para) > self.max_chunk_chars:
                if current:
                    chunks.append(current.strip())
                current = para
            else:
                current = current + "\n\n" + para if current else para

        if current.strip():
            chunks.append(current.strip())

        # Overlap: önceki chunk'ın son kısmını sonraki chunk'a ekle
        if len(chunks) > 1:
            overlapped = [chunks[0]]
            for i in range(1, len(chunks)):
                prev_tail = chunks[i - 1][-150:]  # last 150 chars of previous
                overlap_text = "..." + prev_tail + "\n" + chunks[i]
                overlapped.append(overlap_text)
            chunks = overlapped

        return chunks
