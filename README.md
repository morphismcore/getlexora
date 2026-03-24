# Lexora — AI Destekli Hukuk Araştırma Asistanı

Türk avukatları için yapay zeka destekli içtihat arama, mevzuat tarama, dilekçe yazımı ve dava yönetimi platformu.

**Durum:** Canlı ortam aktif (POC %85, Alpha %65) | **Embedding:** 4,735+ içtihat (artıyor) | **Son güncelleme:** 24 Mart 2026

## Hızlı Başlangıç

```bash
# 1. .env dosyasını oluştur
cp .env.example .env
# ANTHROPIC_API_KEY, REDIS_PASSWORD, POSTGRES_PASSWORD vb. .env dosyasına ekle

# 2. Geliştirme ortamı
docker compose up -d

# 3. Prod ortamı
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 4. Sağlık kontrolü
curl http://localhost:8000/health

# 5. İçtihat verisi yükle
curl -X POST http://localhost:8000/api/v1/admin/ingest/topics \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"topics": ["işe iade", "kıdem tazminatı"], "pages_per_topic": 3}'
```

## Özellikler

### Tamamlanan
- **İçtihat Arama** — Hybrid search (dense bge-m3 + sparse BM25 + RRF), Yargıtay/Danıştay/BAM
- **Mevzuat Arama** — 24 temel kanun (TMK, TBK, HMK, TCK, İK, TTK vb.)
- **RAG Soru-Cevap** — Claude API ile doğrulanmış yanıtlar, streaming desteği
- **Dilekçe Yazımı** — 50+ şablon (8 kategori), PDF/DOCX export, auto-save
- **Dava Yönetimi** — Oluşturma, güncelleme, listeleme, durum takibi
- **Süre Takibi** — İş günü hesaplama, yasal süre hesaplayıcı, takvim görünümü
- **Belge İşleme** — PDF/DOCX upload, OCR, sınıflandırma
- **Auth Sistemi** — JWT, 81 baro, rol bazlı (user/firm_admin/platform_admin), şifre sıfırlama
- **Admin Paneli** — Kullanıcı yönetimi, ingestion tetikleme/izleme (SSE), sistem sağlığı
- **E-posta Servisi** — SMTP + HTML şablonlar (şifre sıfırlama, süre hatırlatma)
- **Citation Verifier** — Referans doğrulama, regex extraction
- **Celery Pipeline** — Worker + Beat, asenkron ingestion, günlük zamanlı görevler

### Eksik (Sıradaki)
- Ajan orkestrasyonu (LangGraph)
- Kullanıcı feedback (👍/👎)
- Analytics / observability
- Ödeme sistemi
- UYAP entegrasyonu

## API Endpoints

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/health` | GET | Sağlık kontrolü |
| `/api/v1/auth/register` | POST | Kayıt |
| `/api/v1/auth/login` | POST | Giriş |
| `/api/v1/auth/reset-password` | POST | Şifre sıfırlama |
| `/api/v1/search/ictihat` | POST | İçtihat arama (hybrid) |
| `/api/v1/search/mevzuat` | POST | Mevzuat arama |
| `/api/v1/search/ask` | POST | RAG soru-cevap |
| `/api/v1/search/ask/stream` | POST | Streaming RAG |
| `/api/v1/templates/list` | GET | Dilekçe şablonları |
| `/api/v1/export/pdf` | POST | PDF export |
| `/api/v1/export/docx` | POST | DOCX export |
| `/api/v1/cases` | CRUD | Dava yönetimi |
| `/api/v1/deadlines` | CRUD | Süre takibi |
| `/api/v1/admin/ingest/*` | POST | İngestion tetikleme |
| `/api/v1/admin/ingest/stream` | GET | SSE ilerleme stream |
| `/api/v1/admin/stats` | GET | Sistem istatistikleri |
| `/docs` | GET | Swagger API dokümantasyonu |

## Mimari

```
Frontend (Next.js 15)
├── Landing page
├── Arama (3 tab: İçtihat, Mevzuat, Danıştay)
├── Dilekçe (50+ şablon, auto-save, export)
├── Davalar / Süreler / Belgeler
├── İstatistik (SVG grafikler)
├── Admin (ingestion kontrol, SSE monitoring)
└── Auth (giriş, kayıt, şifre sıfırlama, doğrulama)

Backend (FastAPI)
├── core/
│   ├── llm.py              — Claude API (grounded generation)
│   └── rag.py              — RAG pipeline (search → context → generate → verify)
├── services/
│   ├── yargi.py            — Bedesten API (Yargıtay, Danıştay, BAM)
│   ├── aym.py              — Anayasa Mahkemesi bireysel başvuru
│   ├── hudoc.py            — AİHM/ECHR kararları
│   ├── mevzuat.py          — mevzuat.gov.tr (24 kanun)
│   ├── vector_store.py     — Qdrant (hybrid search, 2 koleksiyon)
│   ├── embedding.py        — bge-m3 (1024d dense + sparse vectors)
│   ├── query_expansion.py  — 65+ hukuk kısaltması, 35+ eş anlamlı
│   ├── reranker.py         — Cross-encoder reranking (ms-marco)
│   ├── citation_verifier.py— Referans doğrulama pipeline
│   ├── template_engine.py  — 50+ dilekçe şablonu
│   ├── document_export.py  — PDF/DOCX üretimi
│   ├── document_processor.py— OCR + belge sınıflandırma
│   ├── deadline_calculator.py— İş günü + yasal süre hesaplama
│   ├── email_service.py    — SMTP + HTML şablonlar
│   ├── cache.py            — Redis cache katmanı
│   └── statistics.py       — Analitik sorgular
├── ingestion/
│   ├── ingest.py           — Ana ingestion pipeline
│   ├── chunker.py          — Hukuk metni chunking
│   ├── incremental.py      — Günlük artımlı güncelleme
│   └── html_cleaner.py     — HTML temizleme
├── tasks/
│   ├── ingestion_tasks.py  — Celery ingestion task'ları (topics, AYM, AİHM, mevzuat, batch, daire, tarih aralığı)
│   └── scheduled_tasks.py  — Zamanlı görevler (günlük ingestion 03:00, süre hatırlatma 08:00)
└── api/routes/
    ├── auth.py, search.py, admin.py, cases.py, deadlines.py
    ├── templates.py, export.py, ingest.py, upload.py
    ├── dashboard.py, statistics.py, health.py, notifications.py
    └── (13 route dosyası)

Altyapı (Docker Compose — Prod)
├── backend     — FastAPI (2 worker, 2GB)
├── worker      — Celery worker (2 concurrency, 3GB)
├── beat        — Celery Beat scheduler (128MB)
├── frontend    — Next.js (production build)
├── nginx       — Reverse proxy (port 80) + Caddy (HTTPS)
├── postgres    — PostgreSQL 16 (kullanıcı/dava/süre verileri)
├── redis       — Redis 7 (cache + Celery broker, şifreli)
└── qdrant      — Qdrant v1.13.2 (vector DB, 1GB)
```

## Veri Kaynakları

| Kaynak | Servis | Durum |
|--------|--------|-------|
| **Bedesten API** (bedesten.adalet.gov.tr) | `yargi.py` | Aktif — Yargıtay, Danıştay, BAM, yerel mahkeme |
| **mevzuat.gov.tr** | `mevzuat.py` | Aktif — 24 temel kanun |
| **AYM Bireysel Başvuru** | `aym.py` | Aktif — Anayasa Mahkemesi kararları |
| **HUDOC/AİHM** | `hudoc.py` | Aktif — Türkiye aleyhine AİHM kararları |

## Embedding Veritabanı

| Koleksiyon | Vektör Boyutu | Kayıt Sayısı | Model |
|-----------|--------------|-------------|-------|
| `ictihat_embeddings` | 1024 | 4,735+ (artıyor) | BAAI/bge-m3 |
| `mevzuat_embeddings` | 1024 | ~500 | BAAI/bge-m3 |

## Sunucu

- **IP:** 204.168.136.223 (Vesper)
- **HTTPS:** Caddy reverse proxy
- **Deploy:** Docker Compose (prod) — `docker-compose.yml` + `docker-compose.prod.yml`
- **CI/CD:** GitHub push → otomatik deploy

## Dokümantasyon

Detaylı teknik dökümanlar `docs/` klasöründe:

| Bölüm | Konu |
|-------|------|
| [01](docs/BOLUM-01-AJAN-MIMARISI.md) | Ajan Mimarisi |
| [02](docs/BOLUM-02-HUKUK-ALANI-OZELLESME.md) | Hukuk Alanı Özelleşme |
| [03](docs/BOLUM-03-HALUSINASYON-SIFIRLANMASI.md) | Halüsinasyon Sıfırlanması |
| [04](docs/BOLUM-04-GUNLUK-IS-AKISI.md) | Günlük İş Akışı |
| [05](docs/BOLUM-05-UYAP-ENTEGRASYONU.md) | UYAP Entegrasyonu |
| [06](docs/BOLUM-06-DIFFERENTIATOR.md) | Farklılaştırıcılar |
| [07](docs/BOLUM-07-TEKNIK-STACK.md) | Teknik Stack |
| [08](docs/BOLUM-08-SATIS-STRATEJISI.md) | Satış Stratejisi |
| [09](docs/BOLUM-09-ROADMAP.md) | Roadmap (güncel durum) |
| [10](docs/BOLUM-10-RISK-ANALIZI.md) | Risk Analizi |
