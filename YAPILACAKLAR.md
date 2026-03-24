# Lexora — Yapılacaklar Roadmap (24 Mart 2026)

> 4 uzman denetiminden (2 avukat + 2 yazılımcı) çıkan bulgularla oluşturuldu.
> Avukat puanları: Mehmet 7.6/10, Ayşe 7.8/10
> Teknik bulgular: Backend 32 sorun (5 kritik), Frontend 37 sorun (7 kritik)

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

---

## FAZ 1: KRİTİK GÜVENLİK & BUG FIX'LER (Acil — 1-2 gün)

> Backend 5 kritik + Frontend 7 kritik = 12 kritik sorun. Deploy öncesi mutlaka yapılmalı.

### 1.1 Backend Güvenlik (5 kritik)
- [ ] **XSS via e-posta template** — `email_service.py:55-61` — `html.escape()` ekle
- [ ] **Reset password şifre validasyonu** — `auth.py:265-267` — `validate_password_strength` ekle
- [ ] **In-memory rate limiting** — `auth.py:28-52` — Redis tabanlı sliding window'a taşı
- [ ] **SSE JWT query parameter** — `admin.py:413-431` — Kısa ömürlü tek kullanımlık SSE token sistemi
- [ ] **Admin rol escalation** — `admin.py:138-155` — platform_admin atamasını kısıtla, son admin koruması

### 1.2 Frontend Güvenlik & Stabilite (7 kritik)
- [ ] **dangerouslySetInnerHTML XSS** — `giris/page.tsx:151` — SVG'leri JSX'e çevir
- [ ] **headers useMemo eksik** — `ayarlar/page.tsx:52` + `admin/page.tsx:67` — sonsuz döngü riski
- [ ] **N+1 API sorgusu** — `sureler/page.tsx:324-335` — toplu deadline endpoint veya Promise.all()
- [ ] **fetchCases dependency** — `davalar/page.tsx:90` — token state tutarsızlığı
- [ ] **AbortController cleanup** — `arama/page.tsx:555-598` — race condition
- [ ] **SSE token URL'de** — `admin/page.tsx:330` — backend ile birlikte çöz
- [ ] **useSearchParams Suspense** — `sifre-sifirla/page.tsx:10` — Suspense boundary ekle

---

## FAZ 2: ÖNEMLİ BACKEND İYİLEŞTİRMELER (1 hafta)

### 2.1 Güvenlik & Altyapı
- [ ] **Senkron SMTP async'te** — `email_service.py:111` — `asyncio.to_thread()` veya `aiosmtplib`
- [ ] **Health endpoint'leri auth** — `/health/details`, `/health/llm` → admin auth gerekli
- [ ] **PasswordChange validasyonu** — `auth.py:372-374` — şifre güç kontrolü ekle
- [ ] **Admin list_users limit** — `admin.py:51-56` — max 500 üst sınır
- [ ] **Firma davet rol koruması** — `auth.py:513-514` — platform_admin rol düşürme engeli

### 2.2 Celery & Performans
- [ ] **Celery task retry** — Tüm task'lara `autoretry_for`, `max_retries=3`, `retry_backoff=True`
- [ ] **asyncio.run() tutarlılığı** — `scheduled_tasks.py` vs `ingestion_tasks.py` — tek yaklaşım
- [ ] **Pipeline kaynak temizliği** — HTTP client close, connection pool sızıntısı
- [ ] **_publish_progress Redis** — `celery_broker_url` → `redis_url`, connection pool
- [ ] **N+1 firms query** — `admin.py:160-182` — tek JOIN sorgusu

### 2.3 Veritabanı & Config
- [ ] **init_db() production kontrolü** — Alembic migration'a geçiş
- [ ] **Ingestion state DB'ye** — `_ingest_state` in-memory → IngestionJob tablosu
- [ ] **Case.firm_id index** — `database.py:113` — performans indexi
- [ ] **NotificationPreference duplicate index** — `database.py:276,292` — gereksiz index kaldır
- [ ] **Structured error response** — Tüm endpoint'lerde `{error_code, message, hint}` formatı

---

## FAZ 3: FRONTEND KALİTE & UX (1 hafta)

### 3.1 Erişilebilirlik (a11y)
- [ ] **Toggle switch'ler** — `ayarlar/page.tsx:279-318` — gerçek checkbox + ARIA role="switch"
- [ ] **Beni hatırla checkbox** — `giris/page.tsx:303-324` — gerçek input + rememberMe kullan
- [ ] **htmlFor/id eşleşmesi** — Tüm form sayfalarında label-input bağlantısı
- [ ] **Toast aria-live** — Tüm sayfalarda `role="alert"` ekle
- [ ] **Modal focus trap** — `davalar/page.tsx:410-517` — Tab ile çıkışı engelle

### 3.2 Kod Kalitesi & Performans
- [ ] **`<Link>` component'ine geç** — giris, sifremi-unuttum, sifre-sifirla sayfaları
- [ ] **Token yönetimi birleştir** — `useAuth()` hook her yerde, doğrudan localStorage kaldır
- [ ] **Global toast hook** — `useToast` + `<ToastProvider>` — kod tekrarını kaldır
- [ ] **Shared component'leri kullan** — Badge, Skeleton, EmptyState inline kopyaları kaldır
- [ ] **Dilekçe şablonları lazy load** — 55 şablon → ayrı JSON + dynamic import
- [ ] **filteredGroups useMemo** — `command-palette.tsx:52-59`
- [ ] **loading ref** — `arama/page.tsx:543` — gereksiz re-render engelle
- [ ] **SVG icon kütüphanesi** — Tekrarlanan SVG'leri component'lere çıkar

### 3.3 Responsive & UX
- [ ] **Daire listesi filtrele** — `arama/page.tsx:89-108` — mahkemeye göre dinamik
- [ ] **Grid responsive** — `ayarlar, davalar` — `grid-cols-1 sm:grid-cols-2`
- [ ] **Admin tablo responsive** — `admin/page.tsx:182` — `overflow-x-auto` veya kart görünümü
- [ ] **SSE onerror handler** — `admin/page.tsx:351` — retry mantığı + kullanıcı bildirimi
- [ ] **alert() → toast** — `davalar/page.tsx:166,185`
- [ ] **Yapay progress → gerçek** — `belge/page.tsx:143` — XMLHttpRequest progress

### 3.4 Türkçe & i18n
- [ ] **Türkçe karakter düzeltmeleri** — ş, ı, ü, ö, ç, ğ eksik olan tüm metinler
- [ ] **date input color-scheme** — Tüm tarih input'larına `[color-scheme:dark]`

---

## FAZ 4: VERİ ZENGİNLEŞTİRME (2 hafta, sürekli)

> Av. Mehmet: "4,735 embedding ile kapsamlı araştırma zor. En az 50,000 gerekli."

### 4.1 Embedding Hedefleri
- [ ] **İçtihat 50,000+** — Sistematik daire bazlı + tarih bazlı toplu çekme
- [ ] **Mevzuat aktif et** — 24 temel kanun çekildi, arama tab'ını aktif et
- [ ] **AYM bireysel başvuru** — İhlal kararları öncelikli
- [ ] **AİHM Türkiye kararları** — HUDOC API entegrasyonu
- [ ] **BAM kararları** — Bölge Adliye Mahkemesi kararları

### 4.2 Veri Kalitesi
- [ ] **Resmi tatil dinamik** — `sureler/page.tsx:46-65` — Yıllık güncelleme veya API
- [ ] **Adli tatil hesaplaması** — HMK md. 104 — 20 Temmuz-31 Ağustos süre durması
- [ ] **Mevzuat değişiklik takibi** — "Bu madde değiştirilmiştir" uyarısı
- [ ] **Emsal karar zinciri** — Atıf yapan/yapılan kararlar ağacı
- [ ] **Query expansion ek** — KTK, PVSK, YUKK, Noterlik Kanunu kısaltmaları + CMK kurumları (uzlaşma, seri muhakeme, basit yargılama, ön ödeme)
- [ ] **Tüketici hakem heyeti sınırı** — Yıllık güncel parasal sınır dinamik gösterim

---

## FAZ 5: AVUKAT İHTİYAÇLARI (2-3 hafta)

> Av. Mehmet: "Dava yönetimi 6/10 — duruşma takvimi, müvekkil yönetimi olmazsa olmaz."

### 5.1 Dava Yönetimi Güçlendirme
- [ ] **Duruşma takvimi** — Tarih, saat, mahkeme, salon bilgisi + takvim görünümü
- [ ] **Müvekkil yönetimi** — Client modeli, dava-müvekkil ilişkisi
- [ ] **Masraf/ücret takibi** — Vekalet ücretleri, harç takibi
- [ ] **Kronolojik işlem geçmişi** — Her davada audit log
- [ ] **Toplu dosya export** — Excel/PDF dava listesi

### 5.2 Ek Dilekçe Şablonları
- [ ] **İş hukuku ek** — Toplu iş sözleşmesi alacak, tensip zaptına cevap
- [ ] **Ticaret ek** — Ortaklıktan çıkma/çıkarılma, genel kurul kararı iptali
- [ ] **İcra-İflas ek** — Şikayet (İİK 16), taşkın haciz şikayeti
- [ ] **Ceza hukuku ek** — HAGB itirazı, CMK 141 tazminat (haksız tutukluluk), CMK 150 zorunlu müdafilik
- [ ] **Aile hukuku ek** — Nafaka artırımı/kaldırılması, soybağı (nesep) tespiti, TMK 169 geçici tedbirler
- [ ] **Tüketici ek** — Taksitli satış iptali (TKHK md. 15), abonelik sözleşmesi, haksız ticari uygulama
- [ ] **Vergi davası** — VUK kaynaklı vergi uyuşmazlığı şablonu
- [ ] **Sorumluluk reddi** — Tüm şablon çıktılarına "hukuki tavsiye niteliğinde değildir" beyanı

### 5.3 Doğrulama & Belge İyileştirme
- [ ] **Doğrulama rapor export** — PDF olarak dışa aktarma
- [ ] **"Güncel mi?" kontrolü** — İçtihat değişikliği uyarısı
- [ ] **OCR desteği** — Taranmış PDF'ler (Tesseract)
- [ ] **Belge karşılaştırma** — İki sözleşme versiyonu diff
- [ ] **Sözleşme analizi** — Riskli maddeler, eksik hükümler tespiti

---

## FAZ 6: PLATFORM ÖZELLİKLERİ (Gelecek ay)

### 6.1 Kullanıcı Deneyimi
- [ ] **Bildirim sistemi** — In-app çan + push notification
- [ ] **Rol bazlı erişim** — Avukat, stajyer, sekreter, müşteri rolleri
- [ ] **Sayfalama/infinite scroll** — Arama sonuçlarında 20+ sonuç
- [ ] **Klavye kısayolları** — Ctrl+K hızlı arama, navigasyon
- [ ] **OAuth2/SSO** — Google/Microsoft login

### 6.2 İşbirliği
- [ ] **Gerçek zamanlı belge düzenleme** — WebSocket
- [ ] **Dava/süre yorumları** — Ekip içi iletişim
- [ ] **Firma içi dava paylaşımı** — Çoklu avukat atama

### 6.3 Gelişmiş Analitik
- [ ] **Daire × sonuç heatmap** — Kazanma oranı analizi
- [ ] **Atıf etki grafiği** — Hangi kararlar en çok atıf alıyor
- [ ] **Arama trendi** — En çok aranan konular/mahkemeler

---

## FAZ 7: ALTYAPI & ÖLÇEKLENDİRME (Sürekli)

### 7.1 Altyapı
- [ ] **Prometheus metrikleri** — Ingestion count, search latency, LLM cost
- [ ] **Grafana dashboard** — Alerting (ingestion başarısız, API down)
- [ ] **Structlog JSON renderer** — Production'da JSON log (aggregation için)
- [ ] **Redis tabanlı request metrics** — In-memory → Redis (multi-worker)
- [ ] **Alembic migration** — `create_all()` → proper migration

### 7.2 Güvenlik
- [ ] **Secrets manager** — .env → HashiCorp Vault veya AWS Secrets
- [ ] **Key rotation** — JWT secret, API key periyodik değişim
- [ ] **Rate limiting Redis** — Global, endpoint bazlı

### 7.3 Ölçeklendirme
- [ ] **Redis Cluster** — Yüksek kullanımda
- [ ] **Qdrant replication** — Veri güvenliği
- [ ] **Load balancer** — Birden fazla backend replica

### 7.4 Gelecek
- [ ] **ColBERT vector desteği** — Arama kalitesi
- [ ] **UYAP Portal entegrasyonu** — Resmi entegrasyon
- [ ] **Mobil uygulama / PWA** — React Native veya PWA
- [ ] **Offline mod** — Service worker + cache

---

## TEKNİK BORÇ

- [ ] `Case.assigned_to` string → User FK normalize
- [ ] Audit trail (kim ne zaman ne değiştirdi)
- [ ] Soft delete tutarlılığı
- [ ] Bulk operasyon (toplu dava, toplu süre import)
- [ ] Arşivleme (eski kapalı davalar cold storage)
- [ ] Test coverage artırma
- [ ] API dokümantasyonu (setup guide)
- [ ] DRY: Ingestion pipeline tekrarlayan kod → `_process_items()` helper
- [ ] DRY: Celery task boilerplate → ortak decorator
- [ ] `CHECKPOINT_FILE` hardcoded path → config'e taşı
- [ ] `Deadline.reminder_days` → NotificationPreference ile entegre et

---

## ÖZET TABLO

| Faz | Kapsam | Süre | Öncelik |
|-----|--------|------|---------|
| **Faz 1** | 12 kritik güvenlik & bug fix | 1-2 gün | 🔴 Acil |
| **Faz 2** | 15 önemli backend iyileştirme | 1 hafta | 🔴 Acil |
| **Faz 3** | 18 frontend kalite & UX | 1 hafta | 🟡 Önemli |
| **Faz 4** | Veri zenginleştirme (50K+ hedef) | 2 hafta | 🟡 Önemli |
| **Faz 5** | Avukat ihtiyaçları (duruşma, müvekkil) | 2-3 hafta | 🟡 Önemli |
| **Faz 6** | Platform özellikleri (bildirim, SSO) | 1 ay | 🟢 Planlı |
| **Faz 7** | Altyapı & ölçeklendirme | Sürekli | 🟢 Planlı |
