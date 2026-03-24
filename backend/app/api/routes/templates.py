"""
Dilekçe şablon API endpoint'leri.
Şablon listesi, detay ve belge üretimi.
AI kullanmaz — pure template filling.
"""

import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.template_engine import TemplateEngine

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/templates", tags=["templates"])

engine = TemplateEngine()


class GenerateRequest(BaseModel):
    values: dict[str, str]


class GenerateResponse(BaseModel):
    document: str
    template_name: str


@router.get("")
async def list_templates():
    """Tüm dilekçe şablonlarını listeler."""
    return engine.list_templates()


@router.get("/{template_id}")
async def get_template(template_id: str):
    """Tek bir şablonun detayını döndürür."""
    tpl = engine.get_template(template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="Şablon bulunamadı")
    return tpl


@router.post("/{template_id}/generate")
async def generate_document(template_id: str, req: GenerateRequest):
    """Şablonu doldurarak belge üretir."""
    tpl = engine.get_template(template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="Şablon bulunamadı")

    try:
        document = engine.generate(template_id, req.values)
    except ValueError as e:
        logger.error("template_generate_error", error=str(e), template_id=template_id)
        raise HTTPException(status_code=400, detail="Şablon doldurulurken bir hata oluştu. Lütfen alanları kontrol edip tekrar deneyin.")

    return GenerateResponse(document=document, template_name=tpl["name"])
