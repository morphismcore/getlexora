"""
Document export endpoints — DOCX and PDF generation for legal documents.
"""

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import io

from app.services.document_export import DocumentExportService

router = APIRouter(prefix="/export", tags=["export"])


class BlockChild(BaseModel):
    id: str = ""
    type: str = "sub_paragraph"
    content: str = ""


class ExportBlock(BaseModel):
    id: str = ""
    type: str = "free_text"
    content: str = ""
    children: list[BlockChild] | None = None


class ExportHeader(BaseModel):
    mahkeme: str = ""
    davaci: str = ""
    davaci_tc: str = ""
    davaci_adres: str = ""
    davaci_vekili: str = ""
    davali: str = ""
    davali_adres: str = ""
    konu: str = ""


class ExportRequest(BaseModel):
    docType: str = ""
    header: ExportHeader = ExportHeader()
    blocks: list[ExportBlock] = []


@router.post("/docx")
async def export_docx(req: ExportRequest):
    """Generate and download a DOCX file from structured document data."""
    service = DocumentExportService()
    doc_data = req.model_dump()
    docx_bytes = service.generate_docx(doc_data)
    return StreamingResponse(
        io.BytesIO(docx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": "attachment; filename=dilekce.docx"},
    )


@router.post("/pdf")
async def export_pdf(req: ExportRequest):
    """Generate and download a PDF file from structured document data."""
    service = DocumentExportService()
    doc_data = req.model_dump()
    pdf_bytes = service.generate_pdf(doc_data)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=dilekce.pdf"},
    )
