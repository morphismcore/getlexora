# Lexora — Yapılacaklar Listesi (Detaylı)

> Bu dosya 24 Mart 2026'da oluşturuldu.
> Ajanların planladığı ama yapılamayan işler + projeyi dünyanın en iyi hukuk platformu yapacak iyileştirmeler.

---

## 1. FRONTEND — Sıfırdan Yeniden Yazılması Gereken Sayfalar

### 1.1 Arama Sayfası (`frontend/app/arama/page.tsx`)
Projenin kalbi. Şu an çalışıyor ama tasarım eski kaldı.

**Yapılacaklar:**
- Hero search bar: Büyük, gösterişli, focus'ta glow border, placeholder'da dönen örnek sorgular (typewriter)
- Gelişmiş filtre paneli: Katlanabilir, hukuk_alani dropdown, mahkeme multi-select, daire, tarih aralığı
- Tab switcher: "İçtihat Arama", "Mevzuat", "AI Asistan (RAG)" — 3 mod
- Sonuç kartları yeniden tasarım:
  - Mahkeme badge (renkli, mahkeme tipine göre)
  - Esas No / Karar No / Tarih belirgin
  - Özet'te arama terimlerinin highlight'lanması (mevcut ama iyileştirilebilir)
  - Relevance score güzel progress bar
  - Verification status badge
  - "Tam Metin" genişletme butonu
  - "Davaya Ekle" ve "Doğrula" aksiyon butonları
- AI Asistan tab:
  - Streaming response: cursor animasyonuyla akan metin
  - Kaynaklar önce tıklanabilir badge olarak
  - Verification sonuçları inline
  - Markdown render
- Sonuç sayısı ve süre gösterimi ("23 sonuç, 0.4s")
- Boş state: önerilen sorgular
- Arama geçmişi sidebar
- Sayfalama veya infinite scroll
- Skeleton loading state
- Aramayı davaya kaydetme

### 1.2 Dilekçe Sayfası (`frontend/app/dilekce/page.tsx`)
**Yapılacaklar:**
- Auto-save: localStorage'a her 30 saniyede otomatik kayıt, sayfa yenilenince geri yükleme
- Şablon galerisi: Güzel grid, kategori kartları (İş Hukuku, Ceza, Ticaret, İdare, Aile, İcra-İflas)
- Her kategori kartı: Ayırt edici renk/ikon, şablon sayısı, tıklayınca genişleme
- Şablon editörü: Sol form, sağ canlı önizleme (serif font)
- Dışa aktarma: "Kopyala", "DOCX İndir", "PDF İndir" butonları
- Şablon arama/filtre
- Son kullanılan şablonlar
- Alt paragraf sayısı 26'dan (a-z) fazla olabilmeli

### 1.3 Belge Analiz Sayfası (`frontend/app/belge/page.tsx`)
**Yapılacaklar:**
- Drag & drop upload zone: rounded-2xl, sürükleme animasyonu (scale-[1.01]), dashed border animasyonu
- Desteklenen format ikonları: PDF, DOCX, TXT
- Yükleme progress bar (yüzdelik)
- Analiz sonuçları yeniden tasarım:
  - Belge özeti bölümü
  - Çıkarılan entity'ler: taraflar, tarihler, tutarlar, atıflar — her biri güzel kartta
  - İlgili içtihat önerileri (içeriğe göre)
  - Risk/sorun vurgulama
  - Belge tipi sınıflandırma badge
- Belge görüntüleyici: Temiz metin, highlighted entity'ler, sidebar entity listesi
- Aksiyon butonları: "Davaya Ekle", "Atıfları Doğrula", "Dışa Aktar"
- Yükleme geçmişi
- Citation extraction → tıklayınca doğrulama sayfasına yönlendirme

### 1.4 Süre Hesapla Sayfası (`frontend/app/sureler/page.tsx`)
**Yapılacaklar:**
- İki bölüm: "Süre Hesapla" (hesaplayıcı) ve "Sürelerim" (kayıtlı süreler)
- Hesaplayıcı:
  - Preset süre türleri otomatik gün hesaplamalı
  - Görsel sonuç: Büyük countdown display, hesaplanan tarih
  - Mini takvim görünümü (deadline tarihini vurgulayan)
  - Resmi tatil farkındalık göstergesi
- Sürelerim:
  - Timeline/takvim görünümü
  - Renk kodlu aciliyet (kırmızı <3 gün, turuncu <7 gün, yeşil >7 gün)
  - Sıralanabilir liste görünümü
  - Tamamlandı toggle
  - İlişkili davaya link
  - Her süre için countdown
- Takvim görünümü (liste alternatifi)
- Tekrarlayan süre oluşturma ("her 7 günde 4 hafta boyunca")
- Yazdırma optimize görünüm

### 1.5 İstatistik Sayfası (`frontend/app/istatistik/page.tsx`)
**Yapılacaklar:**
- Hero stat satırı: Büyük animated counter'lar (toplam dava, aktif, tamamlanan süre, toplam arama)
- Arama analitiği:
  - En çok aranan terimler (tag cloud veya bar chart — pure SVG)
  - Arama aktivitesi zaman grafiği (line chart — SVG)
  - Arama tipi dağılımı (ictihat vs mevzuat — donut chart SVG)
- Dava analitiği:
  - Tür bazlı dağılım (pie/donut)
  - Durum bazlı (aktif/beklemede/kapandı — horizontal bar)
  - Aylık dava oluşturma trendi
- Süre analitiği:
  - Tamamlanma oranı (circular progress)
  - Yaklaşan vs gecikmiş sayısı
  - Süre tipi dağılımı
- Aktivite timeline'ı: Son aramalar, dava işlemleri, süre tamamlamaları
- Tüm chart'lar pure SVG/CSS (chart kütüphanesi YOK)
- Zaman periyodu seçici (Bu Hafta, Bu Ay, Son 3 Ay, Tüm Zamanlar)
- İstatistik dışa aktarma butonu (CSV, JSON)

### 1.6 Doğrulama Sayfası (`frontend/app/dogrulama/page.tsx`)
**Yapılacaklar:**
- Textarea: rounded-2xl, daha iyi focus stili ✅ (yapıldı)
- Batch verification: Birden fazla atıf yapıştırma
- Sonuçlar dışa aktarılabilir olmalı
- Şüpheli atıf flagleme (imkansız numara tespiti)
- Diğer sayfalarla entegrasyon: Belge upload → tespit edilen atıflar → tıklayınca doğrula

### 1.7 Davalar Sayfası (`frontend/app/davalar/page.tsx`)
**Yapılacaklar:**
- Kart tasarımı: rounded-2xl
- Input stili tutarlılığı: rounded-xl, focus:bg-[#16161A]
- Modal: rounded-2xl
- Dava detay paneli iyileştirme
- Padding tutarlılığı

### 1.8 Admin Sayfası (`frontend/app/admin/page.tsx`)
**Yapılacaklar:**
- Tab stili iyileştirme
- Tablo stili: daha iyi hover, satır arası çizgiler
- Ingestion dashboard: progress bar animasyonu
- Embedding breakdown chart iyileştirme

---

## 2. FRONTEND — Shared Component İyileştirmeleri

### 2.1 Command Palette (`frontend/components/ui/command-palette.tsx`)
- ✅ Glassmorphism backdrop (yapıldı)
- ✅ Accent glow active state (yapıldı)
- Fuzzy search highlight (eşleşen karakterler bold)
- Keyboard navigation göstergeleri (ok ikonları footer'da)

### 2.2 Badge (`frontend/components/ui/badge.tsx`)
- "outline" varyant ekle
- "gradient" varyant ekle

### 2.3 Confidence Bar (`frontend/components/ui/confidence-bar.tsx`)
- Glow efekti ekle
- Animated label girişi
- size prop (sm, md, lg)

### 2.4 Empty State (`frontend/components/ui/empty-state.tsx`)
- "use client" + motion/react import
- İkon, başlık, açıklama için staggered fade-in-up animasyonu
- Dekoratif glow ring

### 2.5 Loading Skeleton (`frontend/components/ui/loading-skeleton.tsx`)
- Daha iyi shimmer: dual-layer efekt (shimmer + pulse)
- Staggered animation delays
- Yeni SkeletonAvatar export'u

### 2.6 Kayıt Sayfası Baro Dropdown
- Şu an 20 baro var, Türkiye'deki 80+ baronun tamamı eklenmeli
- Arama özellikli dropdown (çok uzun liste için)

---

## 3. FRONTEND — Design System Tamamlama

### 3.1 globals.css (Eklenmesi Gerekenler)
- ✅ ::selection renkleri (yapıldı)
- ✅ focus-visible stiller (yapıldı)
- ✅ .glass, .glass-heavy (yapıldı)
- ✅ .gradient-text (yapıldı)
- ✅ .gradient-border (yapıldı)
- ✅ .glow-accent/success/warning (yapıldı)
- ✅ Firefox scrollbar (yapıldı)
- ✅ smooth scroll (yapıldı)
- ✅ reduced-motion (yapıldı)
- ✅ print stiller (yapıldı)
- ✅ .tabular-nums (yapıldı)
- ✅ .noise-bg (yapıldı)
- Eksik: slide-down, scale-in, bounce-subtle keyframe'leri
- Eksik: backdrop-blur utility sınıfları

---

## 4. BACKEND — İyileştirmeler

### 4.1 Health Check ✅ (yapıldı)
- ✅ Qdrant point count
- ✅ Redis memory
- ✅ Postgres SELECT 1
- ✅ response_time_ms

### 4.2 Request Logging Middleware ✅ (yapıldı)
- ✅ method, path, status, duration_ms

### 4.3 Config Genişletme ✅ (yapıldı)
- ✅ Celery ayarları
- ✅ Ingestion tuning
- ✅ max_upload_size_mb

### 4.4 Ingestion State ✅ (yapıldı)
- ✅ last_update
- ✅ progress_pct
- ✅ Stack trace logging

### 4.5 Yapılmamış Backend İşler
- **Ingestion durumunu veritabanına kaydetme**: _ingest_state in-memory, restart'ta kayboluyor → IngestionJob tablosu oluşturulmalı
- **Dashboard'a total_embeddings ekleme**: qdrant_documents var ama total_embeddings alias'ı yok
- **Hata mesajları standartlaştırma**: Structured error response (error_code, message, hint)
- **Verification robustness**: Kısmi karar numaraları handle etme, şüpheli pattern flagleme
- **Vector DB optimizasyonu**: Domain bazlı koleksiyon (iş hukuku, ticaret, idare ayrı)
- **Rate limiting**: Global ingestion rate limit
- **Bedesten fallback**: API down olunca graceful degradation
- **Token counting**: LLM maliyet takibi
- **Prometheus metrikleri**: Ingestion count, search latency, LLM cost

---

## 5. BACKEND — Celery Worker Mimarisi (OPTIMIZATION_ROADMAP.md'den)

Bu büyük bir iş — OPTIMIZATION_ROADMAP.md dosyasında detaylı plan var.

### Özet:
- Celery worker ayrı process olarak çalışacak
- Embedding üretimi backend'i bloklamayacak
- Redis broker + result backend
- Celery Beat ile zamanlı görevler (03:00 günlük ingestion)
- Task iptal, retry, monitoring
- SSE → Redis Pub/Sub ile canlı bildirimler
- Docker compose'a worker + beat servisleri eklenmeli

### Fazlar:
1. Celery altyapısı (worker.py, tasks/, config)
2. Task'ları taşı (asyncio.create_task → task.delay())
3. Paralel fetch + SSE (Redis Pub/Sub)
4. Test ve deploy

---

## 6. VERİ ÇEKME (Ingestion) — Acil

### Mevcut Durum:
- İçtihat: 4,735 embedding (yetersiz, 50,000+ olmalı)
- Mevzuat: 0 embedding (hiç çekilmemiş!)
- AYM: 0 embedding
- AİHM: 0 embedding

### Yapılacaklar:
1. **Mevzuat ingestion başlat**: Temel kanunlar (4857, 5237, 6098, 6100, 5271, 2004, 6102, 2709 vb.)
2. **AYM kararları çek**: Bireysel başvuru kararları (ihlal kararları öncelikli)
3. **AİHM kararları çek**: Türkiye aleyhine kararlar (HUDOC API)
4. **İçtihat artırma**: Daha fazla konu ve sayfa ile toplu ingestion
5. **Sistematik çekme**: Daire bazlı, tarih bazlı, konu bazlı
6. **Otomatik güncelleme**: Günlük scheduler'ın çalıştığından emin ol

---

## 7. YENİ ÖZELLİKLER (Avukatların Yalvaracağı Şeyler)

### 7.1 Bildirim Sistemi
- Süre yaklaşınca e-posta/SMS bildirimi
- In-app bildirim çanı
- N gün önceden hatırlatma (ayarlanabilir)

### 7.2 İşbirliği
- Gerçek zamanlı belge düzenleme (WebSocket)
- Dava/süre yorumları
- Firma içi dava paylaşımı

### 7.3 Şablon Kütüphanesi
- Kullanıcı oluşturmalı özel şablonlar
- Şablon versiyonlama
- Firma içi şablon paylaşımı

### 7.4 Gelişmiş Analitik
- Daire × sonuç heatmap'i
- Kazanma oranı analizi
- Atıf etki grafiği
- Hangi konular/mahkemeler en çok aranıyor

### 7.5 Offline Mod
- Service worker ile arama cache
- Read-only offline dökümanlar

### 7.6 Mobil Uygulama
- React Native (veya PWA)
- Push notification
- Temel arama ve süre takibi

### 7.7 OAuth2 / SSO
- Google/Microsoft login
- Baro entegrasyonu (varsa)
- API key authentication (dış entegrasyonlar)

### 7.8 Şifre Sıfırlama
- E-posta ile şifre sıfırlama akışı (şu an yok!)

---

## 8. ALTYAPI & OPERASYON

### 8.1 Yedekleme
- Qdrant ve PostgreSQL volume'ları otomatik yedekleme
- Günlük cron job ile dış depolama

### 8.2 Monitoring
- Prometheus metrikleri
- Grafana dashboard
- Alerting (ingestion başarısız, API down)

### 8.3 CI/CD
- GitHub Actions pipeline
- Otomatik test → build → deploy

### 8.4 Güvenlik
- Secrets manager (şu an .env dosyası)
- Key rotation politikası
- Rate limiting iyileştirme

### 8.5 Ölçeklendirme
- Redis Cluster
- Qdrant replication
- Load balancer (birden fazla backend replica)

---

## 9. TEKNİK BORÇ

- `Case.assigned_to` virgülle ayrılmış string → User FK normalize edilmeli
- Audit trail yok (kim ne zaman ne değiştirdi)
- Soft delete tutarsız (case kapandı ama diğer kayıtlar hard delete)
- Bulk operasyon yok (toplu dava, toplu süre import)
- Arşivleme yok (eski kapalı davaları cold storage'a taşıma)
- Test coverage düşük (11 test dosyası var ama kapsam bilinmiyor)
- API dokümantasyonu (Swagger otomatik ama setup guide yok)

---

## ÖNCELİK SIRASI (Güncellenmiş — 24 Mart 2026)

### ✅ Tamamlanan (Bu Oturumda)
- ~~Arama sayfası yeniden yazımı~~ ✅ (typewriter, 3 tab, glow, Danıştay filtreleri)
- ~~Dilekçe auto-save~~ ✅ (30s interval + 10 built-in şablon + PDF/DOCX export)
- ~~Süre takvim görünümü~~ ✅ (mini takvim, countdown, iş günü, Sürelerim tab)
- ~~İstatistik SVG chart'lar~~ ✅ (donut, bar, line, circular progress — pure SVG)
- ~~Belge sayfası iyileştirme~~ ✅ (drag&drop, progress bar, entity card, upload history)
- ~~Shared component'ler~~ ✅ (badge outline/gradient, confidence glow, empty-state motion, skeleton dual-layer)
- ~~Celery worker mimarisi~~ ✅ (worker.py, tasks/, beat, docker-compose)
- ~~Monitoring & CI/CD~~ ✅ (admin monitoring dashboard, CI/CD tam çalışıyor)
- ~~Kayıt 80+ baro~~ ✅ (81 il, aranabilir dropdown)
- ~~Landing page~~ ✅ (veri kaynakları, güven unsurları, CTA, footer)
- ~~27 kritik fix~~ ✅ (güvenlik, backend, frontend, DevOps, AI/Search)

### ✅ Tamamlanan (Oturum 2 — 24 Mart 2026)
- ~~Admin panelden ingestion tetikle~~ ✅ (batch + daire bazlı + tarih bazlı butonlar, gelişmiş ingestion paneli)
- ~~Mevzuat ingestion~~ ✅ (24 temel kanun, ingest_mevzuat(), mevzuat_embeddings koleksiyonu)
- ~~AYM + AİHM ingestion~~ ✅ (ingest_batch() ile entegre, Celery task'lar)
- ~~İçtihat sistematik çekme~~ ✅ (daire bazlı, tarih bazlı, konu bazlı parametreler)
- ~~E-posta hatırlatma sistemi~~ ✅ (SMTP servisi, HTML template, Celery Beat 08:00, bildirim tercihleri)
- ~~Şifre sıfırlama akışı~~ ✅ (token bazlı, rate limited, 2 yeni sayfa)
- ~~RAG/AI asistan durumu~~ ✅ (/health/llm endpoint, AI tab'da durum badge)
- ~~50+ dilekçe şablonu~~ ✅ (10 → 55 şablon, 8 kategori, doğru kanun atıfları)
- ~~Cross-encoder reranking~~ ✅ (ms-marco-MiniLM-L-6-v2, config ile açılıp kapanabilir)
- ~~Query expansion~~ ✅ (65+ hukuk kısaltması, 35+ eş anlamlı terim grubu)

### 🟢 Planlı (Gelecek Ay)
1. ColBERT vector desteği
2. Bildirim sistemi (in-app + push)
3. İşbirliği özellikleri
4. UYAP Portal entegrasyonu
5. Mobil uygulama / PWA
