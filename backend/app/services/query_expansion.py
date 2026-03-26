"""
Türkçe Hukuk Query Expansion Service.
Kısaltmaları açar, eş anlamlı terimleri ekler.
Türkçe karakter normalizasyonu ile fuzzy eşleştirme yapar.
"""

import re
import structlog

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Türkçe Karakter Normalizasyon Tablosu
# ---------------------------------------------------------------------------

_TR_CHAR_MAP = str.maketrans(
    "ıİşŞçÇğĞöÖüÜ",
    "iIsScCgGoOuU",
)


def normalize_turkish(text: str) -> str:
    """Türkçe özel karakterleri ASCII karşılıklarına dönüştürür.

    'iş kazası' -> 'is kazasi', 'İİK' -> 'IIK' vb.
    Eşleştirme (matching) amaçlıdır; orijinal metin korunmalıdır.
    """
    return text.translate(_TR_CHAR_MAP)

# ---------------------------------------------------------------------------
# Türkçe Hukuk Kısaltma Sözlüğü
# ---------------------------------------------------------------------------

ABBREVIATION_MAP: dict[str, str] = {
    # Temel Kanunlar
    "TCK": "Türk Ceza Kanunu",
    "TMK": "Türk Medeni Kanunu",
    "TBK": "Türk Borçlar Kanunu",
    "TTK": "Türk Ticaret Kanunu",
    "HMK": "Hukuk Muhakemeleri Kanunu",
    "CMK": "Ceza Muhakemesi Kanunu",
    "İYUK": "İdari Yargılama Usulü Kanunu",
    "IYUK": "İdari Yargılama Usulü Kanunu",
    "AYM": "Anayasa Mahkemesi",
    "İİK": "İcra ve İflas Kanunu",
    "IIK": "İcra ve İflas Kanunu",
    "TKHK": "Tüketicinin Korunması Hakkında Kanun",
    "SGK": "Sosyal Güvenlik Kurumu",
    "KVKK": "Kişisel Verilerin Korunması Kanunu",
    "FSEK": "Fikir ve Sanat Eserleri Kanunu",
    "KMK": "Kat Mülkiyeti Kanunu",
    "HUMK": "Hukuk Usulü Muhakemeleri Kanunu",
    "BK": "Borçlar Kanunu",
    "MK": "Medeni Kanun",
    "CK": "Ceza Kanunu",
    "AİHM": "Avrupa İnsan Hakları Mahkemesi",
    "AIHM": "Avrupa İnsan Hakları Mahkemesi",
    "AİHS": "Avrupa İnsan Hakları Sözleşmesi",
    "AIHS": "Avrupa İnsan Hakları Sözleşmesi",

    # İş Hukuku
    "İK": "İş Kanunu",
    "IK": "İş Kanunu",
    "SİGK": "Sosyal Sigortalar ve Genel Sağlık Sigortası Kanunu",
    "SIGK": "Sosyal Sigortalar ve Genel Sağlık Sigortası Kanunu",
    "İSG": "İş Sağlığı ve Güvenliği",
    "ISG": "İş Sağlığı ve Güvenliği",
    "STK": "Sendikalar ve Toplu İş Sözleşmesi Kanunu",

    # Mahkemeler / Kurumlar
    "BAM": "Bölge Adliye Mahkemesi",
    "BİM": "Bölge İdare Mahkemesi",
    "BIM": "Bölge İdare Mahkemesi",
    "HSYK": "Hakimler ve Savcılar Kurulu",
    "HSK": "Hakimler ve Savcılar Kurulu",
    "UYAP": "Ulusal Yargı Ağı Projesi",
    "TBMM": "Türkiye Büyük Millet Meclisi",
    "HD": "Hukuk Dairesi",
    "CD": "Ceza Dairesi",
    "HGK": "Hukuk Genel Kurulu",
    "CGK": "Ceza Genel Kurulu",

    # Diğer Önemli Kanunlar
    "KHK": "Kanun Hükmünde Kararname",
    "CBK": "Cumhurbaşkanlığı Kararnamesi",
    "DİK": "Devlet İhale Kanunu",
    "DIK": "Devlet İhale Kanunu",
    "KİK": "Kamu İhale Kanunu",
    "KIK": "Kamu İhale Kanunu",
    "VUK": "Vergi Usul Kanunu",
    "GVK": "Gelir Vergisi Kanunu",
    "KVK": "Katma Değer Vergisi Kanunu",
    "KDV": "Katma Değer Vergisi",
    "ÖTV": "Özel Tüketim Vergisi",
    "MTV": "Motorlu Taşıtlar Vergisi",
    "DMK": "Devlet Memurları Kanunu",
    "YÖK": "Yükseköğretim Kurulu",
}

# ---------------------------------------------------------------------------
# Eş Anlamlı / İlişkili Terimler Sözlüğü
# ---------------------------------------------------------------------------

SYNONYM_MAP: dict[str, list[str]] = {
    # İş Hukuku
    "iş kazası": ["iş güvenliği", "meslek hastalığı", "işçi sağlığı"],
    "kıdem tazminatı": ["kıdem süre hesabı", "işçilik alacağı"],
    "ihbar tazminatı": ["bildirim süresi", "ihbar öneli"],
    "işe iade": ["feshin geçersizliği", "iş güvencesi"],
    "fazla mesai": ["fazla çalışma", "hafta tatili çalışması", "ulusal bayram çalışması"],
    "mobbing": ["psikolojik taciz", "işyerinde bezdiri", "yıldırma"],
    "sendika": ["sendikal faaliyet", "toplu iş sözleşmesi", "sendika hakkı"],
    "fesih": ["sözleşme feshi", "iş akdi feshi", "haksız fesih", "haklı fesih"],

    # Aile Hukuku
    "boşanma": ["evliliğin sona ermesi", "evlilik birliğinin temelinden sarsılması"],
    "nafaka": ["yoksulluk nafakası", "iştirak nafakası", "tedbir nafakası"],
    "velayet": ["çocuk velayeti", "müşterek çocuk", "çocuğun üstün yararı"],
    "mal paylaşımı": ["edinilmiş mallara katılma", "mal rejimi tasfiyesi"],
    "miras": ["tereke", "muris", "miras paylaşımı", "mirasçılık belgesi"],

    # Ceza Hukuku
    "dolandırıcılık": ["nitelikli dolandırıcılık", "hile", "aldatma"],
    "hırsızlık": ["nitelikli hırsızlık", "konut dokunulmazlığı"],
    "yaralama": ["kasten yaralama", "taksirle yaralama", "vücut bütünlüğü"],
    "tehdit": ["şantaj", "cebir", "korkutma"],
    "hakaret": ["onur kırma", "saygınlığı zedeleme", "kişilik hakları"],
    "adam öldürme": ["kasten öldürme", "taksirle öldürme", "insan öldürme"],
    "tutukluluk": ["tutuklama", "adli kontrol", "koruma tedbiri"],

    # Ticaret Hukuku
    "iflas": ["iflasın ertelenmesi", "konkordato", "ödeme güçlüğü"],
    "haksız rekabet": ["rekabet ihlali", "ticari sır"],
    "marka": ["marka ihlali", "marka tescili", "fikri mülkiyet"],

    # İdare Hukuku
    "iptal davası": ["idari işlemin iptali", "yürütmenin durdurulması"],
    "tam yargı davası": ["idari tazminat", "idarenin sorumluluğu"],
    "idari para cezası": ["idari yaptırım", "kabahat"],
    "imar": ["imar planı", "yapı ruhsatı", "imar barışı"],

    # İcra-İflas
    "haciz": ["haciz işlemi", "menkul haczi", "gayrimenkul haczi", "icra takibi"],
    "itirazın iptali": ["itirazın kaldırılması", "icra takibi"],
    "menfi tespit": ["borçlu olmadığının tespiti", "istirdat"],

    # Gayrimenkul / Kira
    "tahliye": ["kiracı tahliyesi", "tahliye taahhüdü"],
    "kira": ["kira sözleşmesi", "tahliye", "kira bedeli"],
    "kira tespit": ["kira bedeli tespiti", "kira artışı"],
    "ipotek": ["rehin", "ipotek tesisi", "taşınmaz rehni"],
    "tapu": ["tapu iptali", "tapu tescili", "taşınmaz"],
    "kamulaştırma": ["istimlak", "bedel tespiti"],

    # Tüketici
    "ayıplı mal": ["ayıplı ürün", "ayıplı hizmet", "tüketici hakkı"],
    "cayma hakkı": ["sözleşmeden dönme", "iade hakkı"],

    # Genel
    "tazminat": ["maddi tazminat", "manevi tazminat", "zarar tazmini"],
    "zamanaşımı": ["hak düşürücü süre", "dava açma süresi"],
    "vekalet": ["avukatlık ücreti", "vekalet ücreti"],
    "ihtiyati tedbir": ["geçici hukuki koruma", "ihtiyati haciz"],
    "temyiz": ["istinaf", "kanun yolu", "üst mahkeme"],
    "bilirkişi": ["uzman görüşü", "keşif", "delil tespiti"],
}

# Ters eşleme: her eş anlamlı terim ana terime de bağlansın
_REVERSE_MAP: dict[str, list[str]] = {}
for _key, _synonyms in SYNONYM_MAP.items():
    for _syn in _synonyms:
        if _syn not in _REVERSE_MAP:
            _REVERSE_MAP[_syn] = []
        _REVERSE_MAP[_syn].append(_key)

# Normalize edilmiş synonym anahtarları (ASCII) -> orijinal anahtar eşlemesi
# "is kazasi" -> "iş kazası" gibi eşleştirmeler için kullanılır
_NORMALIZED_SYNONYM_KEYS: dict[str, str] = {
    normalize_turkish(k): k for k in SYNONYM_MAP
}
_NORMALIZED_REVERSE_KEYS: dict[str, str] = {
    normalize_turkish(k): k for k in _REVERSE_MAP
}


class QueryExpansionService:
    """Arama sorgularını genişleten servis."""

    def __init__(self) -> None:
        # Kısaltmaları küçük harf → büyük harf eşlemesi olarak derle
        self._abbr_pattern = re.compile(
            r"\b(" + "|".join(re.escape(k) for k in ABBREVIATION_MAP) + r")\b",
            re.IGNORECASE,
        )

    def expand_abbreviations(self, query: str) -> str:
        """Kısaltmaları açarak sorguyu genişlet.

        Hem orijinal hem de normalize edilmiş (ASCII) formlarla eşleşir.
        Örneğin 'IIK' sorgusu 'İİK' kısaltmasını da yakalar.
        """
        def _replace(match: re.Match) -> str:
            abbr = match.group(0).upper()
            abbr_norm = normalize_turkish(abbr)
            for key in ABBREVIATION_MAP:
                key_upper = key.upper()
                if key_upper == abbr or normalize_turkish(key_upper) == abbr_norm:
                    full = ABBREVIATION_MAP[key]
                    return f"{match.group(0)} ({full})"
            return match.group(0)

        return self._abbr_pattern.sub(_replace, query)

    def get_synonyms(self, query: str) -> list[str]:
        """Sorgu için eş anlamlı terimleri bul.

        Hem orijinal Türkçe karakterlerle hem de normalize edilmiş
        (ASCII) formlarla eşleştirme yapar. Böylece "is kazasi" sorgusu
        "iş kazası" eş anlamlılarını da bulabilir.
        """
        query_lower = query.lower().strip()
        query_normalized = normalize_turkish(query_lower)
        synonyms: set[str] = set()

        # Doğrudan eşleşme (orijinal Türkçe karakterlerle)
        for key, syns in SYNONYM_MAP.items():
            if key in query_lower:
                synonyms.update(syns)

        # Normalize edilmiş eşleşme (ASCII karakterlerle)
        # Orijinal eşleşmede bulunamayan terimleri yakalar
        for norm_key, orig_key in _NORMALIZED_SYNONYM_KEYS.items():
            if norm_key in query_normalized and orig_key not in query_lower:
                synonyms.update(SYNONYM_MAP[orig_key])

        # Ters eşleşme (eş anlamlı terimden ana terime)
        for syn_key, main_keys in _REVERSE_MAP.items():
            if syn_key in query_lower:
                synonyms.update(main_keys)
                for mk in main_keys:
                    if mk in SYNONYM_MAP:
                        synonyms.update(SYNONYM_MAP[mk])

        # Ters eşleşme — normalize edilmiş
        for norm_key, orig_key in _NORMALIZED_REVERSE_KEYS.items():
            if norm_key in query_normalized and orig_key not in query_lower:
                main_keys = _REVERSE_MAP[orig_key]
                synonyms.update(main_keys)
                for mk in main_keys:
                    if mk in SYNONYM_MAP:
                        synonyms.update(SYNONYM_MAP[mk])

        synonyms.discard(query_lower)

        return list(synonyms)[:10]

    def expand_query(self, query: str) -> dict:
        """
        Tam query expansion: kısaltma açma + eş anlamlı bulma.

        Returns:
            {
                "original": orijinal sorgu,
                "expanded": kısaltmaları açılmış sorgu,
                "synonyms": eş anlamlı terimler listesi,
                "expanded_queries": genişletilmiş sorgu alternatifleri
            }
        """
        expanded = self.expand_abbreviations(query)
        synonyms = self.get_synonyms(query)

        expanded_queries = [query]

        # Kısaltma açılmış form farklıysa, onu da ekle
        if expanded != query:
            expanded_queries.append(expanded)

        for syn in synonyms[:3]:
            expanded_queries.append(f"{query} {syn}")

        result = {
            "original": query,
            "expanded": expanded,
            "synonyms": synonyms,
            "expanded_queries": expanded_queries,
        }

        logger.debug(
            "query_expanded",
            original=query,
            expanded=expanded,
            synonym_count=len(synonyms),
        )

        return result
