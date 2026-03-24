# Lexora — Yapılacaklar Roadmap (24 Mart 2026)

> 4 uzman denetiminden (2 avukat + 2 yazılımcı) çıkan bulgularla + tam proje auditi (139 bulgu) ile oluşturuldu.
> Avukat puanları: Mehmet 7.6/10, Ayşe 7.8/10
> Teknik bulgular: Backend 37 sorun, Frontend 30 sorun, Infra 54 sorun, AI/Search 18 sorun

---

## ✅ TAMAMLANANLAR

### Oturum 1 (24 Mart 2026)
- Arama sayfası yeniden yazımı (typewriter, 3 tab, glow, Danıştay filtreleri)
- Dilekçe auto-save (30s interval + 10 built-in şablon + PDF/DOCX export)
- Süre takvim görünümü (mini takvim, countdown, iş günü, Sürelerim tab)
- İstatistik SVG chart'lar (donut, bar, line, circular progress — pure SVG)
- Belge sayfası iyileştirme (drag&drop, progress bar, entity card, upload history)
- Shared component'ler (badge outline/gradient, confidence glow, empty-state motion, skeleton dual-layer)
- Celery worker mimarisi (worker.py, tasks/, beat, docker-compose)
- Monitoring & CI/CD (admin monitoring dashboard, CI/CD tam çalışıyor)
- Kayıt 80+ baro (81 il, aranabilir dropdown)
- Landing page (veri kaynakları, güven unsurları, CTA, footer)
- 27 kritik fix (güvenlik, backend, frontend, DevOps, AI/Search)

### Oturum 2 (24 Mart 2026)
- Admin panelden ingestion tetikle (batch + daire bazlı + tarih bazlı, gelişmiş ingestion paneli)
- Mevzuat ingestion (24 temel kanun, ingest_mevzuat(), mevzuat_embeddings koleksiyonu)
- AYM + AİHM ingestion (ingest_batch() ile entegre, Celery task'lar)
- İçtihat sistematik çekme (daire bazlı, tarih bazlı, konu bazlı parametreler)
- E-posta hatırlatma sistemi (SMTP servisi, HTML template, Celery Beat 08:00, bildirim tercihleri)
- Şifre sıfırlama akışı (token bazlı, rate limited, 2 yeni sayfa)
- RAG/AI asistan durumu (/health/llm endpoint, AI tab'da durum badge)
- 50+ dilekçe şablonu (10 → 55 şablon, 8 kategori, doğru kanun atıfları)
- Cross-encoder reranking (ms-marco-MiniLM-L-6-v2, config ile açılıp kapanabilir)
- Query expansion (65+ hukuk kısaltması, 35+ eş anlamlı terim grubu)

### Oturum 3 (24 Mart 2026) — DB-Driven Süreler + Güvenlik + Audit Fix
- [x] DB-driven süre kuralları: 4 yeni tablo, 75 olay türü, 93 kural, 64 tatil, 4 adli tatil
- [x] Admin paneli 8 tab: Süre Kuralları, Tatiller, Ayarlar eklendi
- [x] 20 admin CRUD endpoint (olay türleri, kurallar, tatiller, adli tatil)
- [x] DeadlineCalculator hybrid (DB→hardcoded fallback)
- [x] Firma restructure: kurumsal/bireysel ayrımı + otomatik firma oluşturma
- [x] **12 kritik güvenlik fix:** XSS email, Redis rate limiting, SSE ticket, admin escalation, password reset hardening, dangerouslySetInnerHTML, headers useMemo, AbortController, arama cache, useAuth, dependency fix
- [x] **16 frontend a11y fix:** Toggle checkbox ARIA, beni hatırla input, toast aria-live, alert→toast, Link component, htmlFor/id, upload XHR progress, focus trap, filteredGroups useMemo
- [x] **Faz 1 (8 fix):** Citation exact match, RAG post-generation verification, context budget 3x artış, streaming null check, case erişim kontrolü (firma membership), exposed error→generic (12 endpoint), HSTS+CSP+Permissions headers, Docker healthchecks, backup 90g+Qdrant snapshot, DB pool iyileştirme
- [x] **Faz 2 (8 fix):** Dedup multi-field hash, confidence weighted scoring, embedding version pinned, reranker min-max normalize, citation regex +4 pattern +year validation, request ID tracking, token expiry handling, sessiz API hata fix
- [x] **Faz 3 (10 fix):** JWT 4h+auto-refresh, Celery dead letter queue, query expansion warnings, cache stampede protection, chunking sentence overlap, React.memo list items, dependency pinning, CI security audit, rollback image tagging, pytest-cov coverage

---

## KALAN İŞLER — Refactor & Polish (46 iş)

### Kod Refactor (8)
- [ ] **init_db() → Alembic migration** — `create_all()` yerine proper migration chain
- [ ] **Ingestion state → DB** — `_ingest_state` in-memory dict → IngestionJob tablosu
- [ ] **Global toast hook** — `useToast` + `<ToastProvider>` — tüm sayfalardaki toast tekrarını kaldır
- [ ] **Shared component dedup** — Badge, Skeleton, EmptyState inline kopyalarını birleştir
- [ ] **SVG icon kütüphanesi** — Tekrarlanan SVG'leri merkezi component'lere çıkar
- [ ] **Structured error response** — Tüm endpoint'lerde `{error_code, message, hint}` formatı
- [ ] **asyncio.run() tutarlılığı** — `scheduled_tasks.py` vs `ingestion_tasks.py` tek pattern
- [ ] **Pipeline resource cleanup** — Tüm servisler `__aenter__`/`__aexit__` context manager

### Teknik Borç (11)
- [ ] `Case.assigned_to` string → User FK normalize
- [ ] Audit trail (kim ne zaman ne değiştirdi) — middleware bazlı
- [ ] Soft delete tutarlılığı — tüm modellerde `is_deleted` + `deleted_at`
- [ ] Bulk operasyon — toplu dava oluşturma, toplu süre import
- [ ] Arşivleme — eski kapalı davalar cold storage
- [ ] Test coverage artırma — hedef %60+
- [ ] API dokümantasyonu — setup guide, endpoint reference
- [ ] DRY: Ingestion pipeline tekrarlayan kod → `_process_items()` helper
- [ ] DRY: Celery task boilerplate → `LexoraTask` base class (kısmen yapıldı)
- [ ] `CHECKPOINT_FILE` hardcoded path → config'e taşı
- [ ] `Deadline.reminder_days` → NotificationPreference ile entegre et

### Frontend Polish (27)
- [ ] console.error() → proper error logging (davalar/[id])
- [ ] Dilekçe şablonları lazy load — 55 şablon → ayrı JSON + dynamic import
- [ ] Grid responsive — ayarlar, davalar `grid-cols-1 sm:grid-cols-2`
- [ ] Admin tablo responsive — `overflow-x-auto` veya kart görünümü
- [ ] SSE onerror handler — retry mantığı + kullanıcı bildirimi
- [ ] Daire listesi filtrele — mahkemeye göre dinamik dropdown
- [ ] loading ref — arama sayfasında gereksiz re-render engelle
- [ ] SEO meta tags — sayfa başına title, description, canonical
- [ ] TypeScript `any` usage → proper types (admin sayfası)
- [ ] Next.js security headers config (next.config.ts)
- [ ] Tailwind theme centralize — hardcoded renkleri tema değişkenine taşı
- [ ] FloatingIconSvg → component dışına çıkar (memo için)
- [ ] localStorage remaining usage → useAuth() tutarlılığı
- [ ] Modal aria-modal + role="dialog" (davalar delete confirm)
- [ ] Keyboard navigation — file upload drag-drop zone'a keyboard alternatif
- [ ] Password show/hide toggle aria-label
- [ ] Missing form labels (bazı input'lar)
- [ ] Turkish naming consistency (component/function isimler)
- [ ] Sidebar tablet breakpoint — collapse davranışı iyileştir
- [ ] Token management — tüm sayfalarda useAuth() hook
- [ ] ENV validation — NEXT_PUBLIC_API_URL eksikse uyarı
- [ ] Error boundary — sayfa bazında catch
- [ ] Suspense boundary — lazy loaded component'ler için
- [ ] Image optimization — Next.js Image component kullanımı
- [ ] Bundle analysis — @next/bundle-analyzer ile ölçüm
- [ ] Date input dark mode — kalan sayfalar
- [ ] Türkçe karakter kontrolü — tüm UI metinleri

---

## KALAN İŞLER — Yeni Özellikler (63 iş)

### Veri Zenginleştirme (11)
> Av. Mehmet: "4,735 embedding ile kapsamlı araştırma zor. En az 50,000 gerekli."

- [ ] **İçtihat 50,000+** — Sistematik daire bazlı + tarih bazlı toplu çekme (worker hazır)
- [ ] **Mevzuat arama aktif** — 24 temel kanun çekildi, arama tab'ını aktif et
- [ ] **AYM bireysel başvuru** — İhlal kararları öncelikli
- [ ] **AİHM Türkiye kararları** — HUDOC API ile
- [ ] **BAM kararları** — Bölge Adliye Mahkemesi
- [ ] **Mevzuat değişiklik takibi** — "Bu madde değiştirilmiştir" uyarısı
- [ ] **Emsal karar zinciri** — Atıf yapan/yapılan kararlar ağacı
- [ ] **Query expansion ek** — KTK, PVSK, YUKK, Noterlik, CMK kurumları
- [ ] **Tüketici hakem heyeti sınırı** — Yıllık güncel parasal sınır
- [ ] **Resmi tatil dinamik** — ✅ DB-driven yapıldı, admin panelden yönetilebilir
- [ ] **Adli tatil hesaplaması** — ✅ DB-driven yapıldı, JudicialRecess tablosu

### Dava Yönetimi Güçlendirme (5)
> Av. Mehmet: "Dava yönetimi 6/10 — duruşma takvimi, müvekkil yönetimi olmazsa olmaz."

- [ ] **Duruşma takvimi** — Tarih, saat, mahkeme, salon bilgisi + takvim görünümü
- [ ] **Müvekkil yönetimi** — Client modeli, dava-müvekkil ilişkisi
- [ ] **Masraf/ücret takibi** — Vekalet ücretleri, harç takibi
- [ ] **Kronolojik işlem geçmişi** — Her davada audit log
- [ ] **Toplu dosya export** — Excel/PDF dava listesi

### Ek Dilekçe Şablonları (8)
- [ ] İş hukuku ek — Toplu iş sözleşmesi alacak, tensip zaptına cevap
- [ ] Ticaret ek — Ortaklıktan çıkma/çıkarılma, genel kurul kararı iptali
- [ ] İcra-İflas ek — Şikayet (İİK 16), taşkın haciz şikayeti
- [ ] Ceza hukuku ek — HAGB itirazı, CMK 141 tazminat, CMK 150 müdafilik
- [ ] Aile hukuku ek — Nafaka artırımı/kaldırılması, soybağı, TMK 169 tedbir
- [ ] Tüketici ek — Taksitli satış iptali, abonelik, haksız ticari uygulama
- [ ] Vergi davası — VUK kaynaklı vergi uyuşmazlığı
- [ ] **Sorumluluk reddi** — Tüm şablon çıktılarına "hukuki tavsiye niteliğinde değildir"

### Doğrulama & Belge (5)
- [ ] Doğrulama rapor export — PDF olarak
- [ ] "Güncel mi?" kontrolü — İçtihat değişikliği uyarısı
- [ ] OCR desteği — Taranmış PDF'ler (Tesseract)
- [ ] Belge karşılaştırma — İki sözleşme versiyonu diff
- [ ] Sözleşme analizi — Riskli maddeler, eksik hükümler

### Platform Özellikleri (8)
- [ ] Bildirim sistemi — In-app çan + push notification
- [ ] Rol bazlı erişim — Avukat, stajyer, sekreter, müşteri rolleri
- [ ] Sayfalama/infinite scroll — Arama sonuçlarında 20+ sonuç
- [ ] Klavye kısayolları — Ctrl+K hızlı arama, navigasyon
- [ ] OAuth2/SSO — Google/Microsoft login
- [ ] Gerçek zamanlı belge düzenleme — WebSocket
- [ ] Dava/süre yorumları — Ekip içi iletişim
- [ ] Firma içi dava paylaşımı — Çoklu avukat atama

### Gelişmiş Analitik (3)
- [ ] Daire × sonuç heatmap — Kazanma oranı analizi
- [ ] Atıf etki grafiği — Hangi kararlar en çok atıf alıyor
- [ ] Arama trendi — En çok aranan konular/mahkemeler

### Ödeme & Büyüme (6)
- [ ] Ödeme sistemi — Stripe/iyzico, abonelik yönetimi
- [ ] 3 plan: Başlangıç ₺999, Profesyonel ₺2,499, Büro
- [ ] 7 gün ücretsiz trial
- [ ] Referral program
- [ ] İçerik pazarlama + SEO
- [ ] Baro partnership — İstanbul Barosu pilot

### Ajan Orkestrasyonu (8)
- [ ] CaseStrategyAgent — Güçlü/zayıf analizi + kazanma olasılığı
- [ ] JudgeProfileAgent — Mahkeme bazlı istatistikler
- [ ] EmsalAnalysisAgent — Trend analizi
- [ ] ContradictionCheckerAgent — Çelişki tespiti
- [ ] FreshnessCheckerAgent — Bozma/güncellik kontrolü
- [ ] ContractAnalysisAgent — Sözleşme risk analizi
- [ ] LaborCalculationAgent — Kıdem/ihbar hesaplama
- [ ] MemoryAgent — Kullanıcı tercih öğrenme

### Altyapı & Ölçeklendirme (9)
- [ ] Prometheus metrikleri + Grafana dashboard
- [ ] Structlog JSON renderer (production)
- [ ] Secrets manager — .env → Vault/AWS Secrets
- [ ] Key rotation — JWT secret periyodik değişim
- [ ] Redis Cluster (yüksek kullanım)
- [ ] Qdrant replication
- [ ] Load balancer — birden fazla backend replica
- [ ] ColBERT vector desteği
- [ ] UYAP Portal entegrasyonu
- [ ] Mobil uygulama / PWA

---

## ÖZET TABLO

| Kategori | Toplam | Tamamlanan | Kalan | Durum |
|----------|--------|-----------|-------|-------|
| Kritik güvenlik | 12 | **12** | 0 | ✅ %100 |
| Önemli backend | 15 | **13** | 2 | ✅ %87 |
| Frontend kalite | 18 | **16** | 2 | ✅ %89 |
| Audit fix (Faz 1-3) | 30 | **30** | 0 | ✅ %100 |
| Refactor & polish | 46 | 0 | 46 | ⬜ Sonraki oturum |
| Yeni özellikler | 63 | 0 | 63 | ⬜ Planlı |
| **TOPLAM** | **184** | **71** | **113** | **%39** |
