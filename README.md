# Lexora — AI Destekli Hukuk Araştırma Asistanı

Türk avukatları için yapay zeka destekli içtihat arama, mevzuat tarama, dilekçe yazımı ve dava strateji analizi platformu.

## Hızlı Başlangıç

```bash
# 1. .env dosyasını oluştur
cp .env.example .env
# ANTHROPIC_API_KEY'i .env dosyasına ekle

# 2. Servisleri başlat
make build

# 3. Sağlık kontrolü
make health

# 4. İçtihat verisi yükle (ilk çalıştırmada)
make ingest-default

# 5. Test et
make test-search
make test-ask
```

## API Endpoints

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/health` | GET | Sağlık kontrolü |
| `/api/v1/search/ictihat` | POST | İçtihat arama |
| `/api/v1/search/ask` | POST | RAG soru-cevap (arama + LLM + doğrulama) |
| `/api/v1/search/ask/stream` | POST | Streaming RAG soru-cevap |
| `/api/v1/search/mevzuat` | POST | Mevzuat arama |
| `/api/v1/search/verify` | POST | Referans doğrulama |
| `/api/v1/ingest/topics` | POST | Toplu veri yükleme |
| `/api/v1/ingest/status` | GET | Yükleme durumu |
| `/docs` | GET | Swagger API dokümantasyonu |

## Mimari

```
Backend (FastAPI)
├── core/
│   ├── llm.py          — Claude API (grounded generation)
│   └── rag.py          — RAG pipeline (search → context → generate → verify)
├── services/
│   ├── yargi.py        — Bedesten API + UYAP Emsal (içtihat)
│   ├── mevzuat.py      — mevzuat.gov.tr (kanunlar)
│   ├── vector_store.py — Qdrant (hybrid search)
│   ├── embedding.py    — bge-m3 (dense + sparse vectors)
│   └── citation_verifier.py — Referans doğrulama pipeline
├── ingestion/
│   ├── chunker.py      — Hukuk metni chunking
│   └── ingest.py       — Bedesten → Qdrant veri pipeline
└── api/routes/
    ├── search.py       — Arama ve RAG endpoint'leri
    └── ingest.py       — Veri yükleme endpoint'leri

Altyapı (Docker Compose)
├── Qdrant   — Vector DB (hybrid search)
├── Redis    — Cache
└── Postgres — Kullanıcı verisi (henüz aktif değil)
```

## Veri Kaynakları

- **Bedesten API** (bedesten.adalet.gov.tr) — Yargıtay, Danıştay, BAM, yerel mahkeme kararları
- **UYAP Emsal** (emsal.uyap.gov.tr) — Emsal karar veritabanı
- **mevzuat.gov.tr** — Kanun, KHK, yönetmelik, tebliğ
