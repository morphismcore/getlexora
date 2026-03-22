"""
Lexora Upload Routes -- Belge yukleme ve metin cikarma.
AI kullanmaz, pure extraction.
"""

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.database import Case, CaseDocument, User
from app.models.db import get_db
from app.api.routes.auth import get_current_user
from app.services.document_processor import DocumentProcessor

router = APIRouter(prefix="/upload", tags=["upload"])

# 20 MB limit
MAX_FILE_SIZE = 20 * 1024 * 1024
ALLOWED_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
}

processor = DocumentProcessor()


# ── Response Schemas ─────────────────────────────────────────────────


class CitationFound(BaseModel):
    raw_text: str
    pattern_type: str


class PartiesResponse(BaseModel):
    davaci: str | None = None
    davali: str | None = None
    davaci_vekili: str | None = None
    davali_vekili: str | None = None


class CaseInfoResponse(BaseModel):
    mahkeme: str | None = None
    esas_no: str | None = None
    karar_no: str | None = None
    tarih: str | None = None


class DocumentMetadata(BaseModel):
    title: str = ""
    author: str = ""
    subject: str = ""


class AnalyzeResponse(BaseModel):
    file_name: str
    file_type: str
    pages: int | None = None
    paragraphs: int | None = None
    document_type: str
    parties: PartiesResponse
    case_info: CaseInfoResponse
    citations: list[CitationFound]
    metadata: DocumentMetadata
    text: str
    text_length: int


class UploadToCaseResponse(BaseModel):
    document_id: str
    case_id: str
    file_name: str
    document_type: str
    message: str


# ── Helpers ──────────────────────────────────────────────────────────


async def _read_and_validate(file: UploadFile) -> tuple[bytes, str]:
    """Read upload, validate type & size. Returns (bytes, file_type)."""
    content_type = file.content_type or ""
    file_type = ALLOWED_TYPES.get(content_type)

    # Fallback: check extension
    if file_type is None and file.filename:
        ext = Path(file.filename).suffix.lower()
        if ext == ".pdf":
            file_type = "pdf"
        elif ext == ".docx":
            file_type = "docx"

    if file_type is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Desteklenmeyen dosya tipi. Sadece PDF ve DOCX kabul edilir.",
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Dosya boyutu 20MB limitini asiyor.",
        )

    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bos dosya yuklendi.",
        )

    return file_bytes, file_type


def _extract_and_analyze(file_bytes: bytes, file_type: str, file_name: str) -> dict:
    """Extract text and run all analysis."""
    if file_type == "pdf":
        extraction = processor.extract_text_from_pdf(file_bytes)
    else:
        extraction = processor.extract_text_from_docx(file_bytes)

    text = extraction["text"]
    document_type = processor.detect_document_type(text)
    parties = processor.extract_parties(text)
    case_info = processor.extract_case_info(text)
    citations = processor.extract_citations_from_document(text)

    meta = extraction.get("metadata", {})

    return {
        "file_name": file_name,
        "file_type": file_type,
        "pages": extraction.get("pages"),
        "paragraphs": extraction.get("paragraphs"),
        "document_type": document_type,
        "parties": parties,
        "case_info": case_info,
        "citations": citations,
        "metadata": {
            "title": meta.get("title", ""),
            "author": meta.get("author", ""),
            "subject": meta.get("subject", ""),
        },
        "text": text,
        "text_length": len(text),
    }


# ── Routes ───────────────────────────────────────────────────────────


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_document(file: UploadFile = File(...)):
    """
    Belge yukle ve analiz et (auth gerektirmez).
    PDF veya DOCX kabul eder. Max 20MB.
    Metin cikarir, belge turunu tespit eder, taraflari ve dava bilgilerini bulur.
    """
    file_bytes, file_type = await _read_and_validate(file)

    try:
        result = _extract_and_analyze(file_bytes, file_type, file.filename or "unknown")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Belge işlenemedi: {str(e)}",
        )

    return result


@router.post("/to-case/{case_id}", response_model=UploadToCaseResponse)
async def upload_to_case(
    case_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Belgeyi bir davaya ekle (auth gerektirir).
    Dosyayi analiz eder ve dava dosyasina kaydeder.
    """
    # Verify case ownership
    result = await db.execute(
        select(Case).where(Case.id == case_id, Case.user_id == current_user.id)
    )
    case = result.scalar_one_or_none()
    if case is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dava bulunamadi.",
        )

    file_bytes, file_type = await _read_and_validate(file)

    try:
        analysis = _extract_and_analyze(file_bytes, file_type, file.filename or "unknown")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Belge işlenemedi: {str(e)}",
        )

    # Save document record — sanitize file_type to prevent path traversal
    doc_id = uuid.uuid4()
    safe_type = "".join(c for c in file_type if c.isalnum())[:10]
    file_path = f"uploads/{case_id}/{doc_id}.{safe_type}"

    case_doc = CaseDocument(
        id=doc_id,
        case_id=case_id,
        file_name=file.filename or "unknown",
        file_type=file_type,
        file_path=file_path,
        document_type=analysis["document_type"],
    )
    db.add(case_doc)
    await db.flush()
    await db.refresh(case_doc)

    return UploadToCaseResponse(
        document_id=str(doc_id),
        case_id=str(case_id),
        file_name=file.filename or "unknown",
        document_type=analysis["document_type"],
        message="Belge basariyla davaya eklendi.",
    )
