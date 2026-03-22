# BÖLÜM 5: UYAP ENTEGRASYONU — GERÇEKÇİ YAKLAŞIM

> **Temel İlke:** UYAP entegrasyonu piyasada kimsenin tam anlamıyla yapmadığı şey. Hukuki ve teknik riskleri bilerek, avukatın onayı dahilinde, kademeli bir strateji izlenmeli.

---

## 5.1 UYAP'a Yasal ve Teknik Erişim Yolları

### Mevcut Durum (Mart 2026)

**UYAP Avukat Portalı:**
- Web tabanlı uygulama: https://avukat.uyap.gov.tr
- e-imza veya mobil imza ile giriş
- Avukatın kendi davalarına, duruşma takvimlerine, tebligatlara erişim
- Belgeler UDF formatında

**Resmi API Durumu:**
- Adalet Bakanlığı Bilgi İşlem Daire Başkanlığı'nın resmi bir public API'si **bulunmamaktadır** (Mart 2026 itibarıyla)
- UYAP Bilişim sistemlerine üçüncü taraf yazılımlar doğrudan API ile bağlanamaz
- Adalet Bakanlığı'nın e-Devlet entegrasyonları ve barolar arası veri paylaşımı protokolleri mevcut, ancak bunlar kurumsal düzeyde

**2025-2026 Gelişmeleri:**
- Adalet Bakanlığı Dijital Dönüşüm projesi kapsamında bazı açık veri girişimleri tartışılıyor
- e-Devlet API gateway üzerinden sınırlı veri paylaşımı (dava sorgulama) mümkün olabilir
- Kesin bir "UYAP API açılacak" takvimi yok

### Erişim Yolu Değerlendirmesi

| Yöntem | Fizibilite | Risk | Süre |
|--------|-----------|------|------|
| Resmi API partnership (Bakanlık ile) | Düşük-Orta | Düşük | 12-24 ay |
| e-Devlet entegrasyonu | Orta | Düşük | 6-12 ay |
| Browser extension | Yüksek | Orta | 2-4 ay |
| Avukatın dosya yüklemesi | Çok yüksek | Çok düşük | 2 hafta |
| Screen scraping / bot | **YASAK** | **Çok yüksek** | - |

---

## 5.2 Browser Extension Yaklaşımı — Detaylı Analiz

### Teknik Mimari

```
┌─────────────────────────────────────┐
│ UYAP Avukat Portalı (Tarayıcıda)   │
│ avukat.uyap.gov.tr                   │
│                                      │
│  Avukat kendi e-imzasıyla giriş     │
│  yapar (extension bunu DEĞİŞTİRMEZ)│
└──────────────┬──────────────────────┘
               │
               │ DOM Okuma (read-only)
               │
┌──────────────▼──────────────────────┐
│ Lexora Browser Extension             │
│                                      │
│ Content Script:                      │
│ • Sayfa DOM'unu okur                 │
│ • Dava listesini parse eder         │
│ • Duruşma tarihlerini çıkarır       │
│ • Tebligat bildirimlerini yakalar    │
│ • UDF indirme butonlarını tespit eder│
│                                      │
│ YAPMAZ:                              │
│ • Form doldurmaz                     │
│ • Butona tıklamaz                    │
│ • İşlem yapmaz                       │
│ • Kimlik bilgisi saklamaz            │
│ • e-imza/parola kaydetmez            │
└──────────────┬──────────────────────┘
               │
               │ Encrypted API call
               │ (sadece avukat onaylı veri)
               │
┌──────────────▼──────────────────────┐
│ Lexora Backend                       │
│                                      │
│ Gelen veri:                          │
│ • Dava listesi (numara, taraflar)    │
│ • Duruşma tarihleri                  │
│ • Tebligat bildirimleri              │
│ • İndirilen UDF/PDF dosyaları        │
│   (avukat onayladığında)             │
└─────────────────────────────────────┘
```

### Extension'ın Okuyabileceği Veriler

| Veri | Okunabilir mi | Nasıl |
|------|--------------|-------|
| Dava listesi (esas numaraları) | Evet | DOM parse |
| Duruşma tarihleri | Evet | DOM parse |
| Tebligat bildirimleri | Evet | DOM parse + notification API |
| Dava tarafları | Evet | DOM parse |
| Dosya belgeleri (UDF/PDF) | Evet, avukat tetiklerse | İndirme sonrası |
| Hakim bilgisi | Kısmen | Dava detay sayfasından |
| Duruşma tutanağı | Evet, avukat tetiklerse | İndirme sonrası |

### Extension'ın Okuyamayacağı / Yapamayacağı Şeyler

- e-imza veya parola bilgisine erişemez (ve erişmemeli)
- UYAP'ta işlem yapamaz (dilekçe gönderme, ödeme vs.)
- Avukatın izni olmadan veri aktaramaz
- Başka avukatların davalarına erişemez
- UYAP'ın güvenlik mekanizmalarını bypass edemez

### Avukat Onay Akışı

```
Extension dava listesini okur
    │
    ▼
"Lexora 12 aktif davanızı tespit etti.
 Senkronize edilsin mi?"
    │
    ├── [Hepsini senkronize et]
    ├── [Seçerek senkronize et]
    └── [İptal]
    │
    ▼ (Avukat onayladıysa)
Seçilen davalar Lexora'ya aktarılır
    │
    ▼
"Dava bilgileri senkronize edildi.
 Duruşma takvimi ve süre uyarıları aktif."
```

---

## 5.3 UDF Dosya Formatı

### UDF Nedir?

UDF (UYAP Document Format), UYAP sistemi tarafından kullanılan özel bir belge formatıdır. Esasen dijital imzalı, şifrelenmiş bir konteyner formatıdır.

### Teknik Yapısı

```
UDF Dosya Yapısı:
├── Header (meta bilgi, imza bilgisi)
├── Content (asıl belge içeriği)
│   ├── Genellikle TIFF veya PDF formatında
│   └── Bazen HTML formatında
├── Digital Signature (e-imza verisi)
└── Certificate Chain (sertifika zinciri)
```

### UDF Okuma Stratejisi

**Yöntem 1: UYAP'ın kendi UDF Viewer uygulamasını kullanma**
- UYAP, ücretsiz UDF Viewer dağıtıyor
- Command-line interface'i yok, GUI uygulaması
- Otomasyon için uygun değil

**Yöntem 2: Reverse-engineering UDF formatı**
- Hukuki risk: Adalet Bakanlığı'nın fikri mülkiyet hakları
- Teknik zorluk: İmza doğrulama, şifreleme katmanı
- **Önerilmez** — yasal ve teknik riskler çok yüksek

**Yöntem 3: UDF → PDF dönüştürme (önerilen)**
```
Avukat UYAP'tan belgeyi indirir (UDF)
    │
    ▼
UYAP Viewer ile açar → PDF olarak dışa aktar
    │
    ▼
PDF'i Lexora'ya yükler
    │
    ▼
DocumentReaderAgent PDF'i okur
```

**Yöntem 4: Browser Extension ile PDF yakalaması**
```
Avukat UYAP'ta belgeyi görüntülediğinde
    │
    ▼
Extension, UYAP'ın PDF viewer'ına render edilen
içeriği yakalar (browser print-to-PDF)
    │
    ▼
Avukat onaylarsa Lexora'ya aktarılır
```

### Kütüphane/Araç Önerileri

| Araç | Kullanım | Platform |
|------|----------|----------|
| PyMuPDF (fitz) | PDF okuma, OCR | Python |
| Tesseract + Türkçe pak | OCR (taranmış belgeler) | Cross-platform |
| Apache Tika | Multi-format extraction | Java/Python wrapper |
| LayoutLMv3 | Belge yapı analizi | Python (Hugging Face) |

---

## 5.4 Hukuki Risk Değerlendirmesi

### Adalet Bakanlığı'nın Bakış Açısı

**Bilinen tutum:**
- UYAP verileri "avukatın kişisel kullanımı" içindir
- Toplu veri çekme (scraping) açıkça yasaklanmıştır
- Üçüncü taraf yazılımlara veri aktarımı konusunda net bir düzenleme yoktur
- Avukatın kendi verisi üzerinde tasarruf hakkı tartışmalıdır

**Emsal durumlar:**
- Kazancı, Lexpera gibi firmalar UYAP'tan doğrudan veri almaz, kamuya açık karar veritabanlarından faydalanır
- Baro yazılımları (e-baro) UYAP ile sınırlı entegrasyon yapabilmektedir (protokol bazlı)
- Hiçbir özel yazılım şirketi UYAP'a doğrudan API erişimi elde edememiştir

### Risk Azaltma Stratejisi

```
1. ASLA scraping/bot kullanma
   → Sadece browser extension ile read-only erişim
   → Avukatın kendi tarayıcısında, kendi oturumunda

2. Veri minimizasyonu
   → Sadece avukatın açıkça onayladığı veriler aktarılır
   → Kişisel veri (TC kimlik no vs.) backend'e gönderilmez, lokal işlenir
   → Veriler avukatın kendi tenant'ında saklanır

3. Şeffaflık
   → Extension'ın ne okuduğu, ne aktardığı açıkça gösterilir
   → Avukat istediğinde tüm verisini silebilir

4. Hukuki danışmanlık
   → Adalet Bakanlığı Bilgi İşlem Daire Başkanlığı'na yazılı başvuru
   → Barolarla işbirliği (baro kanalıyla resmi görüş talep etme)
   → KVKK uyumluluk raporu

5. Adım adım yaklaşım
   → V1: Sadece PDF yükleme (sıfır risk)
   → V2: Extension ile duruşma takvimi okuma (düşük risk)
   → V3: Extension ile belge senkronizasyonu (orta risk, bakanlık görüşü sonrası)
```

---

## 5.5 Alternatif: Manuel PDF Yükleme (V1 — Sıfır Risk)

### Kullanıcı Deneyimi

```
┌──────────────────────────────────────────────────────┐
│ 📂 DOSYA YÜKLE                                       │
│                                                        │
│ ┌────────────────────────────────────────────┐        │
│ │                                            │        │
│ │     📄 PDF, DOCX veya UDF dosyalarını      │        │
│ │        buraya sürükleyin                    │        │
│ │                                            │        │
│ │     veya [Dosya Seç] butonuna tıklayın     │        │
│ │                                            │        │
│ └────────────────────────────────────────────┘        │
│                                                        │
│ Toplu yükleme: UYAP'tan indirdiğiniz tüm              │
│ belgeleri bir klasörden topluca yükleyebilirsiniz      │
│                                                        │
│ 💡 İpucu: UYAP'ta "Tüm belgeleri indir"              │
│ seçeneğiyle dosyaları ZIP olarak indirip              │
│ buraya yükleyebilirsiniz.                              │
│                                                        │
│ Desteklenen formatlar: PDF, DOCX, UDF, ZIP, TIFF      │
│                                                        │
│ 🔒 Dosyalarınız şifreli olarak saklanır ve sadece     │
│    sizin hesabınızdan erişilebilir.                    │
└──────────────────────────────────────────────────────┘
```

### Sorunsuz Yükleme İçin Optimizasyonlar

1. **Drag & Drop:** Birden fazla dosyayı sürükleyip bırakma
2. **ZIP desteği:** UYAP'tan toplu indirilen ZIP dosyalarını otomatik açma
3. **OCR pipeline:** Taranmış belgeleri otomatik okuma
4. **Otomatik sınıflandırma:** Yüklenen belgenin türünü otomatik tespit
   - "Bu bir dilekçe mi, karar mı, bilirkişi raporu mu, tebligat mı?"
5. **Otomatik dava eşleştirme:** Belgede geçen esas numarasından hangi davaya ait olduğunu tespit
6. **Progress tracking:** Büyük dosyalar için yükleme durumu
7. **Hata toleransı:** Okunamayan sayfa varsa kullanıcıyı bilgilendir, geri kalanı işle

### Klasör İzleme (Desktop App — opsiyonel)

```
Avukat, bilgisayarında bir "UYAP İndirilenler" klasörü belirler
    │
    ▼
Lexora Desktop Agent bu klasörü izler (file watcher)
    │
    ▼
Yeni dosya indirildiğinde otomatik algılar
    │
    ▼
"Yeni dosya tespit edildi: Yilmaz_karar.pdf
 Hangi davaya eklensin?"
    │
    ├── [Yılmaz vs. XYZ dosyasına ekle]
    ├── [Yeni dava oluştur]
    └── [Şimdi değil]
```

---

## 5.6 UYAP Entegrasyonu Yol Haritası

```
AY 1-2: V1 — Manuel Yükleme
├── PDF/DOCX yükleme + OCR
├── Otomatik belge sınıflandırma
├── Otomatik dava eşleştirme
└── Risk: ★☆☆☆☆ (yok)

AY 3-4: V2 — Browser Extension (Read-Only)
├── Dava listesi okuma
├── Duruşma takvimi senkronizasyonu
├── Tebligat bildirimi yakalama
├── Hukuki danışmanlık tamamlandı
└── Risk: ★★☆☆☆ (düşük)

AY 5-8: V3 — Akıllı Senkronizasyon
├── Belge senkronizasyonu (avukat onayı ile)
├── Otomatik süre hesaplaması (UYAP verisi ile)
├── Dava durumu takibi
├── Bakanlık görüşü alındıktan sonra
└── Risk: ★★★☆☆ (orta)

AY 9-12+: V4 — Resmi Entegrasyon (uzun vadeli hedef)
├── Baro kanalıyla resmi protokol
├── e-Devlet API entegrasyonu (mümkün olursa)
├── Çift yönlü entegrasyon (okuma + yazma)
└── Risk: ★★☆☆☆ (düşük — resmi kanal)
```
