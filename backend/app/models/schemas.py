from pydantic import BaseModel, Field
from enum import Enum
from datetime import date


class Mahkeme(str, Enum):
    YARGITAY = "yargitay"
    DANISTAY = "danistay"
    AYM = "aym"
    BAM = "bam"  # Bölge Adliye Mahkemesi
    BIM = "bim"  # Bölge İdare Mahkemesi


class HukukAlani(str, Enum):
    IS = "is_hukuku"
    CEZA = "ceza_hukuku"
    TICARET = "ticaret_hukuku"
    IDARE = "idare_hukuku"
    AILE = "aile_hukuku"
    ICRA = "icra_iflas"
    ANAYASA = "anayasa_hukuku"
    GENEL = "genel"


class VerificationStatus(str, Enum):
    VERIFIED = "verified"
    NOT_FOUND = "not_found"
    PARTIAL_MATCH = "partial_match"
    UNVERIFIED = "unverified"


# --- Search ---


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=2000)
    hukuk_alani: HukukAlani | None = None
    mahkeme: list[Mahkeme] | None = None
    daire: str | None = None
    tarih_baslangic: date | None = None
    tarih_bitis: date | None = None
    max_sonuc: int = Field(default=10, ge=1, le=50)


class IctihatResult(BaseModel):
    karar_id: str
    mahkeme: str
    daire: str | None = None
    esas_no: str | None = None
    karar_no: str | None = None
    tarih: str | None = None
    ozet: str
    anahtar_ilke: str | None = None
    relevance_score: float
    rerank_score: float | None = None
    verification_status: VerificationStatus = VerificationStatus.UNVERIFIED
    tam_metin: str | None = None
    kaynak_url: str | None = None


class SearchResponse(BaseModel):
    sonuclar: list[IctihatResult]
    toplam_bulunan: int
    sure_ms: int
    query_kullanilan: str
    guven_skoru: float | None = None


# --- Citation Verification ---


class CitationRef(BaseModel):
    raw_text: str
    citation_type: str  # ictihat, mevzuat, aihm
    mahkeme: str | None = None
    esas_no: str | None = None
    karar_no: str | None = None
    kanun_no: str | None = None
    madde_no: str | None = None


class CitationVerification(BaseModel):
    reference: CitationRef
    status: VerificationStatus
    found_match: str | None = None
    suggestion: str | None = None
    verification_ms: int = 0


class VerificationReport(BaseModel):
    total_citations: int
    verified: int
    not_found: int
    partial_match: int
    details: list[CitationVerification]
    overall_confidence: float


# --- RAG Response ---


class RAGResponse(BaseModel):
    answer: str
    sources: list[IctihatResult]
    mevzuat_refs: list[dict] | None = None
    verification: VerificationReport | None = None
    confidence_score: float
    warning: str | None = None


# --- Mevzuat ---


class MevzuatSearchRequest(BaseModel):
    query: str = Field(default="", max_length=1000)
    kanun_no: str | None = None
    madde_no: str | None = None


class MevzuatResult(BaseModel):
    kanun_adi: str
    kanun_no: str | None = None
    madde_no: str | None = None
    madde_metni: str
    yururluk_tarihi: str | None = None
    son_degisiklik: str | None = None
