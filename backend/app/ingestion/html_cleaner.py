"""
Birleştirilmiş HTML temizleme.
Tüm ingestion method'ları bu modülü kullanır.
"""

import re


def clean_legal_html(html: str) -> str:
    """
    HTML içeriği temiz metin'e dönüştür.
    Paragraf yapısını korur (br, p, div → newline).
    """
    if not html:
        return ""

    text = html

    # 1. Yapısal tag'leri newline'a çevir
    text = re.sub(r"<(?:br|BR)\s*/?>", "\n", text)
    text = re.sub(r"<(?:p|P|div|DIV)[^>]*>", "\n", text)
    text = re.sub(r"</(?:p|P|div|DIV)>", "\n", text)

    # 2. Kalan HTML tag'lerini boşluğa çevir
    text = re.sub(r"<[^>]+>", " ", text)

    # 3. HTML entity'leri decode et
    text = text.replace("&nbsp;", " ")
    text = text.replace("&amp;", "&")
    text = text.replace("&lt;", "<")
    text = text.replace("&gt;", ">")
    text = text.replace("&quot;", '"')
    text = text.replace("&apos;", "'")
    text = re.sub(r"&#\d+;", " ", text)
    text = re.sub(r"&\w+;", " ", text)

    # 4. Whitespace normalize (yapı korunarak)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text)

    return text.strip()
