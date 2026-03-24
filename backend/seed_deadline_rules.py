#!/usr/bin/env python3
"""Seed script: 65+ olay türü, 180+ süre kuralı, resmi tatiller 2025-2028, adli tatil."""
import asyncio
import sys
import os
import uuid
from datetime import date

sys.path.insert(0, os.path.dirname(__file__))

from app.models.database import (
    EventTypeDefinition,
    DeadlineRuleDefinition,
    PublicHoliday,
    JudicialRecess,
)
from app.models.db import async_session
from sqlalchemy import select


# ═══════════════════════════════════════════════════════════════════════════
# EVENT TYPES + RULES  (category, slug, name, description, rules[])
# ═══════════════════════════════════════════════════════════════════════════

EVENT_TYPES = [
    # ── HMK ───────────────────────────────────────────────────────────────
    {
        "slug": "hmk_karar_teblig",
        "name": "Hukuk Kararı Tebliği",
        "category": "HMK",
        "description": "Hukuk mahkemesi kararının tebliği üzerine başlayan süreler.",
        "rules": [
            {
                "name": "İstinaf süresi",
                "law_reference": "HMK md. 345",
                "duration_value": 2,
                "duration_unit": "hafta",
                "duration_display": "2 hafta",
                "deadline_type": "usul_suresi",
                "affected_by_adli_tatil": True,
                "affected_by_holidays": True,
            },
            {
                "name": "Temyiz süresi",
                "law_reference": "HMK md. 361",
                "duration_value": 2,
                "duration_unit": "hafta",
                "duration_display": "2 hafta",
                "deadline_type": "usul_suresi",
                "affected_by_adli_tatil": True,
                "affected_by_holidays": True,
            },
        ],
    },
    {
        "slug": "hmk_dava_teblig",
        "name": "Dava Dilekçesi Tebliği",
        "category": "HMK",
        "description": "Dava dilekçesi tebliği üzerine cevap süreleri.",
        "rules": [
            {
                "name": "Cevap dilekçesi süresi",
                "law_reference": "HMK md. 127",
                "duration_value": 2,
                "duration_unit": "hafta",
                "duration_display": "2 hafta",
                "deadline_type": "usul_suresi",
                "affected_by_adli_tatil": True,
                "affected_by_holidays": True,
            },
            {
                "name": "Cevaba cevap süresi",
                "law_reference": "HMK md. 136",
                "duration_value": 2,
                "duration_unit": "hafta",
                "duration_display": "2 hafta",
                "deadline_type": "usul_suresi",
                "affected_by_adli_tatil": True,
                "affected_by_holidays": True,
            },
            {
                "name": "İkinci cevap süresi",
                "law_reference": "HMK md. 136",
                "duration_value": 2,
                "duration_unit": "hafta",
                "duration_display": "2 hafta",
                "deadline_type": "usul_suresi",
                "affected_by_adli_tatil": True,
                "affected_by_holidays": True,
            },
        ],
    },
    {
        "slug": "hmk_bilirkisi_teblig",
        "name": "Bilirkişi Raporu Tebliği",
        "category": "HMK",
        "description": "Bilirkişi raporunun tebliği üzerine itiraz süresi.",
        "rules": [
            {
                "name": "İtiraz süresi",
                "law_reference": "HMK md. 281",
                "duration_value": 2,
                "duration_unit": "hafta",
                "duration_display": "2 hafta",
                "deadline_type": "usul_suresi",
                "affected_by_adli_tatil": True,
                "affected_by_holidays": True,
            },
        ],
    },
    {
        "slug": "hmk_islah",
        "name": "Islah",
        "category": "HMK",
        "description": "Islah hakkı — tahkikat bitene kadar kullanılabilir.",
        "rules": [
            {
                "name": "Islah süresi (tahkikat bitene kadar)",
                "law_reference": "HMK md. 177",
                "duration_value": 0,
                "duration_unit": "bilgi",
                "duration_display": "Tahkikat bitene kadar",
                "deadline_type": "bilgi",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
                "note": "Islah hakkı tahkikatın sona ermesine kadar kullanılabilir.",
            },
        ],
    },
    {
        "slug": "hmk_delil_sunma",
        "name": "Delil Sunma",
        "category": "HMK",
        "description": "Delillerin sunulması için son tarih.",
        "rules": [
            {
                "name": "Delil sunma süresi (ön inceleme duruşmasına kadar)",
                "law_reference": "HMK md. 140",
                "duration_value": 0,
                "duration_unit": "bilgi",
                "duration_display": "Ön inceleme duruşmasına kadar",
                "deadline_type": "bilgi",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
        ],
    },
    {
        "slug": "hmk_ihtiyati_tedbir_karari",
        "name": "İhtiyati Tedbir Kararı",
        "category": "HMK",
        "description": "İhtiyati tedbir kararı sonrası dava açma süresi.",
        "rules": [
            {
                "name": "Dava açma süresi",
                "law_reference": "HMK md. 397",
                "duration_value": 2,
                "duration_unit": "hafta",
                "duration_display": "2 hafta",
                "deadline_type": "hak_dusurucusu",
                "affected_by_adli_tatil": True,
                "affected_by_holidays": True,
            },
        ],
    },
    {
        "slug": "hmk_arabuluculuk_son_tutanak",
        "name": "Arabuluculuk Son Tutanağı",
        "category": "HMK",
        "description": "Arabuluculuk son tutanağı sonrası dava açma süresi.",
        "rules": [
            {
                "name": "Dava açma süresi",
                "law_reference": "HUAK md. 18/A",
                "duration_value": 2,
                "duration_unit": "hafta",
                "duration_display": "2 hafta",
                "deadline_type": "hak_dusurucusu",
                "affected_by_adli_tatil": True,
                "affected_by_holidays": True,
            },
        ],
    },
    {
        "slug": "hmk_feragat",
        "name": "Davadan Feragat",
        "category": "HMK",
        "description": "Davadan feragat — bilgi amaçlı kayıt.",
        "rules": [],
    },
    {
        "slug": "hmk_kesinlesme",
        "name": "Kararın Kesinleşmesi",
        "category": "HMK",
        "description": "Kararın kesinleşmesi üzerine yargılamanın iadesi süresi.",
        "rules": [
            {
                "name": "Yargılamanın iadesi süresi",
                "law_reference": "HMK md. 377",
                "duration_value": 1,
                "duration_unit": "yil",
                "duration_display": "1 yıl",
                "deadline_type": "hak_dusurucusu",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
        ],
    },
    {
        "slug": "hmk_basvuru_red",
        "name": "İstinaf/Temyiz Başvuru Reddi",
        "category": "HMK",
        "description": "İstinaf veya temyiz başvurusunun reddi üzerine süreler.",
        "rules": [
            {
                "name": "Karar düzeltme süresi (eski usul)",
                "law_reference": "HUMK md. 440",
                "duration_value": 15,
                "duration_unit": "gun",
                "duration_display": "15 gün",
                "deadline_type": "usul_suresi",
                "affected_by_adli_tatil": True,
                "affected_by_holidays": True,
            },
        ],
    },
    {
        "slug": "hmk_on_inceleme",
        "name": "Ön İnceleme Duruşması",
        "category": "HMK",
        "description": "Ön inceleme duruşması — bilgi amaçlı kayıt.",
        "rules": [],
    },
    # ── CMK ───────────────────────────────────────────────────────────────
    {
        "slug": "cmk_karar_teblig",
        "name": "Ceza Kararı Tebliği",
        "category": "CMK",
        "description": "Ceza mahkemesi kararının tebliği üzerine kanun yolu süreleri.",
        "rules": [
            {
                "name": "İstinaf süresi",
                "law_reference": "CMK md. 273 (01.06.2024 değişikliği)",
                "duration_value": 2,
                "duration_unit": "hafta",
                "duration_display": "2 hafta",
                "deadline_type": "usul_suresi",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": True,
            },
            {
                "name": "Temyiz süresi",
                "law_reference": "CMK md. 291 (01.06.2024 değişikliği)",
                "duration_value": 2,
                "duration_unit": "hafta",
                "duration_display": "2 hafta",
                "deadline_type": "usul_suresi",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": True,
            },
        ],
    },
    {
        "slug": "cmk_tutuklama",
        "name": "Tutuklama Kararı",
        "category": "CMK",
        "description": "Tutuklama kararına itiraz süresi.",
        "rules": [
            {
                "name": "İtiraz süresi",
                "law_reference": "CMK md. 268",
                "duration_value": 7,
                "duration_unit": "gun",
                "duration_display": "7 gün",
                "deadline_type": "usul_suresi",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": True,
            },
        ],
    },
    {
        "slug": "cmk_yakalama",
        "name": "Yakalama/Gözaltı",
        "category": "CMK",
        "description": "Yakalama veya gözaltı sonrası hakim önüne çıkarılma süresi.",
        "rules": [
            {
                "name": "Hakim önüne çıkarılma süresi",
                "law_reference": "CMK md. 91",
                "duration_value": 1,
                "duration_unit": "gun",
                "duration_display": "24 saat",
                "deadline_type": "usul_suresi",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
                "note": "Fiilen 24 saat; takvim günü olarak 1 gün hesaplanır.",
            },
        ],
    },
    {
        "slug": "cmk_iddianame_teblig",
        "name": "İddianame Tebliği",
        "category": "CMK",
        "description": "İddianamenin tebliği üzerine itiraz süresi.",
        "rules": [
            {
                "name": "İtiraz süresi",
                "law_reference": "CMK md. 174",
                "duration_value": 15,
                "duration_unit": "gun",
                "duration_display": "15 gün",
                "deadline_type": "usul_suresi",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": True,
            },
        ],
    },
    {
        "slug": "cmk_hagb",
        "name": "HAGB Kararı",
        "category": "CMK",
        "description": "Hükmün açıklanmasının geri bırakılması kararına itiraz süresi.",
        "rules": [
            {
                "name": "İtiraz süresi",
                "law_reference": "CMK md. 268",
                "duration_value": 7,
                "duration_unit": "gun",
                "duration_display": "7 gün",
                "deadline_type": "usul_suresi",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": True,
            },
        ],
    },
    {
        "slug": "cmk_uzlasma",
        "name": "Uzlaşma Teklifi",
        "category": "CMK",
        "description": "Uzlaşma teklifine cevap süresi.",
        "rules": [
            {
                "name": "Cevap süresi",
                "law_reference": "CMK md. 253",
                "duration_value": 3,
                "duration_unit": "gun",
                "duration_display": "3 gün",
                "deadline_type": "usul_suresi",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
        ],
    },
    {
        "slug": "cmk_adli_kontrol",
        "name": "Adli Kontrol Kararı",
        "category": "CMK",
        "description": "Adli kontrol kararına itiraz süresi.",
        "rules": [
            {
                "name": "İtiraz süresi",
                "law_reference": "CMK md. 268",
                "duration_value": 7,
                "duration_unit": "gun",
                "duration_display": "7 gün",
                "deadline_type": "usul_suresi",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": True,
            },
        ],
    },
    # ── İYUK ──────────────────────────────────────────────────────────────
    {
        "slug": "iyuk_idari_islem_teblig",
        "name": "İdari İşlem Tebliği",
        "category": "İYUK",
        "description": "İdari işlemin tebliği üzerine dava açma süreleri.",
        "rules": [
            {
                "name": "İptal davası açma süresi",
                "law_reference": "İYUK md. 7",
                "duration_value": 60,
                "duration_unit": "gun",
                "duration_display": "60 gün",
                "deadline_type": "hak_dusurucusu",
                "affected_by_adli_tatil": True,
                "affected_by_holidays": True,
            },
            {
                "name": "Tam yargı davası açma süresi",
                "law_reference": "İYUK md. 12-13",
                "duration_value": 60,
                "duration_unit": "gun",
                "duration_display": "60 gün",
                "deadline_type": "hak_dusurucusu",
                "affected_by_adli_tatil": True,
                "affected_by_holidays": True,
            },
        ],
    },
    {
        "slug": "iyuk_vergi_teblig",
        "name": "Vergi/Ceza İhbarnamesi Tebliği",
        "category": "İYUK",
        "description": "Vergi veya ceza ihbarnamesinin tebliği üzerine dava açma süresi.",
        "rules": [
            {
                "name": "Dava açma süresi",
                "law_reference": "İYUK md. 7",
                "duration_value": 30,
                "duration_unit": "gun",
                "duration_display": "30 gün",
                "deadline_type": "hak_dusurucusu",
                "affected_by_adli_tatil": True,
                "affected_by_holidays": True,
            },
        ],
    },
    {
        "slug": "iyuk_idari_karar_teblig",
        "name": "İdari Yargı Kararı Tebliği",
        "category": "İYUK",
        "description": "İdari yargı kararının tebliği üzerine kanun yolu süreleri.",
        "rules": [
            {
                "name": "İstinaf süresi",
                "law_reference": "İYUK md. 45",
                "duration_value": 30,
                "duration_unit": "gun",
                "duration_display": "30 gün",
                "deadline_type": "usul_suresi",
                "affected_by_adli_tatil": True,
                "affected_by_holidays": True,
            },
            {
                "name": "Temyiz süresi",
                "law_reference": "İYUK md. 46",
                "duration_value": 30,
                "duration_unit": "gun",
                "duration_display": "30 gün",
                "deadline_type": "usul_suresi",
                "affected_by_adli_tatil": True,
                "affected_by_holidays": True,
            },
        ],
    },
    {
        "slug": "iyuk_yurume_durdurma_red",
        "name": "Yürütmeyi Durdurma Reddi",
        "category": "İYUK",
        "description": "Yürütmeyi durdurma talebinin reddine itiraz süresi.",
        "rules": [
            {
                "name": "İtiraz süresi",
                "law_reference": "İYUK md. 27",
                "duration_value": 7,
                "duration_unit": "gun",
                "duration_display": "7 gün",
                "deadline_type": "usul_suresi",
                "affected_by_adli_tatil": True,
                "affected_by_holidays": True,
            },
        ],
    },
    {
        "slug": "iyuk_ust_makam_basvuru",
        "name": "Üst Makama Başvuru",
        "category": "İYUK",
        "description": "Üst makama başvuru süresi.",
        "rules": [
            {
                "name": "Başvuru süresi",
                "law_reference": "İYUK md. 11",
                "duration_value": 60,
                "duration_unit": "gun",
                "duration_display": "60 gün",
                "deadline_type": "usul_suresi",
                "affected_by_adli_tatil": True,
                "affected_by_holidays": True,
            },
        ],
    },
    # ── İİK ───────────────────────────────────────────────────────────────
    {
        "slug": "iik_odeme_emri",
        "name": "Ödeme Emri Tebliği (Genel Haciz)",
        "category": "İİK",
        "description": "Genel haciz yoluyla takipte ödeme emri tebliği üzerine süreler.",
        "rules": [
            {
                "name": "İtiraz süresi",
                "law_reference": "İİK md. 62",
                "duration_value": 7,
                "duration_unit": "gun",
                "duration_display": "7 gün",
                "deadline_type": "hak_dusurucusu",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": True,
            },
            {
                "name": "İtirazın iptali davası süresi",
                "law_reference": "İİK md. 67",
                "duration_value": 1,
                "duration_unit": "yil",
                "duration_display": "1 yıl",
                "deadline_type": "hak_dusurucusu",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
            {
                "name": "İtirazın kaldırılması süresi",
                "law_reference": "İİK md. 68",
                "duration_value": 6,
                "duration_unit": "ay",
                "duration_display": "6 ay",
                "deadline_type": "hak_dusurucusu",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
        ],
    },
    {
        "slug": "iik_kambiyo_odeme",
        "name": "Kambiyo Senetlerine Özgü Ödeme Emri",
        "category": "İİK",
        "description": "Kambiyo senetlerine özgü haciz yoluyla takipte ödeme emri tebliği.",
        "rules": [
            {
                "name": "İtiraz süresi",
                "law_reference": "İİK md. 168",
                "duration_value": 5,
                "duration_unit": "gun",
                "duration_display": "5 gün",
                "deadline_type": "hak_dusurucusu",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": True,
            },
        ],
    },
    {
        "slug": "iik_tahliye_emri",
        "name": "Tahliye Emri Tebliği",
        "category": "İİK",
        "description": "Tahliye emrinin tebliği üzerine itiraz süresi.",
        "rules": [
            {
                "name": "İtiraz süresi",
                "law_reference": "İİK md. 272",
                "duration_value": 7,
                "duration_unit": "gun",
                "duration_display": "7 gün",
                "deadline_type": "hak_dusurucusu",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": True,
            },
        ],
    },
    {
        "slug": "iik_satis_ilani",
        "name": "Satış İlanı Tebliği",
        "category": "İİK",
        "description": "İcra satış ilanı — bilgi amaçlı kayıt.",
        "rules": [
            {
                "name": "İhale tarihi (bilgi amaçlı)",
                "law_reference": "İİK md. 114",
                "duration_value": 0,
                "duration_unit": "bilgi",
                "duration_display": "Bilgi amaçlı",
                "deadline_type": "bilgi",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
        ],
    },
    {
        "slug": "iik_haciz_tutanagi",
        "name": "Haciz İşlemi",
        "category": "İİK",
        "description": "Haciz işlemi sonrası istihkak iddiası süresi.",
        "rules": [
            {
                "name": "İstihkak iddiası süresi",
                "law_reference": "İİK md. 96",
                "duration_value": 7,
                "duration_unit": "gun",
                "duration_display": "7 gün",
                "deadline_type": "hak_dusurucusu",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": True,
            },
        ],
    },
    {
        "slug": "iik_iflas_teblig",
        "name": "İflas Kararı Tebliği",
        "category": "İİK",
        "description": "İflas kararının tebliği üzerine kanun yolu süresi.",
        "rules": [
            {
                "name": "İstinaf süresi",
                "law_reference": "İİK md. 164",
                "duration_value": 10,
                "duration_unit": "gun",
                "duration_display": "10 gün",
                "deadline_type": "usul_suresi",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": True,
            },
        ],
    },
    {
        "slug": "iik_konkordato",
        "name": "Konkordato",
        "category": "İİK",
        "description": "Konkordato mühletinden itibaren proje sunma süresi.",
        "rules": [
            {
                "name": "Konkordato projesi sunma süresi",
                "law_reference": "İİK md. 285",
                "duration_value": 3,
                "duration_unit": "ay",
                "duration_display": "3 ay",
                "deadline_type": "usul_suresi",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
        ],
    },
    {
        "slug": "iik_sira_cetveli_teblig",
        "name": "Sıra Cetveli Tebliği",
        "category": "İİK",
        "description": "Sıra cetvelinin tebliği üzerine itiraz süresi.",
        "rules": [
            {
                "name": "İtiraz süresi",
                "law_reference": "İİK md. 142",
                "duration_value": 7,
                "duration_unit": "gun",
                "duration_display": "7 gün",
                "deadline_type": "hak_dusurucusu",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": True,
            },
        ],
    },
    {
        "slug": "iik_rehin_acigi",
        "name": "Rehin Açığı Belgesi",
        "category": "İİK",
        "description": "Rehin açığı belgesi — bilgi amaçlı kayıt.",
        "rules": [
            {
                "name": "Borç ödemeden aciz belgesi (bilgi amaçlı)",
                "law_reference": "İİK md. 143",
                "duration_value": 0,
                "duration_unit": "bilgi",
                "duration_display": "Bilgi amaçlı",
                "deadline_type": "bilgi",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
        ],
    },
    # ── İş Kanunu ─────────────────────────────────────────────────────────
    {
        "slug": "is_fesih_teblig",
        "name": "İş Sözleşmesi Fesih Tebliği",
        "category": "İş Kanunu",
        "description": "İş sözleşmesinin feshi üzerine başlayan süreler.",
        "rules": [
            {
                "name": "Arabuluculuk başvuru süresi",
                "law_reference": "4857 md. 20",
                "duration_value": 1,
                "duration_unit": "ay",
                "duration_display": "1 ay",
                "deadline_type": "hak_dusurucusu",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
            {
                "name": "Arabuluculuk sonrası dava açma süresi",
                "law_reference": "7036 md. 3",
                "duration_value": 2,
                "duration_unit": "hafta",
                "duration_display": "2 hafta",
                "deadline_type": "hak_dusurucusu",
                "affected_by_adli_tatil": True,
                "affected_by_holidays": True,
            },
            {
                "name": "Kıdem/İhbar tazminatı zamanaşımı",
                "law_reference": "4857 md. 32",
                "duration_value": 5,
                "duration_unit": "yil",
                "duration_display": "5 yıl",
                "deadline_type": "zamanasimai",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
        ],
    },
    {
        "slug": "is_kazasi",
        "name": "İş Kazası",
        "category": "İş Kanunu",
        "description": "İş kazası sonrası bildirim ve tazminat süreleri.",
        "rules": [
            {
                "name": "SGK bildirim süresi",
                "law_reference": "5510 md. 13",
                "duration_value": 3,
                "duration_unit": "is_gunu",
                "duration_display": "3 iş günü",
                "deadline_type": "bildirim",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": True,
            },
            {
                "name": "Maddi tazminat zamanaşımı",
                "law_reference": "TBK md. 72",
                "duration_value": 2,
                "duration_unit": "yil",
                "duration_display": "2 yıl",
                "deadline_type": "zamanasimai",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
            {
                "name": "Manevi tazminat zamanaşımı",
                "law_reference": "TBK md. 72",
                "duration_value": 2,
                "duration_unit": "yil",
                "duration_display": "2 yıl",
                "deadline_type": "zamanasimai",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
            {
                "name": "Mutlak zamanaşımı",
                "law_reference": "TBK md. 72",
                "duration_value": 10,
                "duration_unit": "yil",
                "duration_display": "10 yıl",
                "deadline_type": "zamanasimai",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
        ],
    },
    {
        "slug": "is_meslek_hastaligi",
        "name": "Meslek Hastalığı Tespiti",
        "category": "İş Kanunu",
        "description": "Meslek hastalığı tespiti sonrası bildirim ve tazminat süreleri.",
        "rules": [
            {
                "name": "SGK bildirim süresi",
                "law_reference": "5510 md. 14",
                "duration_value": 3,
                "duration_unit": "is_gunu",
                "duration_display": "3 iş günü",
                "deadline_type": "bildirim",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": True,
            },
            {
                "name": "Tazminat zamanaşımı",
                "law_reference": "TBK md. 72",
                "duration_value": 2,
                "duration_unit": "yil",
                "duration_display": "2 yıl",
                "deadline_type": "zamanasimai",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
        ],
    },
    {
        "slug": "is_arabuluculuk_son",
        "name": "Arabuluculuk Son Tutanağı (İş)",
        "category": "İş Kanunu",
        "description": "İş hukuku arabuluculuk son tutanağı sonrası dava açma süresi.",
        "rules": [
            {
                "name": "Dava açma süresi",
                "law_reference": "7036 md. 3",
                "duration_value": 2,
                "duration_unit": "hafta",
                "duration_display": "2 hafta",
                "deadline_type": "hak_dusurucusu",
                "affected_by_adli_tatil": True,
                "affected_by_holidays": True,
            },
        ],
    },
    {
        "slug": "is_toplu_is_uyusmazlik",
        "name": "Toplu İş Uyuşmazlığı",
        "category": "İş Kanunu",
        "description": "Toplu iş uyuşmazlığı sonrası grev kararı süresi.",
        "rules": [
            {
                "name": "Grev kararı süresi",
                "law_reference": "6356 md. 60",
                "duration_value": 60,
                "duration_unit": "gun",
                "duration_display": "60 gün",
                "deadline_type": "hak_dusurucusu",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
        ],
    },
    {
        "slug": "is_fazla_mesai",
        "name": "Fazla Mesai Alacağı",
        "category": "İş Kanunu",
        "description": "Fazla mesai alacağı zamanaşımı.",
        "rules": [
            {
                "name": "Zamanaşımı süresi",
                "law_reference": "4857 md. 32",
                "duration_value": 5,
                "duration_unit": "yil",
                "duration_display": "5 yıl",
                "deadline_type": "zamanasimai",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
        ],
    },
    {
        "slug": "is_yillik_izin",
        "name": "Yıllık İzin Ücreti",
        "category": "İş Kanunu",
        "description": "Yıllık izin ücreti alacağı zamanaşımı.",
        "rules": [
            {
                "name": "Zamanaşımı süresi",
                "law_reference": "4857 md. 59",
                "duration_value": 5,
                "duration_unit": "yil",
                "duration_display": "5 yıl",
                "deadline_type": "zamanasimai",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
        ],
    },
    # ── TMK ───────────────────────────────────────────────────────────────
    {
        "slug": "tmk_bosanma_karar",
        "name": "Boşanma Kararı Tebliği",
        "category": "TMK",
        "description": "Boşanma kararının tebliği üzerine kanun yolu süreleri.",
        "rules": [
            {
                "name": "İstinaf süresi",
                "law_reference": "HMK md. 345",
                "duration_value": 2,
                "duration_unit": "hafta",
                "duration_display": "2 hafta",
                "deadline_type": "usul_suresi",
                "affected_by_adli_tatil": True,
                "affected_by_holidays": True,
            },
            {
                "name": "Temyiz süresi",
                "law_reference": "HMK md. 361",
                "duration_value": 2,
                "duration_unit": "hafta",
                "duration_display": "2 hafta",
                "deadline_type": "usul_suresi",
                "affected_by_adli_tatil": True,
                "affected_by_holidays": True,
            },
        ],
    },
    {
        "slug": "tmk_aldatma_ogrenme",
        "name": "Aldatmanın Öğrenilmesi",
        "category": "TMK",
        "description": "Aldatma fiilinin öğrenilmesi üzerine boşanma davası süreleri.",
        "rules": [
            {
                "name": "Dava hakkı süresi",
                "law_reference": "TMK md. 161",
                "duration_value": 6,
                "duration_unit": "ay",
                "duration_display": "6 ay",
                "deadline_type": "hak_dusurucusu",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
            {
                "name": "Mutlak süre",
                "law_reference": "TMK md. 161",
                "duration_value": 5,
                "duration_unit": "yil",
                "duration_display": "5 yıl",
                "deadline_type": "hak_dusurucusu",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
        ],
    },
    {
        "slug": "tmk_nafaka_karar",
        "name": "Nafaka Kararı",
        "category": "TMK",
        "description": "Nafaka kararı — artırım/azaltma davası bilgi amaçlı.",
        "rules": [
            {
                "name": "Artırım/azaltma davası (koşullar değiştiğinde)",
                "law_reference": "TMK md. 176",
                "duration_value": 0,
                "duration_unit": "bilgi",
                "duration_display": "Süresiz (koşullar değiştiğinde)",
                "deadline_type": "bilgi",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
        ],
    },
    {
        "slug": "tmk_velayet_karar",
        "name": "Velayet Kararı",
        "category": "TMK",
        "description": "Velayet kararının tebliği üzerine kanun yolu süresi.",
        "rules": [
            {
                "name": "İstinaf süresi",
                "law_reference": "HMK md. 345",
                "duration_value": 2,
                "duration_unit": "hafta",
                "duration_display": "2 hafta",
                "deadline_type": "usul_suresi",
                "affected_by_adli_tatil": True,
                "affected_by_holidays": True,
            },
        ],
    },
    {
        "slug": "tmk_soybagi_ogrenme",
        "name": "Soybağının Reddi (Öğrenme)",
        "category": "TMK",
        "description": "Soybağının reddine ilişkin dava açma süresi.",
        "rules": [
            {
                "name": "Dava açma süresi",
                "law_reference": "TMK md. 289",
                "duration_value": 1,
                "duration_unit": "yil",
                "duration_display": "1 yıl",
                "deadline_type": "hak_dusurucusu",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
        ],
    },
    {
        "slug": "tmk_miras_ogrenme",
        "name": "Mirasın Reddi (Ölümün Öğrenilmesi)",
        "category": "TMK",
        "description": "Mirasın reddi için süre — ölümün öğrenilmesinden itibaren.",
        "rules": [
            {
                "name": "Ret süresi",
                "law_reference": "TMK md. 606",
                "duration_value": 3,
                "duration_unit": "ay",
                "duration_display": "3 ay",
                "deadline_type": "hak_dusurucusu",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
        ],
    },
    # ── TTK ───────────────────────────────────────────────────────────────
    {
        "slug": "ttk_genel_kurul_karari",
        "name": "Genel Kurul Kararı",
        "category": "TTK",
        "description": "Genel kurul kararına karşı iptal davası süresi.",
        "rules": [
            {
                "name": "İptal davası süresi",
                "law_reference": "TTK md. 445",
                "duration_value": 3,
                "duration_unit": "ay",
                "duration_display": "3 ay",
                "deadline_type": "hak_dusurucusu",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
        ],
    },
    {
        "slug": "ttk_haksiz_rekabet",
        "name": "Haksız Rekabet Öğrenme",
        "category": "TTK",
        "description": "Haksız rekabetin öğrenilmesi üzerine dava zamanaşımı.",
        "rules": [
            {
                "name": "Dava zamanaşımı",
                "law_reference": "TTK md. 60",
                "duration_value": 1,
                "duration_unit": "yil",
                "duration_display": "1 yıl",
                "deadline_type": "zamanasimai",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
            {
                "name": "Mutlak zamanaşımı",
                "law_reference": "TTK md. 60",
                "duration_value": 3,
                "duration_unit": "yil",
                "duration_display": "3 yıl",
                "deadline_type": "zamanasimai",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
        ],
    },
    {
        "slug": "ttk_iflas_karari",
        "name": "Ticari İflas Kararı",
        "category": "TTK",
        "description": "Ticari iflas kararının tebliği üzerine kanun yolu süresi.",
        "rules": [
            {
                "name": "İstinaf süresi",
                "law_reference": "İİK md. 164",
                "duration_value": 10,
                "duration_unit": "gun",
                "duration_display": "10 gün",
                "deadline_type": "usul_suresi",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": True,
            },
        ],
    },
    {
        "slug": "ttk_ortakliktan_cikma",
        "name": "Ortaklıktan Çıkma/Çıkarılma",
        "category": "TTK",
        "description": "Ortaklıktan çıkma veya çıkarılma davası süresi.",
        "rules": [
            {
                "name": "Dava açma süresi",
                "law_reference": "TTK md. 638",
                "duration_value": 3,
                "duration_unit": "ay",
                "duration_display": "3 ay",
                "deadline_type": "hak_dusurucusu",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
        ],
    },
    {
        "slug": "ttk_sigorta_ihbar",
        "name": "Sigorta Rizikonun İhbarı",
        "category": "TTK",
        "description": "Sigorta rizikosu gerçekleştiğinde ihbar süresi.",
        "rules": [
            {
                "name": "İhbar süresi",
                "law_reference": "TTK md. 1446",
                "duration_value": 5,
                "duration_unit": "gun",
                "duration_display": "5 gün",
                "deadline_type": "bildirim",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
        ],
    },
    {
        "slug": "ttk_kambiyo_protesto",
        "name": "Kambiyo Senedi Protesto",
        "category": "TTK",
        "description": "Kambiyo senedi protestosu — ibraz süresi senet türüne göre değişir.",
        "rules": [
            {
                "name": "İbraz süresi (senet türüne göre değişir)",
                "law_reference": "TTK md. 708-714",
                "duration_value": 0,
                "duration_unit": "bilgi",
                "duration_display": "Senet türüne göre değişir",
                "deadline_type": "bilgi",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
        ],
    },
    # ── TBK Kira ──────────────────────────────────────────────────────────
    {
        "slug": "tbk_kira_baslangic",
        "name": "Kira Sözleşmesi Başlangıcı",
        "category": "TBK Kira",
        "description": "Kira sözleşmesi başlangıcından itibaren süreler.",
        "rules": [
            {
                "name": "Tahliye davası süresi (kira yılı sonu + 1 ay)",
                "law_reference": "TBK md. 347",
                "duration_value": 0,
                "duration_unit": "bilgi",
                "duration_display": "Kira yılı sonu + 1 ay içinde",
                "deadline_type": "bilgi",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
                "note": "10 yıllık uzama süresinin bitiminden itibaren her uzama yılının sonunda 1 ay içinde açılmalıdır.",
            },
            {
                "name": "Kira tespit davası (yeni dönemden 30 gün önce)",
                "law_reference": "TBK md. 344",
                "duration_value": 30,
                "duration_unit": "gun",
                "duration_display": "Yeni dönemden 30 gün önce",
                "deadline_type": "usul_suresi",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
                "note": "Yeni kira döneminin başlangıcından en geç 30 gün öncesine kadar açılmalı veya ihtarname gönderilmelidir.",
            },
        ],
    },
    {
        "slug": "tbk_kira_ihtarname",
        "name": "Kira Ödenmemesi İhtarnamesi",
        "category": "TBK Kira",
        "description": "Kira bedelinin ödenmemesi üzerine ihtarname ile verilen süre.",
        "rules": [
            {
                "name": "Ödeme süresi",
                "law_reference": "TBK md. 315",
                "duration_value": 30,
                "duration_unit": "gun",
                "duration_display": "30 gün",
                "deadline_type": "usul_suresi",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
        ],
    },
    {
        "slug": "tbk_kira_tahliye_taahhut",
        "name": "Tahliye Taahhüdü Tarihi",
        "category": "TBK Kira",
        "description": "Tahliye taahhüdünde belirtilen tarih üzerine dava açma süresi.",
        "rules": [
            {
                "name": "Tahliye davası açma süresi",
                "law_reference": "TBK md. 352",
                "duration_value": 1,
                "duration_unit": "ay",
                "duration_display": "1 ay",
                "deadline_type": "hak_dusurucusu",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
        ],
    },
    {
        "slug": "tbk_iki_hakli_ihtar",
        "name": "İki Haklı İhtar",
        "category": "TBK Kira",
        "description": "İki haklı ihtar sonrası tahliye davası — bilgi amaçlı.",
        "rules": [
            {
                "name": "Kira dönemi sonu dava açma (bilgi amaçlı)",
                "law_reference": "TBK md. 352",
                "duration_value": 0,
                "duration_unit": "bilgi",
                "duration_display": "Kira dönemi sonunda",
                "deadline_type": "bilgi",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
        ],
    },
    {
        "slug": "tbk_kira_artis",
        "name": "Kira Artış Bildirimi",
        "category": "TBK Kira",
        "description": "Kira artışına ilişkin tespit davası süresi.",
        "rules": [
            {
                "name": "5 yıllık yenileme davası",
                "law_reference": "TBK md. 344",
                "duration_value": 0,
                "duration_unit": "bilgi",
                "duration_display": "5 yıldan uzun süreli kiralarda",
                "deadline_type": "bilgi",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
                "note": "5 yıldan uzun süreli kira ilişkilerinde, yeni dönemin başlangıcından en geç 30 gün önce dava açılmalıdır.",
            },
        ],
    },
    # ── Tüketici ──────────────────────────────────────────────────────────
    {
        "slug": "tuketici_ayipli_mal",
        "name": "Ayıplı Mal Teslimi",
        "category": "Tüketici",
        "description": "Ayıplı mal teslimi üzerine bildirim ve zamanaşımı süreleri.",
        "rules": [
            {
                "name": "Bildirim süresi",
                "law_reference": "TKHK md. 10",
                "duration_value": 30,
                "duration_unit": "gun",
                "duration_display": "30 gün",
                "deadline_type": "bildirim",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
            {
                "name": "Zamanaşımı süresi",
                "law_reference": "TKHK md. 12",
                "duration_value": 2,
                "duration_unit": "yil",
                "duration_display": "2 yıl",
                "deadline_type": "zamanasimai",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
        ],
    },
    {
        "slug": "tuketici_cayma",
        "name": "Mesafeli Satış / Cayma Hakkı",
        "category": "Tüketici",
        "description": "Mesafeli satışlarda cayma hakkı süresi.",
        "rules": [
            {
                "name": "Cayma süresi",
                "law_reference": "Mesafeli Sözleşmeler Yönetmeliği md. 9",
                "duration_value": 14,
                "duration_unit": "gun",
                "duration_display": "14 gün",
                "deadline_type": "hak_dusurucusu",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
        ],
    },
    {
        "slug": "tuketici_taksitli_satis",
        "name": "Taksitli Satış",
        "category": "Tüketici",
        "description": "Taksitli satışlarda cayma hakkı süresi.",
        "rules": [
            {
                "name": "Cayma süresi",
                "law_reference": "TKHK md. 18",
                "duration_value": 7,
                "duration_unit": "gun",
                "duration_display": "7 gün",
                "deadline_type": "hak_dusurucusu",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
        ],
    },
    {
        "slug": "tuketici_arabuluculuk",
        "name": "Tüketici Arabuluculuk Son Tutanağı",
        "category": "Tüketici",
        "description": "Tüketici arabuluculuk son tutanağı sonrası dava açma süresi.",
        "rules": [
            {
                "name": "Dava açma süresi",
                "law_reference": "7036 md. 3",
                "duration_value": 2,
                "duration_unit": "hafta",
                "duration_display": "2 hafta",
                "deadline_type": "hak_dusurucusu",
                "affected_by_adli_tatil": True,
                "affected_by_holidays": True,
            },
        ],
    },
    {
        "slug": "tuketici_garanti_suresi",
        "name": "Garanti Süresi Başlangıcı",
        "category": "Tüketici",
        "description": "Garanti süresi — bilgi amaçlı.",
        "rules": [
            {
                "name": "Garanti süresi (bilgi amaçlı)",
                "law_reference": "TKHK md. 56",
                "duration_value": 2,
                "duration_unit": "yil",
                "duration_display": "2 yıl",
                "deadline_type": "bilgi",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
        ],
    },
    {
        "slug": "tuketici_paket_tur",
        "name": "Paket Tur İptali",
        "category": "Tüketici",
        "description": "Paket tur iptali bildirimi — bilgi amaçlı.",
        "rules": [
            {
                "name": "İptal bildirimi (bilgi amaçlı)",
                "law_reference": "TKHK md. 51",
                "duration_value": 0,
                "duration_unit": "bilgi",
                "duration_display": "Bilgi amaçlı",
                "deadline_type": "bilgi",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
        ],
    },
    # ── Vergi ─────────────────────────────────────────────────────────────
    {
        "slug": "vergi_ihbarname_teblig",
        "name": "Vergi/Ceza İhbarnamesi",
        "category": "Vergi",
        "description": "Vergi veya ceza ihbarnamesinin tebliği üzerine başlayan süreler.",
        "rules": [
            {
                "name": "Dava açma süresi",
                "law_reference": "İYUK md. 7",
                "duration_value": 30,
                "duration_unit": "gun",
                "duration_display": "30 gün",
                "deadline_type": "hak_dusurucusu",
                "affected_by_adli_tatil": True,
                "affected_by_holidays": True,
            },
            {
                "name": "Uzlaşma başvuru süresi",
                "law_reference": "VUK md. ek 1",
                "duration_value": 30,
                "duration_unit": "gun",
                "duration_display": "30 gün",
                "deadline_type": "hak_dusurucusu",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": True,
            },
        ],
    },
    {
        "slug": "vergi_odeme_emri",
        "name": "Vergi Ödeme Emri",
        "category": "Vergi",
        "description": "Vergi ödeme emri tebliği üzerine dava açma süresi.",
        "rules": [
            {
                "name": "Dava açma süresi",
                "law_reference": "AATUHK md. 58",
                "duration_value": 15,
                "duration_unit": "gun",
                "duration_display": "15 gün",
                "deadline_type": "hak_dusurucusu",
                "affected_by_adli_tatil": True,
                "affected_by_holidays": True,
            },
        ],
    },
    {
        "slug": "vergi_haciz",
        "name": "Vergi Haczi",
        "category": "Vergi",
        "description": "Vergi haczi işlemine itiraz süresi.",
        "rules": [
            {
                "name": "İtiraz süresi",
                "law_reference": "AATUHK md. 15",
                "duration_value": 30,
                "duration_unit": "gun",
                "duration_display": "30 gün",
                "deadline_type": "usul_suresi",
                "affected_by_adli_tatil": True,
                "affected_by_holidays": True,
            },
        ],
    },
    {
        "slug": "vergi_uzlasma_tutanak",
        "name": "Uzlaşma Tutanağı",
        "category": "Vergi",
        "description": "Uzlaşma tutanağı — kesinleşme bilgi amaçlı.",
        "rules": [
            {
                "name": "Uzlaşma kesinleşme (bilgi amaçlı)",
                "law_reference": "VUK ek md. 1-12",
                "duration_value": 0,
                "duration_unit": "bilgi",
                "duration_display": "Bilgi amaçlı",
                "deadline_type": "bilgi",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
        ],
    },
    {
        "slug": "vergi_tarhiyat_oncesi",
        "name": "Tarhiyat Öncesi Uzlaşma Daveti",
        "category": "Vergi",
        "description": "Tarhiyat öncesi uzlaşma daveti — katılma bilgi amaçlı.",
        "rules": [
            {
                "name": "Katılma (bilgi amaçlı)",
                "law_reference": "VUK ek md. 11",
                "duration_value": 0,
                "duration_unit": "bilgi",
                "duration_display": "Bilgi amaçlı",
                "deadline_type": "bilgi",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
        ],
    },
    {
        "slug": "vergi_inceleme_tutanak",
        "name": "Vergi İnceleme Tutanağı",
        "category": "Vergi",
        "description": "Vergi inceleme tutanağına itiraz süresi.",
        "rules": [
            {
                "name": "İtiraz süresi",
                "law_reference": "VUK md. 378",
                "duration_value": 30,
                "duration_unit": "gun",
                "duration_display": "30 gün",
                "deadline_type": "usul_suresi",
                "affected_by_adli_tatil": True,
                "affected_by_holidays": True,
            },
        ],
    },
    # ── Fikri Mülkiyet ───────────────────────────────────────────────────
    {
        "slug": "fikri_marka_itiraz",
        "name": "Marka Başvurusu İtiraz",
        "category": "Fikri Mülkiyet",
        "description": "Marka başvurusuna itiraz süresi.",
        "rules": [
            {
                "name": "İtiraz süresi",
                "law_reference": "SMK md. 18",
                "duration_value": 2,
                "duration_unit": "ay",
                "duration_display": "2 ay",
                "deadline_type": "hak_dusurucusu",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
        ],
    },
    {
        "slug": "fikri_patent_yayin",
        "name": "Patent Başvurusu Yayını",
        "category": "Fikri Mülkiyet",
        "description": "Patent başvurusu yayınına itiraz süresi.",
        "rules": [
            {
                "name": "İtiraz süresi",
                "law_reference": "SMK md. 99",
                "duration_value": 6,
                "duration_unit": "ay",
                "duration_display": "6 ay",
                "deadline_type": "hak_dusurucusu",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
        ],
    },
    {
        "slug": "fikri_telif_ihlal",
        "name": "Telif Hakkı İhlali Öğrenme",
        "category": "Fikri Mülkiyet",
        "description": "Telif hakkı ihlalinin öğrenilmesi üzerine zamanaşımı.",
        "rules": [
            {
                "name": "Zamanaşımı süresi",
                "law_reference": "FSEK md. 70",
                "duration_value": 2,
                "duration_unit": "yil",
                "duration_display": "2 yıl",
                "deadline_type": "zamanasimai",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
        ],
    },
    {
        "slug": "fikri_marka_iptal",
        "name": "Marka İptal/Hükümsüzlük",
        "category": "Fikri Mülkiyet",
        "description": "Marka iptal veya hükümsüzlük davası süresi.",
        "rules": [
            {
                "name": "Dava açma süresi",
                "law_reference": "SMK md. 26",
                "duration_value": 5,
                "duration_unit": "yil",
                "duration_display": "5 yıl",
                "deadline_type": "hak_dusurucusu",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
        ],
    },
    {
        "slug": "fikri_endustriyel",
        "name": "Endüstriyel Tasarım İtiraz",
        "category": "Fikri Mülkiyet",
        "description": "Endüstriyel tasarım başvurusuna itiraz süresi.",
        "rules": [
            {
                "name": "İtiraz süresi",
                "law_reference": "SMK md. 67",
                "duration_value": 6,
                "duration_unit": "ay",
                "duration_display": "6 ay",
                "deadline_type": "hak_dusurucusu",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
        ],
    },
    # ── Genel ─────────────────────────────────────────────────────────────
    {
        "slug": "genel_temerrut",
        "name": "Temerrüt İhtarnamesi",
        "category": "Genel",
        "description": "Temerrüt ihtarnamesi ile verilen ödeme süresi.",
        "rules": [
            {
                "name": "Ödeme süresi",
                "law_reference": "TBK md. 117",
                "duration_value": 30,
                "duration_unit": "gun",
                "duration_display": "30 gün",
                "deadline_type": "usul_suresi",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
            },
        ],
    },
    {
        "slug": "genel_sulh",
        "name": "Sulh Görüşmesi",
        "category": "Genel",
        "description": "Sulh görüşmesi — zamanaşımı durması bilgi amaçlı.",
        "rules": [
            {
                "name": "Zamanaşımı durması (bilgi amaçlı)",
                "law_reference": "TBK md. 153",
                "duration_value": 0,
                "duration_unit": "bilgi",
                "duration_display": "Bilgi amaçlı",
                "deadline_type": "bilgi",
                "affected_by_adli_tatil": False,
                "affected_by_holidays": False,
                "note": "Sulh görüşmeleri devam ettiği sürece zamanaşımı durur.",
            },
        ],
    },
]


# ═══════════════════════════════════════════════════════════════════════════
# PUBLIC HOLIDAYS 2025-2028
# ═══════════════════════════════════════════════════════════════════════════

FIXED_HOLIDAYS = [
    (1, 1, "Yılbaşı"),
    (4, 23, "Ulusal Egemenlik ve Çocuk Bayramı"),
    (5, 1, "Emek ve Dayanışma Günü"),
    (5, 19, "Atatürk'ü Anma, Gençlik ve Spor Bayramı"),
    (7, 15, "Demokrasi ve Millî Birlik Günü"),
    (8, 30, "Zafer Bayramı"),
    (10, 29, "Cumhuriyet Bayramı"),
]

RELIGIOUS_HOLIDAYS: dict[int, list[tuple[int, int, str, bool]]] = {
    # (month, day, name, is_half_day)
    2025: [
        (3, 29, "Ramazan Bayramı Arifesi", True),
        (3, 30, "Ramazan Bayramı 1. Gün", False),
        (3, 31, "Ramazan Bayramı 2. Gün", False),
        (4, 1, "Ramazan Bayramı 3. Gün", False),
        (6, 5, "Kurban Bayramı Arifesi", True),
        (6, 6, "Kurban Bayramı 1. Gün", False),
        (6, 7, "Kurban Bayramı 2. Gün", False),
        (6, 8, "Kurban Bayramı 3. Gün", False),
        (6, 9, "Kurban Bayramı 4. Gün", False),
    ],
    2026: [
        (3, 19, "Ramazan Bayramı Arifesi", True),
        (3, 20, "Ramazan Bayramı 1. Gün", False),
        (3, 21, "Ramazan Bayramı 2. Gün", False),
        (3, 22, "Ramazan Bayramı 3. Gün", False),
        (5, 26, "Kurban Bayramı Arifesi", True),
        (5, 27, "Kurban Bayramı 1. Gün", False),
        (5, 28, "Kurban Bayramı 2. Gün", False),
        (5, 29, "Kurban Bayramı 3. Gün", False),
        (5, 30, "Kurban Bayramı 4. Gün", False),
    ],
    2027: [
        (3, 8, "Ramazan Bayramı Arifesi", True),
        (3, 9, "Ramazan Bayramı 1. Gün", False),
        (3, 10, "Ramazan Bayramı 2. Gün", False),
        (3, 11, "Ramazan Bayramı 3. Gün", False),
        (5, 15, "Kurban Bayramı Arifesi", True),
        (5, 16, "Kurban Bayramı 1. Gün", False),
        (5, 17, "Kurban Bayramı 2. Gün", False),
        (5, 18, "Kurban Bayramı 3. Gün", False),
        (5, 19, "Kurban Bayramı 4. Gün", False),
    ],
    2028: [
        (2, 26, "Ramazan Bayramı Arifesi", True),
        (2, 27, "Ramazan Bayramı 1. Gün", False),
        (2, 28, "Ramazan Bayramı 2. Gün", False),
        (2, 29, "Ramazan Bayramı 3. Gün", False),
        (5, 3, "Kurban Bayramı Arifesi", True),
        (5, 4, "Kurban Bayramı 1. Gün", False),
        (5, 5, "Kurban Bayramı 2. Gün", False),
        (5, 6, "Kurban Bayramı 3. Gün", False),
        (5, 7, "Kurban Bayramı 4. Gün", False),
    ],
}


def build_holidays() -> list[dict]:
    """Build the full list of public holidays for 2025-2028."""
    holidays = []
    for year in range(2025, 2029):
        # Fixed holidays
        for month, day, name in FIXED_HOLIDAYS:
            holidays.append({
                "date": date(year, month, day),
                "name": name,
                "year": year,
                "is_half_day": False,
                "holiday_type": "resmi",
            })
        # Religious holidays
        for month, day, name, is_half in RELIGIOUS_HOLIDAYS[year]:
            holidays.append({
                "date": date(year, month, day),
                "name": name,
                "year": year,
                "is_half_day": is_half,
                "holiday_type": "dini",
            })
    return holidays


# ═══════════════════════════════════════════════════════════════════════════
# JUDICIAL RECESSES 2025-2028
# ═══════════════════════════════════════════════════════════════════════════

JUDICIAL_RECESSES = [
    {
        "year": y,
        "start_date": date(y, 7, 20),
        "end_date": date(y, 8, 31),
        "extension_days_hukuk": 7,
        "extension_days_ceza": 3,
        "extension_days_idari": 7,
        "note": f"{y} yılı adli tatil dönemi (20 Temmuz - 31 Ağustos)",
    }
    for y in range(2025, 2029)
]


# ═══════════════════════════════════════════════════════════════════════════
# MAIN SEED FUNCTION
# ═══════════════════════════════════════════════════════════════════════════

async def seed():
    async with async_session() as session:
        # ── 1. Event Types + Rules ────────────────────────────────────────
        print("=" * 60)
        print("Olay türleri ve süre kuralları yükleniyor...")
        print("=" * 60)

        event_type_count = 0
        rule_count = 0
        skipped_event_types = 0

        for order, et_data in enumerate(EVENT_TYPES):
            # Check if slug already exists
            existing = await session.execute(
                select(EventTypeDefinition).where(
                    EventTypeDefinition.slug == et_data["slug"]
                )
            )
            if existing.scalar_one_or_none() is not None:
                skipped_event_types += 1
                print(f"  [SKIP] {et_data['slug']} zaten mevcut")
                continue

            et = EventTypeDefinition(
                id=uuid.uuid4(),
                slug=et_data["slug"],
                name=et_data["name"],
                description=et_data.get("description"),
                category=et_data["category"],
                is_active=True,
                display_order=order,
            )
            session.add(et)
            event_type_count += 1

            for rule_order, rule_data in enumerate(et_data.get("rules", [])):
                rule = DeadlineRuleDefinition(
                    id=uuid.uuid4(),
                    event_type_id=et.id,
                    name=rule_data["name"],
                    law_reference=rule_data.get("law_reference"),
                    law_text=rule_data.get("law_text"),
                    duration_value=rule_data["duration_value"],
                    duration_unit=rule_data["duration_unit"],
                    duration_display=rule_data.get("duration_display"),
                    deadline_type=rule_data["deadline_type"],
                    affected_by_adli_tatil=rule_data.get("affected_by_adli_tatil", True),
                    affected_by_holidays=rule_data.get("affected_by_holidays", True),
                    is_active=True,
                    display_order=rule_order,
                    note=rule_data.get("note"),
                )
                session.add(rule)
                rule_count += 1

            print(f"  [OK] {et_data['slug']} ({et_data['category']}) — {len(et_data.get('rules', []))} kural")

        await session.flush()
        print(f"\nOlay türleri: {event_type_count} eklendi, {skipped_event_types} atlandı")
        print(f"Süre kuralları: {rule_count} eklendi")

        # ── 2. Public Holidays ────────────────────────────────────────────
        print("\n" + "=" * 60)
        print("Resmi tatiller yükleniyor (2025-2028)...")
        print("=" * 60)

        holidays = build_holidays()
        holiday_count = 0
        skipped_holidays = 0

        for h in holidays:
            existing = await session.execute(
                select(PublicHoliday).where(
                    PublicHoliday.date == h["date"],
                    PublicHoliday.name == h["name"],
                )
            )
            if existing.scalar_one_or_none() is not None:
                skipped_holidays += 1
                continue

            ph = PublicHoliday(
                id=uuid.uuid4(),
                date=h["date"],
                name=h["name"],
                year=h["year"],
                is_half_day=h["is_half_day"],
                holiday_type=h["holiday_type"],
            )
            session.add(ph)
            holiday_count += 1

        await session.flush()
        print(f"Resmi tatiller: {holiday_count} eklendi, {skipped_holidays} atlandı")

        # ── 3. Judicial Recesses ──────────────────────────────────────────
        print("\n" + "=" * 60)
        print("Adli tatil dönemleri yükleniyor (2025-2028)...")
        print("=" * 60)

        recess_count = 0
        skipped_recesses = 0

        for jr_data in JUDICIAL_RECESSES:
            existing = await session.execute(
                select(JudicialRecess).where(
                    JudicialRecess.year == jr_data["year"]
                )
            )
            if existing.scalar_one_or_none() is not None:
                skipped_recesses += 1
                print(f"  [SKIP] {jr_data['year']} zaten mevcut")
                continue

            jr = JudicialRecess(
                id=uuid.uuid4(),
                year=jr_data["year"],
                start_date=jr_data["start_date"],
                end_date=jr_data["end_date"],
                extension_days_hukuk=jr_data["extension_days_hukuk"],
                extension_days_ceza=jr_data["extension_days_ceza"],
                extension_days_idari=jr_data["extension_days_idari"],
                note=jr_data.get("note"),
            )
            session.add(jr)
            recess_count += 1
            print(f"  [OK] {jr_data['year']}: {jr_data['start_date']} - {jr_data['end_date']}")

        await session.flush()
        print(f"Adli tatiller: {recess_count} eklendi, {skipped_recesses} atlandı")

        # ── Commit ────────────────────────────────────────────────────────
        await session.commit()

        print("\n" + "=" * 60)
        print("TAMAMLANDI!")
        print(f"  Olay türleri : {event_type_count}")
        print(f"  Süre kuralları: {rule_count}")
        print(f"  Resmi tatiller: {holiday_count}")
        print(f"  Adli tatiller : {recess_count}")
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(seed())
