# Lexora — Proje Durum Raporu
**Tarih:** 20 Mart 2026
**Aşama:** POC (Proof of Concept) — Alpha'ya geçiş aşamasında

---

## Genel Bakış

Türk avukatları için AI destekli hukuk araştırma asistanı. İçtihat arama, mevzuat tarama, belge analizi, dilekçe oluşturma, süre hesaplama ve dava yönetimi tek platformda.

**Canlı:** http://localhost:3000
**API Docs:** http://localhost:8000/docs
**Qdrant Dashboard:** http://localhost:16333/dashboard

---

## Tamamlanan Özellikler

### Backend (FastAPI) — 39 Python dosyası

| Route Grubu | Endpoint Sayısı | Açıklama |
|-------------|----------------|----------|
| **health** | 3 | Sağlık kontrolü, cache stats |
| **search** | 5 | İçtihat arama, mevzuat arama, karar detay, doğrulama |
| **ingest** | 3 | Veri yükleme (keyword/topics), durum kontrolü |
| **auth** | 3 | Register, login (JWT), profil |
| **cases** | 8 | Dava CRUD, deadline ekleme, arama kaydetme |
| **deadlines** | 2 | Süre hesaplama (9 olay tipi), tip listesi |
| **statistics** | 3 | Mahkeme istatistik, daire profili, konu karşılaştırma |
| **dashboard** | 1 | Canlı dashboard verisi |
| **upload** | 2 | PDF/DOCX yükleme ve analiz |
| **templates** | 3 | Dilekçe şablonları, belge üretimi |
| **export** | 2 | DOCX ve PDF export |

### Servisler (Backend)

| Servis | Dosya | Ne Yapıyor |
|--------|-------|-----------|
| YargiService | yargi.py | Bedesten API — Yargıtay, Danıştay, BAM kararları |
| MevzuatService | mevzuat.py | Bedesten API — Kanun, KHK, yönetmelik arama |
| VectorStoreService | vector_store.py | Qdrant hybrid search (dense + sparse + RRF) |
| EmbeddingService | embedding.py | paraphrase-multilingual-MiniLM-L12-v2 |
| CitationVerifierService | citation_verifier.py | Regex extraction + API doğrulama |
| CacheService | cache.py | Redis — arama, belge, doğrulama cache |
| DeadlineCalculator | deadline_calculator.py | 9 olay tipi, iş günü, resmi tatil hesabı |
| CourtStatisticsService | statistics.py | Daire dağılımı, yıl trendi, konu analizi |
| DocumentProcessor | document_processor.py | PDF/DOCX metin çıkarma, taraf/dava tespiti |
| TemplateEngine | template_engine.py | 5 dilekçe şablonu, form → belge |
| DocumentExportService | document_export.py | DOCX + PDF üretimi (python-docx + fpdf2) |
| RAGPipeline | rag.py | Arama → context → LLM → doğrulama (LLM opsiyonel) |
| LLMService | llm.py | Claude API entegrasyonu (henüz aktif değil) |

### Frontend (Next.js 16) — 8 Sayfa

| Sayfa | URL | Özellikler |
|-------|-----|-----------|
| **Dashboard** | `/` | Canlı veriler, yeni kararlar, sistem durumu, hızlı erişim |
| **İçtihat Arama** | `/arama` | Split panel, keyword highlight, filtreler, karar önizleme |
| **Mevzuat** | `/mevzuat` | Kanun adı/numarası ile arama |
| **Doğrulama** | `/dogrulama` | Metin → referans tespiti → doğrulama, güven skoru |
| **Süre Hesapla** | `/sureler` | 9 olay tipi, timeline görünüm, urgency renkleri |
| **İstatistik** | `/istatistik` | Daire dağılımı bar chart, yıl trendi, konu karşılaştırma |
| **Belge Analiz** | `/belge` | PDF/DOCX drag-drop, metin çıkarma, taraf/referans tespiti |
| **Dilekçe** | `/dilekce` | Block-based editör, canlı kağıt önizleme, DOCX/PDF export |

### UI Bileşenleri

| Bileşen | Açıklama |
|---------|----------|
| Sidebar | Collapsible (56/220px), mobil hamburger overlay, klavye kısayolları |
| Command Palette | Cmd+K, sayfa geçişi, son aramalar |
| Badge | verified/not_found/partial/info/neutral varyantları |
| Confidence Bar | Animated, renk geçişli güven skoru |
| Loading Skeleton | Shimmer efektli yükleme durumu |
| Empty State | İkon + açıklama + CTA butonu |
| Page Transitions | Motion spring fade+slide |

### Tasarım Sistemi — "Linear Meets Law"

- Arka plan: `#09090B` (base), `#111113` (surface), `#1A1A1F` (elevated)
- Border: `rgba(255,255,255,0.06)` subtle, `0.10` default
- Metin: `#ECECEE` (primary), `#8B8B8E` (secondary), `#5C5C5F` (tertiary)
- Accent: `#6C6CFF` (indigo)
- Success/Warning/Destructive: `#3DD68C` / `#FFB224` / `#E5484D`
- Font: Geist Sans (UI), Noto Serif (dilekçe önizleme)
- Animasyonlar: Motion spring, stagger entry (20ms), shimmer skeleton

### Altyapı

| Servis | Teknoloji | Port | Durum |
|--------|-----------|------|-------|
| Backend | FastAPI + Python 3.12 | 8000 | Çalışıyor |
| Frontend | Next.js 16 + TypeScript | 3000 | Çalışıyor |
| Vector DB | Qdrant v1.13.2 | 16333 | Healthy — 319 embedding |
| Cache | Redis 7 Alpine | 16379 | Healthy |
| Database | PostgreSQL 16 Alpine | 15432 | Healthy |

### Veri Kaynakları

| Kaynak | API | Durum |
|--------|-----|-------|
| Bedesten API | bedesten.adalet.gov.tr | Aktif — Yargıtay, Danıştay, BAM |
| Mevzuat API | bedesten.adalet.gov.tr/mevzuat | Aktif — Kanun, KHK, yönetmelik |
| Qdrant | Semantic search | 319 embedding (15+ konu) |

### Veritabanı Tabloları (PostgreSQL)

| Tablo | Açıklama |
|-------|----------|
| User | Avukat hesabı (email, şifre, baro sicil no) |
| Case | Dava dosyası (başlık, tür, mahkeme, durum) |
| CaseDocument | Dava belgesi (dosya adı, tür, yol) |
| SavedSearch | Kayıtlı arama (sorgu, tür, sonuç sayısı) |
| Deadline | Süre takibi (başlık, tarih, tür, hatırlatma) |

### Test Suite

- pytest + pytest-asyncio
- 5 test dosyası: health, search, citation_verifier, chunker, deadline_calculator
- conftest.py: mock fixtures, async test client

---

## Yapılmamış / Bekleyen Özellikler

### Kısa Vadeli (Bir Sonraki Sprint)

| Özellik | Öncelik | Bağımlılık |
|---------|---------|------------|
| **Anthropic API entegrasyonu** | Yüksek | API key gerekli |
| **RAG soru-cevap** | Yüksek | Anthropic API |
| **Daha fazla veri yükleme** | Orta | Zaman (500+ → 5000+ embedding) |
| **Dilekçe DOCX/PDF indirme** | Orta | Frontend butonları backend'e bağlanmalı |
| **Unicode karakter taraması** | Düşük | Bazı sayfalarda \u escape'ler kalmış olabilir |

### Orta Vadeli (Ay 2-3)

| Özellik | Açıklama |
|---------|----------|
| LangGraph ajan orkestrasyonu | 19 ajan tasarımı hazır (Bölüm 1), implement edilmeli |
| Dilekçe AI desteği | Olay anlat → AI taslak üretsin |
| Strateji ajanı | Dava güçlü/zayıf analizi |
| Hakim profil analizi | Mahkeme bazlı karar istatistikleri (istatistik servisi genişletilmeli) |
| Outcome tahmini | XGBoost + SHAP, benzer dava sonuç dağılımı |
| UYAP browser extension v1 | Dava listesi + duruşma takvimi okuma |
| Embedding fine-tune | Türkçe hukuk terminolojisi için bge-m3 |
| Sabah briefingi | Günlük özet (yeni kararlar, süreler, duruşmalar) |

### Uzun Vadeli (Ay 4-6)

| Özellik | Açıklama |
|---------|----------|
| Ödeme sistemi (iyzico/Stripe) | Abonelik yönetimi |
| Baro partnership | İstanbul Barosu pilot |
| Mobil uygulama | React Native / Flutter |
| Enterprise paket | Büro dashboard, kullanıcı yönetimi |
| CI/CD pipeline | GitHub Actions |
| Monitoring | Grafana + Prometheus |
| Production deployment | Hetzner / Türk cloud |

---

## Dosya Sayıları

| Kategori | Sayı |
|----------|------|
| Backend Python dosyaları | 39 |
| Frontend TSX dosyaları | 17 |
| Araştırma dokümanları | 11 |
| Test dosyaları | 5 |
| Docker/Infra dosyaları | 4 |
| **Toplam** | **76** |

---

## Çalıştırma

```bash
# Tüm servisleri başlat
cd getlexora
cp .env.example .env
docker compose up -d
cd frontend && npm run dev

# Veri yükle
make ingest-default

# Test
make test-search
make health
```

---

*Bu doküman 20 Mart 2026 itibarıyla günceldir.*
