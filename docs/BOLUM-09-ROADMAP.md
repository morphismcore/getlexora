# BÖLÜM 9: 0'DAN %100 ÜRÜNE — ROADMAP

> **Temel İlke:** Her aşamada "bir sonraki aşamaya geçmeden önce bu aşamada öğrenmemiz gereken tek şey ne?" sorusunu yanıtla. Öğrenmeden ölçekleme yapma.

> **Son Güncelleme:** 24 Mart 2026 — Canlı ortam aktif (204.168.136.223), embedding ingestion çalışıyor.

---

## GÜNCEL DURUM ÖZETİ

| Aşama | İlerleme | Açıklama |
|-------|----------|----------|
| POC (Hafta 1-4) | **%85** | Altyapı+search+RAG tamam, embedding 4,735+ (hedef 10K), ingestion aktif |
| Alpha (Hafta 5-8) | **%65** | Auth+dilekçe+deadline tamam, ajan orkestrasyonu+analytics eksik |
| Closed Beta (Ay 3-4) | **%25** | DocumentReader+email tamam, strateji/UYAP/trend analizi eksik |
| Public Beta (Ay 5-6) | **%0** | Başlanmadı |
| V1.0 (Ay 7-9) | **%0** | Başlanmadı |
| Scale (Ay 10-12) | **%0** | Başlanmadı |

---

## AŞAMA 1: PROOF OF CONCEPT (Hafta 1-4)

### Hedef
Tek bir avukatla çalışan, sadece içtihat arama + citation doğrulama yapan minimal sistem. Hallücinasyon oranını ölç, temel RAG pipeline'ı çalıştır.

### Hafta 1: Altyapı Kurulumu

**Ne inşa edilecek:**
- [x] Geliştirme ortamı: Docker Compose (Qdrant + PostgreSQL + Redis + FastAPI)
- [x] Bedesten API entegrasyonu (yargi-mcp yerine doğrudan Bedesten API kullanıldı)
- [ ] İlk veri ingestion: 10,000 Yargıtay kararı — **4,735+ yüklendi, ingestion devam ediyor (24 Mart 2026)**
- [x] Temel chunking pipeline: Karar bazlı chunking implementasyonu (`ingestion/chunker.py`)
- [x] bge-m3 embedding pipeline kurulumu (`services/embedding.py`, 1024 boyutlu dense vektörler)

**Gerçekleşen mimari:**
- yargi-mcp yerine doğrudan **Bedesten API** (`services/yargi.py`) kullanıldı
- mevzuat-mcp yerine doğrudan **mevzuat.gov.tr** (`services/mevzuat.py`, 24 kanun)
- **Celery worker/beat** ile asenkron ingestion pipeline kuruldu
- **AYM** (`services/aym.py`) ve **AİHM/HUDOC** (`services/hudoc.py`) servisleri eklendi

**Başarı metriği:** ~~10K~~ 4,735+ karar Qdrant'a yüklendi, sorgularda sonuç dönüyor. Hedef 10K'ya ingestion ile ulaşılacak.

### Hafta 2: RAG Pipeline v1

**Ne inşa edilecek:**
- [x] Hybrid search: Dense (bge-m3) + Sparse (BM25) + RRF füzyonu (`services/vector_store.py`)
- [x] Claude API entegrasyonu: RAG pipeline (`core/rag.py`, `/search/ask` endpoint)
- [x] İlk UI: Arama arayüzü (Next.js) — 3 tab (İçtihat, Mevzuat, Danıştay), typewriter efekt, typeahead
- [x] Reference extraction regex'leri (`services/citation_verifier.py`)
- [ ] Temel logging (LangSmith) — **yapılmadı, structlog ile basit logging mevcut**

**Ek olarak yapılan:**
- Query expansion servisi: 65+ hukuk kısaltması + 35+ eş anlamlı grup (`services/query_expansion.py`)
- Cross-encoder reranking (`services/reranker.py`, ms-marco-MiniLM-L-6-v2)
- Streaming RAG response (`/search/ask/stream`)

### Hafta 3: Citation Verification v1

**Ne inşa edilecek:**
- [x] Citation verification: Regex extraction + Bedesten API doğrulama (`services/citation_verifier.py`)
- [x] Mevzuat arama: 24 temel kanun entegrasyonu (`services/mevzuat.py`)
- [ ] Güven skoru v1 — **kısmi, citation sayısı dönüyor ama skor hesaplaması yok**
- [ ] UI'da doğrulama göstergesi (✓/✗/⚠) — **yapılmadı**

### Hafta 4: POC Test ve Ölçüm

**Ne inşa edilecek:**
- [ ] 1 avukat ile gerçek kullanım testi — **yapılmadı (2 avukat + 2 yazılımcı denetim yapıldı)**
- [ ] Hallücinasyon oranı ölçümü — **sistematik ölçüm yapılmadı**
- [ ] Arama kalitesi ölçümü — **uzman denetimlerinde 7.6/10 ve 7.8/10 alındı**
- [ ] Yanıt süresi ölçümü (p50, p95, p99) — **yapılmadı**
- [ ] İlk product-market fit sinyalleri — **uzman geri bildirimleri toplandı**

**Bu aşamada öğrenmemiz gereken tek şey:** RAG pipeline'ı Türkçe hukuk metni için yeterli kalitede çalışıyor mu? Hallücinasyon oranı kabul edilebilir mi?

**Bir sonraki aşamaya geçiş koşulu:** Hallücinasyon oranı <%5, avukat "tekrar kullanırım" diyor

**Durum:** Aşama büyük ölçüde tamamlandı. Embedding sayısı hedefin altında ama aktif olarak artıyor. Sistematik test/ölçüm yapılması gerekiyor.

---

## AŞAMA 2: ALPHA (Hafta 5-8)

### Hedef
5 avukata açılan sistem. Dilekçe taslağı eklendi. Günlük kullanım verisi toplama.

### Hafta 5-6: Dilekçe Yazım v1

**Ne inşa edilecek:**
- [x] Dilekçe şablon sistemi: 50+ şablon, 8 kategori (`services/template_engine.py`)
- [ ] LangGraph kurulumu: OrchestratorAgent — **ajan orkestrasyonu implement edilmedi, düz RAG mevcut**
- [ ] Otomatik içtihat yerleştirme — **yapılmadı**
- [ ] ContradictionCheckerAgent v1 — **yapılmadı**

**Ek olarak yapılan (roadmap dışı):**
- [x] PDF/DOCX export (`services/document_export.py`, `/export/pdf`, `/export/docx`)
- [x] Dilekçe UI: Auto-save (30sn), şablon kütüphanesi, arama (`dilekce/page.tsx`)
- [x] Belge yükleme: Drag&drop, progress, OCR (`services/document_processor.py`, `belge/page.tsx`)

### Hafta 7-8: Alpha Açılış ve Veri Toplama

**Ne inşa edilecek:**
- [x] Auth sistemi: JWT + 81 baro + rol bazlı erişim (user/firm_admin/platform_admin)
- [x] Kayıt: Baro numarası doğrulama, e-posta/telefon onayı
- [x] Şifre sıfırlama: Token bazlı, zaman sınırlı
- [ ] Usage analytics (PostHog veya custom) — **yapılmadı**
- [ ] Feedback mekanizması (👍/👎 + yorum) — **yapılmadı**
- [ ] Günlük hallüsinasyon raporu — **yapılmadı**
- [x] Deadline takip: İş günü hesaplama, yasal süre hesaplayıcı (`services/deadline_calculator.py`)
- [x] Deadline UI: Mini takvim, geri sayım, iş günü gösterimi (`sureler/page.tsx`)

**Ek olarak yapılan (roadmap dışı):**
- [x] Admin paneli: Kullanıcı yönetimi, sistem sağlık kontrolü, ingestion tetikleme, SSE stream
- [x] İstatistik sayfası: SVG grafikler (donut, bar, line), mahkeme bazlı analizler
- [x] E-posta servisi: SMTP + HTML şablonlar (şifre sıfırlama, süre hatırlatma, firma daveti)
- [x] Dashboard: Kullanıcı özet verileri
- [x] Bildirim sistemi: Bildirim tercihleri, uygulama içi bildirimler
- [x] Dava yönetimi: Oluşturma, güncelleme, listeleme (`davalar/page.tsx`)

**Başarı metriği:**
- 5 avukatın 4'ü haftalık aktif kullanıcı — **henüz test edilmedi**
- Hallücinasyon oranı <%3'e düştü — **ölçülmedi**
- Dilekçe taslağı kabul oranı >%60 — **ölçülmedi**

**Durum:** Teknik altyapı büyük ölçüde hazır. Kullanıcı testi ve geri bildirim döngüsü kurulmadı. Ajan sistemi eksik.

---

## AŞAMA 3: CLOSED BETA (Ay 3-4)

### Hedef
20 avukat, strateji ajanı ilk versiyonu, UYAP browser extension v1, gerçek dava dosyaları ile test.

### Ay 3: Strateji ve UYAP

**Ne inşa edilecek:**
- [ ] CaseStrategyAgent v1: Güçlü/zayıf analizi + kazanma olasılığı
- [ ] JudgeProfileAgent v1: Mahkeme bazlı istatistikler
- [ ] UYAP browser extension v1 (Chrome)
- [x] DocumentReaderAgent v1: PDF + DOCX okuma + OCR (`services/document_processor.py`)
- [ ] Sabah briefing v1 (günlük e-mail özeti) — **e-posta servisi hazır, briefing mantığı yok**
- [ ] 3 hukuk alanına genişleme — **template'ler 8 kategori kapsıyor ama ajan konfig yok**

### Ay 4: Beta Cilalama

**Ne inşa edilecek:**
- [ ] EmsalAnalysisAgent v1: Trend analizi
- [ ] FreshnessCheckerAgent v1: Bozma/güncellik kontrolü
- [x] Dilekçe çeşitliliği: 50+ şablon (istinaf, temyiz, ihtarname, arabuluculuk dahil)
- [ ] ContractAnalysisAgent v1: Sözleşme risk analizi
- [ ] LaborCalculationAgent v1: Kıdem/ihbar hesaplama
- [ ] Onboarding flow
- [x] Cache katmanları: Redis cache servisi aktif (`services/cache.py`)

**Durum:** Çoğunlukla başlanmadı. Document processing ve dilekçe çeşitliliği tamamlandı.

---

## AŞAMA 4: PUBLIC BETA (Ay 5-6)

### Hedef
İlk ücretli kullanıcılar, baro partnership, onboarding flow, müşteri başarı süreci.

### Ay 5: Monetizasyon

**Ne inşa edilecek:**
- [ ] Ödeme sistemi: Stripe/iyzico entegrasyonu, abonelik yönetimi
- [ ] 3 plan: Başlangıç (₺999) + Profesyonel (₺2,499) + Büro
- [ ] 7 günlük ücretsiz trial mekanizması
- [ ] Customer success süreci: Onboarding checklist, ilk 7 gün e-mail serisi
- [ ] Baro partnership v1: İstanbul Barosu ile pilot
- [ ] MemoryAgent v1: Kullanıcı tercih öğrenme, yazım stili adaptasyonu
- [ ] Mobil responsive tasarım (PWA)

### Ay 6: Büyüme Mekanizmaları

**Ne inşa edilecek:**
- [ ] Referral program
- [ ] İçerik pazarlama
- [ ] SEO landing page'ler
- [ ] ClientReportAgent v1
- [ ] EvidenceMatrixAgent v1
- [ ] Performance dashboard

**Durum:** Başlanmadı.

---

## AŞAMA 5: V1.0 (Ay 7-9)

### Hedef
Tam ajan ekosistemi, mobil uygulama, enterprise paket, referans mekanizması.

### Ay 7-8: Tam Ajan Ekosistemi

**Ne inşa edilecek:**
- [ ] Tüm 19 ajanın aktif olması
- [ ] Dava outcome tahmini
- [ ] İçtihat Watchdog
- [ ] Strateji Simülatörü v1
- [ ] OpposingCounselAgent v1
- [x] AİHM veri kaynağı: HUDOC API entegrasyonu (`services/hudoc.py`) — ajan değil servis olarak
- [ ] DoctrinSearchAgent v1
- [ ] Embedding fine-tune
- [ ] Reranker fine-tune

### Ay 9: Enterprise ve Mobil

**Ne inşa edilecek:**
- [ ] Mobil uygulama (React Native veya Flutter)
- [ ] Enterprise paket
- [ ] API erişimi
- [ ] SSO entegrasyonu
- [ ] Gelişmiş raporlama

**Durum:** Başlanmadı. AİHM/HUDOC servisi erken implement edildi.

---

## AŞAMA 6: SCALE (Ay 10-12)

### Hedef
500+ avukat, büyük firma satışları, veri network etkisi, yatırım hazırlığı.

- [ ] 3+ baro partnership
- [ ] Outbound satış ekibi
- [ ] Multi-language
- [ ] Advanced analytics
- [ ] API marketplace
- [ ] Pitch deck + financial model

**Durum:** Başlanmadı.

---

## Özet Roadmap Tablosu

| Aşama | Süre | Kullanıcı | MRR | İlerleme | Temel Öğrenim |
|-------|------|-----------|-----|----------|---------------|
| POC | Hafta 1-4 | 1 | ₺0 | **%85** | RAG kalitesi yeterli mi? |
| Alpha | Hafta 5-8 | 5 | ₺0 | **%65** | Günlük iş akışında kullanılıyor mu? |
| Closed Beta | Ay 3-4 | 20 | ₺0 | **%25** | Para ödenir kalitede mi? |
| Public Beta | Ay 5-6 | 50+ | ₺30K+ | %0 | Ödeme yapıyorlar mı? |
| V1.0 | Ay 7-9 | 150+ | ₺150K+ | %0 | Enterprise satılır mı? |
| Scale | Ay 10-12 | 500+ | ₺500K+ | %0 | Unit economics çalışıyor mu? |

---

## Mevcut Teknik Envanter (24 Mart 2026)

### Backend Servisleri (17 adet)
| Servis | Dosya | Durum |
|--------|-------|-------|
| Embedding | `services/embedding.py` | Aktif (bge-m3, 1024d) |
| Vector Store | `services/vector_store.py` | Aktif (Qdrant, 2 koleksiyon) |
| Bedesten API | `services/yargi.py` | Aktif |
| AYM | `services/aym.py` | Aktif |
| AİHM/HUDOC | `services/hudoc.py` | Aktif |
| Mevzuat | `services/mevzuat.py` | Aktif (24 kanun) |
| Query Expansion | `services/query_expansion.py` | Aktif (65+ kısaltma) |
| Reranker | `services/reranker.py` | Aktif (ms-marco) |
| Citation Verifier | `services/citation_verifier.py` | Aktif |
| Template Engine | `services/template_engine.py` | Aktif (50+ şablon) |
| Document Export | `services/document_export.py` | Aktif (PDF+DOCX) |
| Document Processor | `services/document_processor.py` | Aktif (OCR) |
| Deadline Calculator | `services/deadline_calculator.py` | Aktif |
| Email Service | `services/email_service.py` | Aktif (SMTP+HTML) |
| Cache | `services/cache.py` | Aktif (Redis) |
| Statistics | `services/statistics.py` | Aktif |

### API Route'ları (13 adet)
`/auth`, `/search`, `/admin`, `/cases`, `/deadlines`, `/templates`, `/export`, `/ingest`, `/upload`, `/dashboard`, `/statistics`, `/health`, `/notifications`

### Frontend Sayfaları (15 adet)
Landing, giriş, kayıt, şifre sıfırlama, doğrulama, arama, mevzuat, davalar, süreler, dilekçe, belge, istatistik, ayarlar, admin

### Altyapı
- **Sunucu:** 204.168.136.223 (Vesper)
- **Proxy:** Caddy (HTTPS)
- **Prod servisleri:** backend (2 worker), worker (Celery, 3GB), beat (scheduler), frontend, postgres, redis (auth), qdrant
- **Embedding sayısı:** 4,735+ (artıyor)
- **Qdrant koleksiyonları:** `ictihat_embeddings`, `mevzuat_embeddings`

### Kritik Eksikler
1. **Ajan orkestrasyonu** — Hiçbir ajan implement edilmedi, düz RAG pipeline var
2. **Kullanıcı feedback döngüsü** — Analytics ve 👍/👎 mekanizması yok
3. **Sistematik test/ölçüm** — Hallücinasyon oranı, precision, yanıt süresi ölçülmedi
4. **Ödeme sistemi** — Stripe/iyzico entegrasyonu yok
5. **LangSmith/observability** — Detaylı logging/tracing yok
