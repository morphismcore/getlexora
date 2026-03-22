"""
Test fixtures for Lexora backend.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient, ASGITransport

from app.models.schemas import (
    SearchResponse,
    IctihatResult,
    VerificationReport,
    VerificationStatus,
)


@pytest.fixture
def mock_rag_pipeline():
    """Mock RAG pipeline that returns predictable search results."""
    rag = AsyncMock()
    rag.llm_available = False
    rag.search.return_value = SearchResponse(
        sonuclar=[
            IctihatResult(
                karar_id="test-doc-1",
                mahkeme="Yargıtay",
                daire="9. Hukuk Dairesi",
                esas_no="2023/1234",
                karar_no="2023/5678",
                tarih="2023-06-15",
                ozet="Test karar ozeti",
                relevance_score=0.85,
            )
        ],
        toplam_bulunan=1,
        sure_ms=150,
        query_kullanilan="test query",
        guven_skoru=0.85,
    )
    return rag


@pytest.fixture
def mock_mevzuat_service():
    """Mock mevzuat service."""
    svc = AsyncMock()
    svc.search.return_value = {
        "sonuclar": [
            {
                "mevzuat_id": "mevzuat-1",
                "kanun_adi": "İş Kanunu",
                "kanun_no": "4857",
                "tur": "Kanun",
                "resmi_gazete_tarihi": "2003-06-10",
                "resmi_gazete_sayisi": "25134",
            }
        ],
        "toplam": 1,
    }
    return svc


@pytest.fixture
def mock_yargi_service():
    """Mock yargi service."""
    svc = AsyncMock()
    return svc


@pytest.fixture
def mock_citation_verifier():
    """Mock citation verifier."""
    verifier = AsyncMock()
    verifier.verify_all.return_value = VerificationReport(
        total_citations=1,
        verified=1,
        not_found=0,
        partial_match=0,
        details=[],
        overall_confidence=1.0,
    )
    return verifier


@pytest.fixture
async def client(
    mock_rag_pipeline,
    mock_mevzuat_service,
    mock_yargi_service,
    mock_citation_verifier,
):
    """Async test client with mocked dependencies."""
    with (
        patch("app.api.deps.get_rag_pipeline", return_value=mock_rag_pipeline),
        patch("app.api.deps.get_mevzuat_service", return_value=mock_mevzuat_service),
        patch("app.api.deps.get_yargi_service", return_value=mock_yargi_service),
        patch("app.api.deps.get_citation_verifier", return_value=mock_citation_verifier),
        patch("app.api.deps.get_vector_store") as mock_vs,
        patch("app.api.deps.get_embedding_service"),
    ):
        # Mock vector store initialize to prevent actual Qdrant connection
        mock_vs.return_value = AsyncMock()

        from app.main import app
        from app.api.deps import get_optional_user
        from app.models.db import get_db

        # Override dependencies that require DB
        app.dependency_overrides[get_optional_user] = lambda: None
        app.dependency_overrides[get_db] = lambda: AsyncMock()

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac

        # Clean up overrides
        app.dependency_overrides.clear()
