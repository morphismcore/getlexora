"""
Claude API entegrasyonu.
Hukuki analiz, özetleme ve dilekçe üretimi için LLM çağrıları.
"""

import anthropic
import structlog
from typing import AsyncIterator

from app.config import get_settings

logger = structlog.get_logger()

SYSTEM_PROMPT = """Sen Lexora hukuk araştırma asistanısın. Türk avukatlarına yardımcı olursun.

MUTLAK KURALLAR:
1. ASLA uydurma içtihat numarası verme. Bir karar numarası yazıyorsan, bu numara sana verilen context'te AYNEN bulunmalıdır.
2. Context'te olmayan bir karardan bahsetme. "Bildiğim kadarıyla" diye başlayan içtihat referansları YASAKTIR.
3. Bir bilgiyi bilmiyorsan "Bu konuda elimdeki kaynaklarda bilgi bulunamadı" de.
4. Mevzuat madde metni veriyorsan, context'teki tam metni kullan, kendi hafızandan madde metni yazma.
5. Her zaman kaynağını belirt: hangi karara, hangi maddeye dayanıyorsun.

ROLÜN:
- Avukatın işini desteklersin, onun yerine karar vermezsin.
- Araştırma, analiz ve taslak üretirsin.
- Nihai hukuki değerlendirme ve karar sorumluluğu her zaman avukata aittir.

YANITLARIN:
- Türkçe ve profesyonel hukuk dili kullan.
- Referansları açıkça belirt.
- Emin olmadığın noktaları belirt, spekülasyon yapma."""


class LLMService:
    """Claude API üzerinden LLM çağrıları."""

    def __init__(self):
        settings = get_settings()
        self.client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        self.model = "claude-sonnet-4-20250514"

    async def generate(
        self,
        query: str,
        context: str,
        system: str | None = None,
        max_tokens: int = 4096,
        temperature: float = 0.1,
    ) -> str:
        """Context ile birlikte LLM'den yanıt üret."""
        message = await self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system or SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": f"""İlgili kaynaklar:

{context}

---

Avukatın sorusu: {query}

Yukarıdaki kaynaklara dayanarak yanıtla. Sadece kaynaklarda bulunan bilgileri kullan. Kaynaklarda bulunmayan bilgi için "Bu konuda kaynaklarımda bilgi bulunamadı" de.""",
                }
            ],
        )

        return message.content[0].text

    async def generate_stream(
        self,
        query: str,
        context: str,
        system: str | None = None,
        max_tokens: int = 4096,
        temperature: float = 0.1,
    ) -> AsyncIterator[str]:
        """Streaming yanıt üret."""
        async with self.client.messages.stream(
            model=self.model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system or SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": f"""İlgili kaynaklar:

{context}

---

Avukatın sorusu: {query}

Yukarıdaki kaynaklara dayanarak yanıtla. Sadece kaynaklarda bulunan bilgileri kullan.""",
                }
            ],
        ) as stream:
            async for text in stream.text_stream:
                yield text

    async def analyze_for_search(self, query: str) -> dict:
        """
        Kullanıcı sorgusunu analiz et: hukuk alanı, anahtar kelimeler, mahkeme filtresi çıkar.
        Intent classification + query expansion.
        """
        message = await self.client.messages.create(
            model=self.model,
            max_tokens=512,
            temperature=0.0,
            messages=[
                {
                    "role": "user",
                    "content": f"""Aşağıdaki hukuki soruyu analiz et ve JSON formatında yanıtla.

Soru: {query}

JSON formatı:
{{
  "anahtar_kelimeler": ["kelime1", "kelime2"],
  "hukuk_alani": "is_hukuku|ceza_hukuku|ticaret_hukuku|idare_hukuku|aile_hukuku|genel",
  "mahkeme_filtre": ["yargitay_hukuk", "yargitay_ceza", "danistay"] veya null,
  "daire": "9" veya null,
  "arama_sorgusu": "Bedesten API için optimize edilmiş arama terimi",
  "ilgili_kanunlar": ["4857", "6098"] veya []
}}

Sadece JSON döndür, başka açıklama ekleme.""",
                }
            ],
        )

        import json

        try:
            text = message.content[0].text.strip()
            # JSON bloğunu çıkar (```json ... ``` olabilir)
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            return json.loads(text)
        except (json.JSONDecodeError, IndexError):
            logger.warning("query_analysis_parse_error", raw=message.content[0].text)
            return {
                "anahtar_kelimeler": query.split()[:5],
                "hukuk_alani": "genel",
                "mahkeme_filtre": None,
                "daire": None,
                "arama_sorgusu": query,
                "ilgili_kanunlar": [],
            }
