"""
Arama API endpoint'leri.
İçtihat arama ve mevzuat arama: LLM gerektirmez.
RAG soru-cevap: LLM gerektirir (opsiyonel).
"""

import json

import structlog
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.models.schemas import (
    SearchRequest,
    SearchResponse,
    RAGResponse,
    MevzuatSearchRequest,
)
from app.api.deps import get_rag_pipeline, get_yargi_service, get_mevzuat_service, get_citation_verifier, get_optional_user
from app.models.database import User

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/search", tags=["search"])


@router.post("/ictihat", response_model=SearchResponse)
async def search_ictihat(
    request: SearchRequest,
    rag=Depends(get_rag_pipeline),
    current_user: User | None = Depends(get_optional_user),
):
    """
    İçtihat arama. LLM GEREKTIRMEZ.
    Bedesten API + Vector DB üzerinden hybrid search.
    """
    try:
        return await rag.search(request)
    except Exception as e:
        logger.error("ictihat_search_error", error=str(e), query=request.query)
        raise HTTPException(status_code=500, detail="Arama sırasında bir hata oluştu. Lütfen tekrar deneyin.")


@router.post("/ask", response_model=RAGResponse)
async def ask_question(
    request: SearchRequest,
    rag=Depends(get_rag_pipeline),
    current_user: User | None = Depends(get_optional_user),
):
    """
    RAG soru-cevap. LLM GEREKTİRİR.
    LLM yoksa arama sonuçlarını döner + uyarı verir.
    """
    try:
        return await rag.ask(query=request.query, search_request=request)
    except Exception as e:
        logger.error("rag_ask_error", error=str(e), query=request.query)
        raise HTTPException(status_code=500, detail="Soru-cevap sırasında bir hata oluştu. Lütfen tekrar deneyin.")


@router.post("/ask/stream")
async def ask_question_stream(
    request: SearchRequest,
    rag=Depends(get_rag_pipeline),
    current_user: User | None = Depends(get_optional_user),
):
    """Streaming RAG soru-cevap. LLM GEREKTİRİR."""
    if not rag.llm_available:
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY tanımlı değil. Streaming kullanılamaz.")

    # Validate all dependencies before starting the stream
    if not rag.llm:
        raise HTTPException(status_code=503, detail="AI servisi şu anda kullanılamıyor")

    if not rag.vector_store:
        raise HTTPException(status_code=503, detail="Arama servisi kullanılamıyor")

    async def event_stream():
        try:
            search_response = await rag.search(request)
            yield f"data: {json.dumps({'type': 'sources', 'data': [s.model_dump() for s in search_response.sonuclar[:5]]})}\n\n"

            context = rag._build_context(search_response.sonuclar)
            if not context.strip():
                yield f"data: {json.dumps({'type': 'error', 'data': 'Yeterli kaynak bulunamadı.'})}\n\n"
                return

            full_answer = ""
            async for chunk in rag.llm.generate_stream(query=request.query, context=context):
                if chunk is None:
                    continue
                full_answer += chunk
                yield f"data: {json.dumps({'type': 'text', 'data': chunk})}\n\n"

            # Post-generation citation re-verification against context
            context_sources = [
                {
                    "esas_no": s.esas_no or "",
                    "karar_no": s.karar_no or "",
                    "content": s.ozet or "",
                    "ozet": s.ozet or "",
                }
                for s in search_response.sonuclar
            ]
            post_check = rag._verify_response_citations(full_answer, context_sources)
            if post_check["unverified"]:
                warning_text = "\n\n⚠️ Dikkat: Yanıtta doğrulanamayan atıflar tespit edildi. Lütfen kontrol ediniz."
                yield f"data: {json.dumps({'type': 'text', 'data': warning_text})}\n\n"

            yield f"data: {json.dumps({'type': 'verification_start'})}\n\n"
            verification = await rag.verifier.verify_all(full_answer)
            yield f"data: {json.dumps({'type': 'verification', 'data': verification.model_dump()})}\n\n"
            yield f"data: {json.dumps({'type': 'post_citation_check', 'data': post_check})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except GeneratorExit:
            # Client disconnected, clean exit
            pass
        except Exception as e:
            logger.error("rag_stream_error", error=str(e))
            try:
                yield f"data: {json.dumps({'type': 'error', 'data': 'Bir hata oluştu. Lütfen tekrar deneyin.'})}\n\n"
            except Exception:
                pass

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/mevzuat")
async def search_mevzuat(
    request: MevzuatSearchRequest,
    mevzuat=Depends(get_mevzuat_service),
    current_user: User | None = Depends(get_optional_user),
):
    """Mevzuat arama. LLM GEREKTIRMEZ."""
    try:
        result = await mevzuat.search(
            keyword=request.query,
            mevzuat_no=request.kanun_no,
        )
        return result
    except Exception as e:
        logger.error("mevzuat_search_error", error=str(e), query=request.query)
        raise HTTPException(status_code=500, detail="Mevzuat araması sırasında bir hata oluştu. Lütfen tekrar deneyin.")


@router.get("/mevzuat/{mevzuat_id}")
async def get_mevzuat_content(
    mevzuat_id: str,
    mevzuat=Depends(get_mevzuat_service),
    current_user: User | None = Depends(get_optional_user),
):
    """Mevzuat tam metnini getir. LLM GEREKTIRMEZ."""
    try:
        result = await mevzuat.get_content(mevzuat_id)
        if result.get("content"):
            import re
            clean = re.sub(r"<[^>]+>", "\n", result["content"])
            clean = clean.replace("&nbsp;", " ").replace("&amp;", "&")
            clean = re.sub(r"&\w+;", " ", clean)
            clean = re.sub(r"\n\s*\n+", "\n\n", clean).strip()
            return {"mevzuat_id": mevzuat_id, "content": clean, "html": result["content"]}
        return {"mevzuat_id": mevzuat_id, "content": "", "error": "İçerik alınamadı"}
    except Exception as e:
        logger.error("mevzuat_content_error", error=str(e), mevzuat_id=mevzuat_id)
        raise HTTPException(status_code=500, detail="Mevzuat içeriği alınırken bir hata oluştu. Lütfen tekrar deneyin.")


@router.get("/karar/{document_id}")
async def get_karar(
    document_id: str,
    yargi=Depends(get_yargi_service),
    current_user: User | None = Depends(get_optional_user),
):
    """Tam karar metnini getir. LLM GEREKTIRMEZ."""
    try:
        doc = await yargi.get_document(document_id)
        content = doc.get("data", {}).get("decoded_content", "")
        if content:
            import re
            clean = re.sub(r"<[^>]+>", " ", content)
            clean = clean.replace("&nbsp;", " ").replace("&amp;", "&")
            clean = re.sub(r"&\w+;", " ", clean)
            clean = re.sub(r"\s+", " ", clean).strip()
            return {"document_id": document_id, "content": clean, "html": content}
        return {"document_id": document_id, "content": "", "error": "İçerik alınamadı"}
    except Exception as e:
        logger.error("karar_fetch_error", error=str(e), document_id=document_id)
        raise HTTPException(status_code=500, detail="Karar metni alınırken bir hata oluştu. Lütfen tekrar deneyin.")


class VerifyRequest(BaseModel):
    text: str


@router.post("/verify")
async def verify_text(
    request: VerifyRequest,
    verifier=Depends(get_citation_verifier),
    current_user: User | None = Depends(get_optional_user),
):
    """Metin içindeki hukuki referansları doğrula. LLM GEREKTIRMEZ."""
    try:
        report = await verifier.verify_all(request.text)
        return report
    except Exception as e:
        logger.error("verify_text_error", error=str(e))
        raise HTTPException(status_code=500, detail="Doğrulama sırasında bir hata oluştu. Lütfen tekrar deneyin.")
