"""
Document export tests — DOCX and PDF generation.
"""

import pytest
from app.services.document_export import DocumentExportService


@pytest.fixture
def export_service():
    return DocumentExportService()


@pytest.fixture
def sample_doc_data():
    return {
        "docType": "Dava Dilekçesi",
        "header": {
            "mahkeme": "İstanbul 3. İş Mahkemesi'ne",
            "davaci": "Ali Yılmaz",
            "davaci_tc": "12345678901",
            "davaci_adres": "Kadıköy, İstanbul",
            "davaci_vekili": "Av. Mehmet Demir",
            "davali": "XYZ Ltd. Şti.",
            "davali_adres": "Şişli, İstanbul",
            "konu": "İşe iade talebi",
        },
        "blocks": [
            {"type": "section_header", "content": "AÇIKLAMALAR"},
            {
                "type": "numbered_paragraph",
                "content": "Müvekkilimiz davalı işyerinde çalışmaktaydı.",
                "children": [
                    {"content": "İş sözleşmesi haksız feshedilmiştir."},
                    {"content": "Savunma alınmamıştır."},
                ],
            },
            {"type": "free_text", "content": "Fesih geçersizdir."},
            {"type": "section_header", "content": "DELİLLER"},
            {"type": "evidence_item", "content": "İş sözleşmesi"},
            {"type": "evidence_item", "content": "Fesih bildirimi"},
        ],
    }


class TestDocxExport:
    def test_generates_docx_bytes(self, export_service, sample_doc_data):
        result = export_service.generate_docx(sample_doc_data)
        assert isinstance(result, bytes)
        assert len(result) > 0
        # DOCX files start with PK (ZIP format)
        assert result[:2] == b"PK"

    def test_empty_doc_generates(self, export_service):
        result = export_service.generate_docx({"header": {}, "blocks": []})
        assert isinstance(result, bytes)
        assert len(result) > 0

    def test_with_only_header(self, export_service):
        result = export_service.generate_docx({
            "header": {"mahkeme": "Test Mahkemesi", "davaci": "Test"},
            "blocks": [],
        })
        assert isinstance(result, bytes)


class TestPdfExport:
    def test_generates_pdf_bytes(self, export_service, sample_doc_data):
        result = export_service.generate_pdf(sample_doc_data)
        assert isinstance(result, (bytes, bytearray))
        assert len(result) > 0
        # PDF files start with %PDF
        assert bytes(result)[:4] == b"%PDF"

    def test_empty_doc_generates(self, export_service):
        result = export_service.generate_pdf({"header": {}, "blocks": []})
        assert isinstance(result, (bytes, bytearray))
        assert bytes(result)[:4] == b"%PDF"