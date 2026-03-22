# BÖLÜM 9: 0'DAN %100 ÜRÜNE — ROADMAP

> **Temel İlke:** Her aşamada "bir sonraki aşamaya geçmeden önce bu aşamada öğrenmemiz gereken tek şey ne?" sorusunu yanıtla. Öğrenmeden ölçekleme yapma.

---

## AŞAMA 1: PROOF OF CONCEPT (Hafta 1-4)

### Hedef
Tek bir avukatla çalışan, sadece içtihat arama + citation doğrulama yapan minimal sistem. Hallücinasyon oranını ölç, temel RAG pipeline'ı çalıştır.

### Hafta 1: Altyapı Kurulumu

**Ne inşa edilecek:**
- [ ] Geliştirme ortamı: Docker Compose (Qdrant + PostgreSQL + Redis + FastAPI)
- [ ] yargi-mcp ve mevzuat-mcp bağlantısı kurulması ve test edilmesi
- [ ] İlk veri ingestion: 10,000 Yargıtay kararı (iş hukuku odaklı) vector DB'ye yükleme
- [ ] Temel chunking pipeline: Karar bazlı chunking implementasyonu
- [ ] bge-m3 embedding pipeline kurulumu

**Kim ne yapacak:**
| Kişi | Görev | Süre |
|------|-------|------|
| Backend dev 1 | Docker ortamı + FastAPI skeleton | 3 gün |
| Backend dev 2 | yargi-mcp entegrasyonu + veri ingestion | 4 gün |
| ML engineer | Embedding pipeline + Qdrant setup | 4 gün |
| Hukuk uzmanı | İlk 100 test sorusu hazırlama | 5 gün |

**Devreye giren ajanlar:** Hiçbiri (henüz ajan yok, ham pipeline)

**Başarı metriği:** yargi-mcp'den 10K karar çekildi, Qdrant'a yüklendi, basit bir sorguda sonuç dönüyor

### Hafta 2: RAG Pipeline v1

**Ne inşa edilecek:**
- [ ] Hybrid search: Dense (bge-m3) + Sparse (BM25) + RRF füzyonu
- [ ] Claude API entegrasyonu: Basit prompt ile arama sonuçlarını özetleme
- [ ] İlk UI: Minimal chat arayüzü (Next.js)
- [ ] Reference extraction regex'leri
- [ ] Temel logging (LangSmith)

**Kim ne yapacak:**
| Kişi | Görev |
|------|-------|
| Backend dev 1 | Hybrid search implementasyonu |
| Backend dev 2 | Claude API entegrasyonu + prompt mühendisliği |
| Frontend dev | Chat UI + streaming response |
| Hukuk uzmanı | Search sonuçları kalite kontrolü (günlük 20 sorgu test) |

**Başarı metriği:** Doğal dil sorgusuna ilgili 5+ içtihat dönüyor, Precision@10 > 0.6

### Hafta 3: Citation Verification v1

**Ne inşa edilecek:**
- [ ] CitationVerifierAgent v1: Regex extraction + yargi-mcp doğrulama
- [ ] MevzuatSearchAgent v1: mevzuat-mcp entegrasyonu
- [ ] Güven skoru v1 (basit: doğrulanan referans / toplam referans)
- [ ] UI'da doğrulama göstergesi (✓/✗/⚠)

**Kim ne yapacak:**
| Kişi | Görev |
|------|-------|
| Backend dev 1 | Citation extraction + verification pipeline |
| Backend dev 2 | Mevzuat-mcp entegrasyonu |
| Frontend dev | Verification UI göstergeleri |
| Hukuk uzmanı | 50 cevaptaki referansları manuel doğrulama (ground truth) |

**Başarı metriği:** Hallücinasyon tespit oranı >90%, false positive <10%

### Hafta 4: POC Test ve Ölçüm

**Ne inşa edilecek:**
- [ ] 1 avukat ile gerçek kullanım testi (founder avukat)
- [ ] Hallücinasyon oranı ölçümü (100 sorgu → kaç tane hatalı referans)
- [ ] Arama kalitesi ölçümü (avukat 1-5 arası skorluyor)
- [ ] Yanıt süresi ölçümü (p50, p95, p99)
- [ ] İlk product-market fit sinyalleri

**Başarı metriği:**
- Hallücinasyon oranı < %5 (ilk hedef)
- Avukat 10 sorudan 7'sinde "faydalı" diyor
- Ortalama yanıt süresi < 5 saniye

**Bu aşamada öğrenmemiz gereken tek şey:** RAG pipeline'ı Türkçe hukuk metni için yeterli kalitede çalışıyor mu? Hallücinasyon oranı kabul edilebilir mi?

**Bir sonraki aşamaya geçiş koşulu:** Hallücinasyon oranı <%5, avukat "tekrar kullanırım" diyor

---

## AŞAMA 2: ALPHA (Hafta 5-8)

### Hedef
5 avukata açılan sistem. Dilekçe taslağı eklendi. Günlük kullanım verisi toplama.

### Hafta 5-6: Dilekçe Yazım v1

**Ne inşa edilecek:**
- [ ] DilekceWriterAgent v1: İşe iade dilekçesi + cevap dilekçesi (ilk 2 şablon)
- [ ] LangGraph kurulumu: OrchestratorAgent + IctihatSearchAgent + MevzuatSearchAgent + DilekceWriterAgent
- [ ] Otomatik içtihat yerleştirme (arama → referans seçimi → dilekçeye yerleştirme)
- [ ] ContradictionCheckerAgent v1

**Kim ne yapacak:**
| Kişi | Görev |
|------|-------|
| Backend dev 1 | LangGraph orchestration kurulumu |
| Backend dev 2 | DilekceWriterAgent + prompt engineering |
| ML engineer | Contradiction detection prototipi |
| Frontend dev | Dilekçe editor UI (rich text, split panel) |
| Hukuk uzmanı | Dilekçe şablonları hazırlama, kalite kontrolü |

**Devreye giren ajanlar:** OrchestratorAgent, DilekceWriterAgent, ContradictionCheckerAgent

### Hafta 7-8: Alpha Açılış ve Veri Toplama

**Ne inşa edilecek:**
- [ ] Multi-tenancy v1 (5 kullanıcı izolasyonu)
- [ ] Auth sistemi (NextAuth + baro numarası doğrulaması)
- [ ] Usage analytics (PostHog veya custom)
- [ ] Feedback mekanizması (her cevaba 👍/👎 + yorum)
- [ ] Günlük hallüsinasyon raporu (otomatik)
- [ ] DeadlineTrackerAgent v1 (basit süre hesaplama)

**5 avukatla test:**
- Her biri farklı hukuk alanı (iş, ticaret, ceza, idare, aile)
- Haftalık 30 dakika feedback görüşmesi
- Günlük kullanım metrikleri takibi

**Başarı metriği:**
- 5 avukatın 4'ü haftalık aktif kullanıcı
- Hallücinasyon oranı <%3'e düştü
- Dilekçe taslağı kabul oranı >%60
- "Bu özellik olsaydı süper olurdu" geri bildirimleri toplandı

**Bu aşamada öğrenmemiz gereken tek şey:** Avukatlar bunu gerçekten günlük iş akışlarında kullanıyor mu? Hangi özellik "must-have", hangisi "nice-to-have"?

**Geçiş koşulu:** 5 avukatın en az 3'ü "bunu kullanmaya devam etmek istiyorum" diyor

---

## AŞAMA 3: CLOSED BETA (Ay 3-4)

### Hedef
20 avukat, strateji ajanı ilk versiyonu, UYAP browser extension v1, gerçek dava dosyaları ile test.

### Ay 3: Strateji ve UYAP

**Ne inşa edilecek:**
- [ ] CaseStrategyAgent v1: Güçlü/zayıf analizi + kazanma olasılığı (basit)
- [ ] JudgeProfileAgent v1: Mahkeme bazlı istatistikler
- [ ] UYAP browser extension v1 (Chrome): Dava listesi + duruşma takvimi okuma
- [ ] DocumentReaderAgent v1: PDF + DOCX okuma + OCR
- [ ] Sabah briefing v1 (günlük e-mail özeti)
- [ ] 3 hukuk alanına genişleme: İş + Ticaret + Ceza hukuku ajan konfigürasyonları

**Kim ne yapacak:**
| Kişi | Görev |
|------|-------|
| Backend dev 1 | CaseStrategyAgent + JudgeProfileAgent |
| Backend dev 2 | DocumentReaderAgent + OCR pipeline |
| Frontend dev | UYAP extension geliştirme |
| ML engineer | Mahkeme istatistik motoru |
| Hukuk uzmanı (İş) | İş hukuku test setleri ve kalite kontrolü |
| Hukuk uzmanı (Ceza) | Ceza hukuku şablonları ve test setleri |

**Devreye giren ajanlar:** CaseStrategyAgent, JudgeProfileAgent, DocumentReaderAgent, DeadlineTrackerAgent (gelişmiş)

### Ay 4: Beta Cilalama

**Ne inşa edilecek:**
- [ ] EmsalAnalysisAgent v1: Trend analizi
- [ ] FreshnessCheckerAgent v1: Bozma/güncellik kontrolü
- [ ] Dilekçe çeşitliliği artırma: İstinaf, temyiz, ihtarname, arabuluculuk tutanağı
- [ ] ContractAnalysisAgent v1: Basit sözleşme risk analizi
- [ ] LaborCalculationAgent v1: Kıdem/ihbar hesaplama
- [ ] Onboarding flow: İlk kullanım deneyimi tasarımı
- [ ] Performans optimizasyonu: Cache katmanları, streaming iyileştirmesi

**20 avukatla test:**
- Davetli program: İlk 5'in referanslarıyla 15 yeni avukat
- Gerçek dava dosyaları ile kapsamlı test
- Her avukat en az 3 gerçek davayı sisteme yükler

**Başarı metriği:**
- 20 avukatın 15'i haftalık aktif
- NPS (Net Promoter Score) > 40
- Ortalama oturum süresi > 15 dakika
- Hallücinasyon oranı <%1
- En az 50 gerçek dilekçe taslağı üretildi

**Bu aşamada öğrenmemiz gereken tek şey:** Ürün "para ödenir" kalitesine ulaştı mı? İlk ücretli kullanıcı olmaya hazır mı?

**Geçiş koşulu:** 20 avukatın 10'u "bunun için para öderdim" diyor, NPS > 40

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
- [ ] Referral program: "Arkadaşını davet et, 1 ay ücretsiz"
- [ ] İçerik pazarlama: Haftalık hukuk AI bülteni
- [ ] SEO: "İçtihat arama", "dilekçe örneği" gibi aramalar için landing page'ler
- [ ] ClientReportAgent v1: Müvekkil raporu üretimi
- [ ] EvidenceMatrixAgent v1: Delil matrisi
- [ ] Performance dashboard: Avukat kullanım istatistikleri

**Başarı metriği:**
- 50+ kayıtlı avukat
- 20+ ücretli abonelik
- MRR (Monthly Recurring Revenue): ₺30,000+
- Churn rate: <%10/ay
- İstanbul Barosu partnership aktif

**Bu aşamada öğrenmemiz gereken tek şey:** Avukatlar para ödüyor mu? Hangi fiyat noktası kabul ediliyor? İlk churn nedenleri ne?

**Geçiş koşulu:** 20+ ücretli kullanıcı, MRR > ₺30K, churn <%10

---

## AŞAMA 5: V1.0 (Ay 7-9)

### Hedef
Tam ajan ekosistemi, mobil uygulama, enterprise paket, referans mekanizması.

### Ay 7-8: Tam Ajan Ekosistemi

**Ne inşa edilecek:**
- [ ] Tüm 19 ajanın aktif olması
- [ ] Dava outcome tahmini (Özellik 3, Bölüm 6)
- [ ] İçtihat Watchdog (Özellik 5, Bölüm 6)
- [ ] Strateji Simülatörü v1 (Özellik 4, Bölüm 6)
- [ ] OpposingCounselAgent v1
- [ ] AIHMSearchAgent v1
- [ ] DoctrinSearchAgent v1: DergiPark + akademik kaynak
- [ ] Embedding fine-tune (Türkçe hukuk terminolojisi)
- [ ] Reranker fine-tune

### Ay 9: Enterprise ve Mobil

**Ne inşa edilecek:**
- [ ] Mobil uygulama (React Native veya Flutter — iOS + Android)
- [ ] Enterprise paket: Büro yönetim dashboard, merkezi faturalandırma, kullanıcı yönetimi
- [ ] API erişimi (enterprise müşteriler için)
- [ ] SSO entegrasyonu (büyük firmalar için)
- [ ] Gelişmiş raporlama: Büro performans metrikleri

**Başarı metriği:**
- 150+ kayıtlı avukat
- 80+ ücretli abonelik
- MRR: ₺150,000+
- NPS > 50
- 2+ büro (enterprise) anlaşması
- Mobil uygulama yayında

**Bu aşamada öğrenmemiz gereken tek şey:** Enterprise segment (büro) satılabilir mi? Mobil kullanım pattern'ı nasıl?

**Geçiş koşulu:** MRR > ₺150K, en az 2 enterprise müşteri, mobil kullanım oranı >%20

---

## AŞAMA 6: SCALE (Ay 10-12)

### Hedef
500+ avukat, büyük firma satışları, veri network etkisi, yatırım hazırlığı.

### Ay 10-11: Büyüme

**Ne inşa edilecek:**
- [ ] 3+ baro partnership (Ankara, İzmir)
- [ ] Outbound satış ekibi (2 kişi): Büyük hukuk firmalarına direkt satış
- [ ] Multi-language: İngilizce arayüz (uluslararası firmalar için)
- [ ] Advanced analytics: Sektörel içtihat trendleri raporu (aylık yayın)
- [ ] API marketplace: Barolar, hukuk eğitim platformları için API

### Ay 12: Yatırım Hazırlığı

**Ne inşa edilecek:**
- [ ] Veri network etkisi raporlaması: Kullanıcı arttıkça nasıl zekileşiyor
- [ ] Unit economics optimizasyonu: CAC, LTV, payback period
- [ ] Pitch deck + financial model
- [ ] 500+ avukat hedefi → Türkiye'nin en büyük hukuk AI platformu

**Başarı metriği:**
- 500+ kayıtlı avukat
- 300+ ücretli abonelik
- MRR: ₺500,000+
- ARR: ₺6M+
- 5+ enterprise müşteri
- NPS > 55
- Seed/Pre-A yatırım hazır

**Bu aşamada öğrenmemiz gereken tek şey:** Unit economics sürdürülebilir mi? Yatırımcı ilgisi var mı?

---

## Özet Roadmap Tablosu

| Aşama | Süre | Kullanıcı | MRR | Temel Öğrenim |
|-------|------|-----------|-----|---------------|
| POC | Hafta 1-4 | 1 | ₺0 | RAG kalitesi yeterli mi? |
| Alpha | Hafta 5-8 | 5 | ₺0 | Günlük iş akışında kullanılıyor mu? |
| Closed Beta | Ay 3-4 | 20 | ₺0 | Para ödenir kalitede mi? |
| Public Beta | Ay 5-6 | 50+ | ₺30K+ | Ödeme yapıyorlar mı? |
| V1.0 | Ay 7-9 | 150+ | ₺150K+ | Enterprise satılır mı? |
| Scale | Ay 10-12 | 500+ | ₺500K+ | Unit economics çalışıyor mu? |

### Ekip Büyüme Planı

| Aşama | Toplam Ekip | Yeni Pozisyonlar |
|-------|-------------|-----------------|
| POC | 5 | 2 backend, 1 frontend, 1 ML, 1 hukuk |
| Alpha | 5 | (aynı ekip) |
| Closed Beta | 7 | +1 hukuk uzmanı (ceza), +1 QA |
| Public Beta | 9 | +1 customer success, +1 satış |
| V1.0 | 12 | +1 mobil dev, +1 DevOps, +1 ürün yöneticisi |
| Scale | 16 | +2 satış, +1 pazarlama, +1 veri mühendisi |
