"""
Template engine and API tests.
"""

import pytest
from app.services.template_engine import TemplateEngine


class TestTemplateEngine:
    """Test template engine functionality."""

    def test_list_templates(self):
        engine = TemplateEngine()
        templates = engine.list_templates()
        assert len(templates) >= 5
        assert all("id" in t for t in templates)
        assert all("name" in t for t in templates)
        assert all("fields" in t for t in templates)

    def test_get_template_existing(self):
        engine = TemplateEngine()
        tpl = engine.get_template("ise_iade_dava")
        assert tpl is not None
        assert tpl["name"] == "İşe İade Dava Dilekçesi"
        assert len(tpl["fields"]) > 0

    def test_get_template_nonexistent(self):
        engine = TemplateEngine()
        tpl = engine.get_template("nonexistent")
        assert tpl is None

    def test_generate_ise_iade(self):
        engine = TemplateEngine()
        result = engine.generate("ise_iade_dava", {
            "mahkeme": "İstanbul 1. İş Mahkemesi",
            "davaci_adi": "Test Davacı",
            "davaci_adres": "Test Adres",
            "davali_adi": "Test Davalı",
            "davali_adres": "Davalı Adres",
            "ise_giris_tarihi": "01.01.2020",
            "fesih_tarihi": "01.01.2024",
            "fesih_sebebi": "Performans düşüklüğü",
            "son_brut_ucret": "50000",
            "savunma_alinmis_mi": "Hayır",
            "arabuluculuk_tarihi": "15.01.2024",
        })
        assert "İstanbul 1. İş Mahkemesi" in result
        assert "Test Davacı" in result
        assert "Test Davalı" in result
        assert "4857" in result  # İş Kanunu referansı

    def test_generate_ihtarname(self):
        engine = TemplateEngine()
        result = engine.generate("ihtarname", {
            "noter": "İstanbul 5. Noterliği",
            "ihtar_eden": "Ahmet Yılmaz",
            "ihtar_eden_adres": "Kadıköy",
            "muhatap": "Mehmet Demir",
            "muhatap_adres": "Şişli",
            "konu": "Kira alacağı",
            "aciklama": "3 aydır kira ödenmemiştir.",
            "talep": "birikmiş kira bedellerinin ödenmesi",
            "sure": "7 gün",
        })
        assert "İHTARNAME" in result
        assert "Ahmet Yılmaz" in result
        assert "7 gün" in result

    def test_generate_invalid_template(self):
        engine = TemplateEngine()
        with pytest.raises(ValueError, match="Şablon bulunamadı"):
            engine.generate("nonexistent", {})

    def test_generate_with_optional_fields(self):
        engine = TemplateEngine()
        result = engine.generate("ise_iade_dava", {
            "mahkeme": "Test Mahkemesi",
            "davaci_adi": "Test",
            "davaci_adres": "Adres",
            "davali_adi": "Davalı",
            "davali_adres": "Adres",
            "ise_giris_tarihi": "01.01.2020",
            "fesih_tarihi": "01.01.2024",
            "fesih_sebebi": "Test",
            "son_brut_ucret": "10000",
            "savunma_alinmis_mi": "Evet",
            "arabuluculuk_tarihi": "15.01.2024",
            "davaci_vekili": "Av. Test Vekil",
        })
        assert "Av. Test Vekil" in result