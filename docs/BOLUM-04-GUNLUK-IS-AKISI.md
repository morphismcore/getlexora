# BÖLÜM 4: AVUKATIN GÜNLÜK İŞ AKIŞINA TAM ENTEGRASYON

> **Temel İlke:** Ürün bir "arama motoru" değil, avukatın sabahtan akşama yanında olan bir iş akışı asistanıdır. Avukat son kararı verir, sistem destekler.

---

## 4.1 Sabah Rutini (08:00-09:00) — Günlük Briefing

### Tetiklenme
- Otomatik: Her iş günü saat 07:30'da hazırlanır, avukat uygulamayı açtığında gösterilir
- Manuel: Avukat "Bugünkü özetimi göster" dediğinde

### Ajan Akışı (Paralel)

```
07:30 Cron Trigger
    │
    ├──▶ DeadlineTrackerAgent
    │    → Bugünün ve yaklaşan 7 günün süreleri
    │    → Hak düşürücü süre uyarıları (kırmızı)
    │    → Duruşma takvimi
    │
    ├──▶ IctihatSearchAgent (Yeni Kararlar Modu)
    │    → Avukatın aktif alanlarında son 24 saatte
    │      yayımlanan Yargıtay/Danıştay kararları
    │    → Sadece avukatın aktif davalarıyla ilgili olanlar
    │
    ├──▶ MevzuatSearchAgent (Değişiklik Modu)
    │    → Son 24 saatte Resmi Gazete'de yayımlanan
    │      avukatın alanlarıyla ilgili mevzuat değişiklikleri
    │
    └──▶ UYAPMonitorAgent (Browser Extension)
         → Gece gelen UYAP bildirimleri (duruşma tarihi
           değişikliği, tebligat, karar vs.)
         → NOT: Bu avukatın UYAP'a kendi girmesiyle
           senkronize olur
```

### Çıktı: Sabah Dashboard

```
┌─────────────────────────────────────────────────────────┐
│ 🌅 Günaydın Av. Mehmet — 19 Mart 2026, Perşembe        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ 🔴 ACİL — HAK DÜŞÜRÜCÜ SÜRELER                         │
│ ─────────────────────────────────────────                │
│ • Yılmaz vs. ABC Ltd. — İstinaf süresi: 2 GÜN KALDI   │
│   (Son gün: 21 Mart 2026, Cumartesi → 23 Mart Pazartesi)│
│   [İstinaf dilekçesi hazırla →]                         │
│                                                          │
│ 📅 BUGÜNKÜ DURUŞMALAR                                  │
│ ─────────────────────────────────────────                │
│ • 10:30 — İstanbul 3. İş Mahkemesi                     │
│   Kaya vs. XYZ A.Ş. (İşe iade)                         │
│   Durum: 2. duruşma, tanık dinlenecek                   │
│   [Duruşma hazırlığı →] [Dosya özeti →]                │
│                                                          │
│ • 14:00 — İstanbul 12. Asliye Ticaret                   │
│   DEF Ltd. vs. GHI A.Ş. (Alacak)                       │
│   Durum: Bilirkişi raporu geldi, beyana hazırlan        │
│   [Bilirkişi raporu analizi →] [İtiraz taslağı →]      │
│                                                          │
│ 📰 YENİ İÇTİHATLAR (İlgi alanlarınız)                 │
│ ─────────────────────────────────────────                │
│ • Yargıtay 9. HD — İşe iade davasında WhatsApp          │
│   yazışmalarının delil değeri hk. yeni karar            │
│   [Özet oku →] [Tam karar →]                            │
│                                                          │
│ • Yargıtay 11. HD — Rekabet yasağı süresinin            │
│   2 yılı aşamayacağına dair emsal                       │
│   [Özet oku →]                                           │
│                                                          │
│ 📋 AKTİF DAVALAR DURUMU (12 aktif dava)                │
│ ─────────────────────────────────────────                │
│ • 3 davada bu hafta işlem gerekiyor                     │
│ • 2 davada UYAP'ta yeni bildirim var                    │
│ [Tüm davaları gör →]                                    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 4.2 Dava Açma/Alma — Müvekkil Geldiğinde

### Akış

```
Müvekkil Anlatıyor (Sesli veya Yazılı)
    │
    ▼
┌──────────────────────────────────┐
│ Müvekkil Dinleme Modu            │
│                                   │
│ Avukat müvekkilin anlattıklarını │
│ sisteme girer (yazarak veya      │
│ ses kayıt → transkript)          │
│                                   │
│ Sistem gerçek zamanlı:           │
│ • Hukuki terimleri işaretler     │
│ • Zaman çizelgesi oluşturur      │
│ • Eksik bilgi noktalarını        │
│   tespit eder                    │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ OrchestratorAgent                │
│ Intent: "Yeni dava değerlendirme"│
└──────────┬───────────────────────┘
           │
    ┌──────┼──────────┬──────────────┐
    ▼      ▼          ▼              ▼
[Alan    [Süre       [İçtihat     [Strateji
Tespiti] Hesaplama]  Ön Tarama]   Ön Analiz]
```

### Adım 1: Otomatik Dava Özeti Çıkarma

```json
{
  "dava_ozeti": {
    "taraflar": {
      "muvekkil": "Ahmet Yılmaz, TC: ..., Adres: ...",
      "karsi_taraf": "XYZ Ltd. Şti."
    },
    "olay_kronolojisi": [
      {"tarih": "2024-01-15", "olay": "İşe girdi"},
      {"tarih": "2025-12-20", "olay": "İşten çıkarıldı, fesih bildirimi tebliğ edildi"},
      {"tarih": "2026-01-10", "olay": "Avukata başvurdu"}
    ],
    "muvekkil_talepleri": ["İşe iade", "Boşta geçen süre ücreti", "Kıdem tazminatı (terditli)"],
    "tespit_edilen_hukuk_alani": "İş hukuku — İşe iade",
    "uygulanacak_mevzuat": ["4857 sayılı İş Kanunu md. 18-21", "7036 sayılı Kanun md. 3"],
    "eksik_bilgiler": [
      "İşyeri personel sayısı (30 altında mı üstünde mi?)",
      "Fesih gerekçesi (yazılı bildirimde ne yazıyor?)",
      "SGK hizmet dökümü"
    ]
  }
}
```

### Adım 2: Alan Tespiti ve İçtihat Ön Taraması (Paralel)

```
IctihatSearchAgent:
→ "İşe iade + geçerli neden + son 2 yıl" araması
→ İlk 10 emsal özet olarak sunulur

EmsalAnalysisAgent:
→ Benzer davalarda sonuç dağılımı:
  "Son 2 yılda benzer 847 işe iade davasında:
   - %62 işe iade kararı
   - %24 red kararı
   - %14 feragat/sulh ile sonuçlanmış
   NOT: Bu istatistik genel bir göstergedir."
```

### Adım 3: Süre Hesaplaması

```
DeadlineTrackerAgent:
→ "Fesih bildirimi tebliğ tarihi: 20.12.2025
   Zorunlu arabuluculuk başvuru son tarihi: Süresiz (ama dava için şart)
   İşe iade davası açma son tarihi: Arabuluculuk son tutanağından itibaren 2 hafta
   ÖNERİ: Arabuluculuk başvurusunu en kısa sürede yapın.

   ⚠ DİKKAT: Fesih tarihinden itibaren 1 ay içinde arabuluculuğa
   başvurulması gerekmektedir (4857 md. 20).
   GERİ KALAN SÜRE: 12 GÜN"
```

### Adım 4: Hızlı Strateji Ön Raporu

```
CaseStrategyAgent:
→ "ÖN DEĞERLENDİRME (Avukat onayı gerektirir)

   Güçlü yönler:
   • 5 yılı aşkın kıdem → iş güvencesi kapsamında
   • Savunma alınmamış (bildirime göre) → usul hatası
   • Performans düşüklüğü iddiası için PIP süreci uygulanmamış

   Zayıf yönler:
   • İşyerinde 30 kişi altı olma ihtimali → araştırılmalı
   • Müvekkilin bazı devamsızlık kayıtları olabilir

   Tahmini sonuç: İşe iade olasılığı ORTA-YÜKSEK
   (Kesin değerlendirme, belgeler incelendikten sonra yapılacaktır)

   ÖNERİLEN ADIMLAR:
   1. SGK hizmet dökümü iste
   2. Fesih bildiriminin aslını incele
   3. İşyeri personel listesini doğrula
   4. Arabuluculuk başvurusu yap"
```

---

## 4.3 Araştırma Oturumu

### Doğal Dil Sorgusu Akışı

```
Avukat: "İşe iade davasında işveren fesihte savunma almamışsa
         ve performans düşüklüğünü kanıtlayamıyorsa ne olur?
         Son 2 yılın Yargıtay kararlarını göster."
    │
    ▼
OrchestratorAgent → IctihatSearchAgent + MevzuatSearchAgent (paralel)
    │
    ▼
┌──────────────────────────────────────────────────────┐
│ ARAŞTIRMA SONUÇLARI                                   │
│                                                        │
│ 📚 İÇTİHATLAR (12 sonuç, en ilgili 5'i gösteriliyor)│
│                                                        │
│ 1. Yargıtay 9. HD 2025/4567 E., 2025/7890 K. [✓]   │
│    "İşverenin fesihten önce işçinin savunmasını       │
│    almaması, feshi geçersiz kılar..."                 │
│    Relevance: ████████░░ 95%                          │
│    [Tam karar] [Dava dosyasına kaydet]                │
│                                                        │
│ 2. Yargıtay 9. HD 2024/2345 E., 2024/6789 K. [✓]   │
│    "Performans düşüklüğüne dayanan fesihte,           │
│    işverenin objektif kriterleri ortaya koyması..."    │
│    Relevance: ████████░░ 91%                          │
│    [Tam karar] [Dava dosyasına kaydet]                │
│                                                        │
│ 📖 MEVZUAT                                            │
│ • 4857 sayılı İK md. 19: "...işçinin savunması        │
│   alınmadan... feshedilemez" [✓ Güncel metin]         │
│                                                        │
│ 📝 ÖZET RAPOR                                         │
│ "İşverenin fesih öncesi savunma almaması HMK/4857    │
│  md. 19 gereği usul eksikliği oluşturur. Yargıtay    │
│  yerleşik içtihadına göre bu durum tek başına feshi   │
│  geçersiz kılmaya yeterlidir. Buna ek olarak,         │
│  performans düşüklüğünün objektif kriterlerle          │
│  kanıtlanamaması da feshi geçersiz kılar."            │
│                                                        │
│ [📥 PDF olarak indir] [📋 Dava dosyasına kaydet]     │
│ [🔄 Aramayı genişlet] [✏️ Dilekçeye aktar]           │
└──────────────────────────────────────────────────────┘
```

### Kaynaklı Özet Rapor Üretme

Avukat araştırma sonuçlarından "Özet rapor üret" dediğinde:

```
Hukuki Araştırma Raporu
━━━━━━━━━━━━━━━━━━━━━━
Konu: İşverenin savunma almadan ve performans düşüklüğünü
      kanıtlayamadan fesih yapması
Tarih: 19.03.2026
Hazırlayan: Lexora AI Araştırma Asistanı

1. SORU
İşverenin fesih öncesi savunma almaması ve performans
düşüklüğünü objektif kriterlerle kanıtlayamaması durumunda
feshin geçerliliği nedir?

2. İLGİLİ MEVZUAT
• 4857 sayılı İş Kanunu md. 18: Geçerli fesih sebepleri
• 4857 sayılı İş Kanunu md. 19: Fesih usulü
• 4857 sayılı İş Kanunu md. 20-21: İşe iade

3. İÇTİHAT DEĞERLENDİRMESİ
[Referanslarıyla birlikte detaylı analiz]

4. SONUÇ VE DEĞERLENDİRME
[Avukatın kendi yorumunu ekleyeceği alan]

⚠ Bu rapor AI destekli araştırma aracı tarafından
üretilmiştir. Hukuki tavsiye niteliği taşımaz.
```

---

## 4.4 Dilekçe Yazma Akışı

### Tam Akış

```
Avukat: "Yılmaz dosyası için işe iade dava dilekçesi hazırla"
    │
    ▼
OrchestratorAgent → DilekceWriterAgent
    │
    ▼
Dava dosyasından context yükle (taraflar, olay özeti, deliller)
    │
    ├──▶ IctihatSearchAgent (işe iade + somut olay uyumlu emsal)
    ├──▶ MevzuatSearchAgent (İK 18-21, HMK ilgili maddeler)
    ├──▶ MemoryAgent (avukatın yazım stili, tercih ettiği format)
    │
    ▼
Dilekçe Taslağı Üretimi (Streaming — bölüm bölüm gelir)
    │
    ▼
┌──────────────────────────────────────────────────────┐
│ DİLEKÇE TASLAK GÖRÜNÜMÜ                             │
│                                                        │
│ 📄 İŞE İADE DAVA DİLEKÇESİ                          │
│                                                        │
│ İSTANBUL ( ). İŞ MAHKEMESİ'NE                        │
│                                                        │
│ Davacı: Ahmet YILMAZ                                  │
│ Vekili: Av. Mehmet ...                                │
│ Davalı: XYZ Ltd. Şti.                                │
│                                                        │
│ KONU: Feshin geçersizliği ve işe iade talebi          │
│                                                        │
│ AÇIKLAMALAR:                                           │
│                                                        │
│ 1. Müvekkilimiz davalı işyerinde 15.01.2024          │
│    tarihinden itibaren... çalışmıştır.                │
│                                                        │
│ [Her paragrafın yanında kaynak göstergesi]             │
│                                                        │
│ "Yargıtay 9. HD'nin 2025/4567 E. sayılı kararında   │
│  da belirtildiği üzere..." [✓ Doğrulanmış]           │
│                                                        │
│ ─── SOL PANEL: Kullanılan Kaynaklar ───              │
│ │ 1. Yargıtay 9. HD 2025/4567 [✓]                  │
│ │ 2. Yargıtay 9. HD 2024/2345 [✓]                  │
│ │ 3. 4857 s.K. md. 18 [✓]                           │
│ │ 4. 4857 s.K. md. 19 [✓]                           │
│                                                        │
│ ─── ALT PANEL: Uyarılar ───                          │
│ │ ⚠ Delil listesinde tanık bildirilmemiş             │
│ │ ⚠ İşyeri personel sayısı belgesi eklenmeli         │
│ │ ✓ Çelişki tespit edilmedi                          │
│ │ ✓ Tüm referanslar doğrulandı                       │
│                                                        │
│ [📝 Düzenle] [📥 DOCX İndir] [📥 PDF İndir]        │
│ [🔄 Yeniden üret] [✏️ Stil ayarla]                   │
└──────────────────────────────────────────────────────┘
```

### Avukat Stili Öğrenme (MemoryAgent)

Avukat ilk 5 dilekçesini yüklediğinde sistem:
1. Cümle uzunluğu ortalaması ve dağılımı
2. Sık kullandığı kalıplar ("arz ve talep ederiz" vs "arz olunur")
3. Paragraf yapısı (kısa-öz vs detaylı-uzun)
4. İçtihat yerleştirme stili (metin içi vs dipnot)
5. Argüman sıralaması tercihi (kronolojik vs önem sırasına göre)

Bu bilgiler style embedding olarak saklanır ve her dilekçe üretiminde kullanılır.

---

## 4.5 Duruşma Hazırlığı

### 24 Saat Önce Otomatik Hazırlık Paketi

```
DeadlineTrackerAgent → "Yarın duruşma var" tetiklemesi
    │
    ▼
OrchestratorAgent → Paralel ajan çağrıları:
    │
    ├──▶ DocumentReaderAgent → Dosya özeti çıkar
    │    (tüm dava belgeleri, son duruşma tutanağı, bilirkişi raporu)
    │
    ├──▶ CaseStrategyAgent → Muhtemel hakim soruları
    │    (dosya içeriği + hakimin önceki davaları analizi)
    │
    ├──▶ OpposingCounselAgent → Karşı taraf hazırlığı
    │    (karşı dilekçelerden argüman çıkarma)
    │
    └──▶ EvidenceMatrixAgent → Delil matrisi güncellemesi
```

### Duruşma Hazırlık Çıktısı

```
┌──────────────────────────────────────────────────────┐
│ 📋 DURUŞMA HAZIRLIK PAKETİ                           │
│ Dava: Kaya vs. XYZ A.Ş. | 3. İş Mahkemesi           │
│ Tarih: 20.03.2026 Saat: 10:30                        │
│                                                        │
│ 1. DOSYA ÖZETİ (2 sayfa)                             │
│    • Dava konusu: İşe iade                            │
│    • Duruşma sayısı: Bu 2. duruşma                    │
│    • Son duruşmada: Delil ibrazı için süre verildi    │
│    • Bu duruşmada beklenen: Tanık dinlenmesi          │
│                                                        │
│ 2. MUHTEMEL HAKİM SORULARI                            │
│    • "İşyerinde kaç kişi çalışıyordu?"               │
│    • "Fesih bildirimi tebliğ tarihi nedir?"           │
│    • "İşveren savunma aldı mı?"                       │
│    • "Performans değerlendirme belgesi var mı?"       │
│    Hazırlık notu: SGK kayıtlarını dosyada hazır tut  │
│                                                        │
│ 3. KARŞI TARAF ARGÜMAN TAHMİNİ                       │
│    • "İşçi performans kriterlerini karşılamamıştır"   │
│      → Cevabınız: PIP uygulanmamış, somut kriter yok │
│    • "Savunma alınmıştır, işçi imzadan kaçınmıştır"  │
│      → Cevabınız: Tutanak yok, tanık yok              │
│                                                        │
│ 4. DELİL MATRİSİ                                     │
│    ┌──────────────┬────────┬──────────┐              │
│    │ İddia        │ Delil  │ Durum    │              │
│    ├──────────────┼────────┼──────────┤              │
│    │ Savunma      │ -      │ ⚠ Yok   │              │
│    │ alınmadı     │        │          │              │
│    ├──────────────┼────────┼──────────┤              │
│    │ 5+ yıl       │ SGK    │ ✓ Hazır │              │
│    │ kıdem        │ dökümü │          │              │
│    ├──────────────┼────────┼──────────┤              │
│    │ 30+ çalışan  │ SGK    │ ✓ Hazır │              │
│    │              │ listesi│          │              │
│    └──────────────┴────────┴──────────┘              │
│                                                        │
│ [📥 PDF İndir] [📱 Mobilde Görüntüle]               │
└──────────────────────────────────────────────────────┘
```

---

## 4.6 Müvekkil İletişimi

### Dava Durumu Raporu (Teknik Olmayan Dil)

```
ClientReportAgent Çıktısı:

Sayın Ahmet Bey,

Davanızla ilgili güncel durumu aşağıda özetliyorum:

NE OLDU:
20 Mart 2026 tarihinde İstanbul 3. İş Mahkemesi'nde
2. duruşma yapıldı. Bu duruşmada tanıklarımız dinlendi
ve beyanları tutanağa geçirildi.

NE ANLAMA GELİYOR:
Tanık beyanları lehinize oldu. Özellikle iş arkadaşınız
Fatma Hanım'ın, işten çıkarılmanızdan önce savunmanızın
alınmadığına dair beyanı davamızı güçlendirdi.

BİR SONRAKİ ADIM:
Bir sonraki duruşma 15 Mayıs 2026'da saat 11:00'de.
Bu duruşmada karşı tarafın tanıkları dinlenecek.
Sizin bu duruşmaya katılmanız gerekmektedir.

TAHMİNİ SÜREÇ:
Davamızın yaklaşık 2-3 duruşma daha sürmesini bekliyoruz.
Tahmini karar tarihi 2026 yaz sonu olabilir.

Herhangi bir sorunuz olursa bana ulaşabilirsiniz.

Saygılarımla,
Av. Mehmet ...
```

### Otomatik Üretim Kuralları

1. Hukuk terminolojisi kullanılmaz (veya kullanılırsa parantez içinde açıklanır)
2. Müvekkilin ne yapması gerektiği açıkça belirtilir
3. Tahmini süre ve maliyet konusunda dikkatli dil kullanılır
4. Kötü haber varsa yapıcı bir dille sunulur
5. Avukat, göndermeden önce raporu mutlaka gözden geçirir ve onaylar

---

## 4.7 Akşam Kapanış Rutini (17:00-18:00)

```
┌──────────────────────────────────────────────────────┐
│ 📊 GÜNLÜK ÖZET                                       │
│                                                        │
│ Bugün tamamlanan:                                     │
│ ✓ Kaya vs. XYZ duruşması (2. duruşma tamamlandı)    │
│ ✓ Yılmaz dosyası istinaf dilekçesi taslağı hazır     │
│ ✓ 3 araştırma sorgusu tamamlandı                     │
│                                                        │
│ Yarın yapılacaklar:                                    │
│ • 10:00 — Arabuluculuk görüşmesi (DEF dosyası)       │
│ • Yılmaz istinaf dilekçesi son kontrol ve gönderme   │
│ • Yeni müvekkil görüşmesi (14:00)                    │
│                                                        │
│ Bu hafta dikkat:                                       │
│ ⚠ 2 hak düşürücü süre (Çarşamba ve Cuma)            │
└──────────────────────────────────────────────────────┘
```
