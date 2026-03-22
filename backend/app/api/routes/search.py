"""
Arama API endpoint'leri.
İçtihat arama ve mevzuat arama: LLM gerektirmez.
RAG soru-cevap: LLM gerektirir (opsiyonel).
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import json

from app.models.schemas import (
    SearchRequest,
    SearchResponse,
    RAGResponse,
    MevzuatSearchRequest,
)
from app.api.deps import get_rag_pipeline, get_yargi_service, get_mevzuat_service, get_citation_verifier, get_optional_user
from app.models.database import User

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
        raise HTTPException(status_code=500, detail=f"Arama hatası: {str(e)}")


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
        raise HTTPException(status_code=500, detail=f"RAG hatası: {str(e)}")


@router.post("/ask/stream")
async def ask_question_stream(
    request: SearchRequest,
    rag=Depends(get_rag_pipeline),
    current_user: User | None = Depends(get_optional_user),
):
    """Streaming RAG soru-cevap. LLM GEREKTİRİR."""
    if not rag.llm_available:
        return {"error": "ANTHROPIC_API_KEY tanımlı değil. Streaming kullanılamaz."}

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
                full_answer += chunk
                yield f"data: {json.dumps({'type': 'text', 'data': chunk})}\n\n"

            yield f"data: {json.dumps({'type': 'verification_start'})}\n\n"
            verification = await rag.verifier.verify_all(full_answer)
            yield f"data: {json.dumps({'type': 'verification', 'data': verification.model_dump()})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'data': str(e)})}\n\n"

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
        raise HTTPException(status_code=500, detail=f"Mevzuat arama hatası: {str(e)}")


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
        raise HTTPException(status_code=500, detail=f"Mevzuat içerik hatası: {str(e)}")


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
        raise HTTPException(status_code=500, detail=f"Karar getirme hatası: {str(e)}")


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
        raise HTTPException(status_code=500, detail=f"Doğrulama hatası: {str(e)}")
