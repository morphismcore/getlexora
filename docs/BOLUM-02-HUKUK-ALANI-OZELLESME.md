# BÖLÜM 2: HUKUK ALANI BAZINDA ÖZELLEŞME

> **Temel İlke:** Her hukuk alanının kendine özgü terminolojisi, süreçleri ve içtihat yapısı vardır. Genel bir "hukuk asistanı" değil, alan bazlı uzmanlaşmış ajan akışları gerekir.

---

## 2.1 CEZA HUKUKU — TAM AJAN AKIŞI

### Süreç Aşamaları ve Ajan Devreye Giriş Noktaları

```
SORUŞTURMA AŞAMASI                    KOVUŞTURMA AŞAMASI                 KANUN YOLU
─────────────────                    ─────────────────                 ──────────
Şikayet/İhbar                       İddianame Tebliği                İstinaf
    │                                     │                              │
    ▼                                     ▼                              ▼
Kolluk İşlemleri ──▶ [A]           Savunma Hazırlık ──▶ [B]        İstinaf Dilekçesi ──▶ [E]
    │                                     │                              │
    ▼                                     ▼                              ▼
İfade/Sorgu ──▶ [A]                Duruşma Hazırlık ──▶ [C]        İstinaf Karar ──▶ [F]
    │                                     │                              │
    ▼                                     ▼                              ▼
Tutuklama/Adli Kontrol ──▶ [D]    Duruşma Süreci ──▶ [C]          Temyiz ──▶ [E]
    │                                     │                              │
    ▼                                     ▼                              ▼
Savcılık Kararı ──▶ [A]           Karar ──▶ [F]                    Kesinleşme ──▶ [G]
```

**[A] Soruşturma Aşaması Ajan Kümesi:**
- `IctihatSearchAgent` → CMK 90-98 (gözaltı), 100-108 (tutuklama), 153 (dosya inceleme) içtihatları
- `DeadlineTrackerAgent` → Gözaltı süreleri (bireysel suç: 24 saat, toplu suç: 4 güne kadar), itiraz süreleri
- `DilekceWriterAgent` → Şüpheli müdafi dilekçeleri: tutuklama itirazı, tahliye talebi, delil inceleme talebi

**[B] Savunma Hazırlık Ajan Kümesi:**
- `DocumentReaderAgent` → İddianame analizi (suç vasfı, delil listesi, tanık listesi extract)
- `CaseStrategyAgent` → İddianameye karşı savunma stratejisi
- `EmsalAnalysisAgent` → Suç tipine göre emsal ceza miktarları, beraat oranları
- `EvidenceMatrixAgent` → Savcılık delilleri vs. savunma delilleri matrisi

**[C] Duruşma Hazırlık Ajan Kümesi:**
- `CaseStrategyAgent` → Muhtemel sorular, karşı argüman hazırlığı
- `IctihatSearchAgent` → Son duruşmada gündeme gelen konuya özel içtihat
- `JudgeProfileAgent` → O mahkemenin ceza davalarındaki eğilimleri

**[D] Tutuklama/Koruma Tedbirleri Ajan Kümesi:**
- `DeadlineTrackerAgent` → CMK 102: tutukluluk süresi takibi (ağır ceza: 2 yıl + 3 yıl uzatma, asliye ceza: 1 yıl + 6 ay uzatma)
- `DilekceWriterAgent` → Tahliye talep dilekçesi, tutukluluk incelemesi dilekçesi
- `IctihatSearchAgent` → AYM bireysel başvuru kararları (tutukluluk süresi ihlali)

**[E] Kanun Yolu Ajan Kümesi:**
- `DilekceWriterAgent` → İstinaf/temyiz dilekçesi (CMK 272-285, 286-307)
- `EmsalAnalysisAgent` → Bölge Adliye Mahkemesi ve Yargıtay'ın o suç tipindeki bozma gerekçeleri
- `DeadlineTrackerAgent` → İstinaf 7 gün, temyiz 15 gün (CMK 273, 291)

**[F] Karar Analizi:**
- `DocumentReaderAgent` → Mahkeme kararı analizi
- `CaseStrategyAgent` → Kanun yoluna başvuru değerlendirmesi (bozma ihtimali analizi)

**[G] Kesinleşme ve Sonrası:**
- `DeadlineTrackerAgent` → İnfaz süreleri, koşullu salıverilme hesaplaması
- `ClientReportAgent` → Müvekkile durum açıklaması

### Ceza Hukukunda En Çok Aranan İçtihat Türleri

1. **Suç vasfı tartışmaları:** Hırsızlık vs. yağma, kasten yaralama vs. öldürmeye teşebbüs, dolandırıcılık vs. güveni kötüye kullanma
2. **Haksız tahrik indirimi:** TCK 29 uygulaması, indirim oranı içtihatları
3. **Meşru savunma:** TCK 25 sınırları
4. **Zincirleme suç:** TCK 43 — aynı mağdura vs. farklı mağdurlara
5. **Etkin pişmanlık:** Suç tipine göre TCK'daki özel hükümler
6. **Tutukluluk süreleri:** AYM bireysel başvuru kararları
7. **Hukuka aykırı delil:** CMK 206/2-a, 217/2 — delil değerlendirme yasağı
8. **HAGB (Hükmün Açıklanmasının Geri Bırakılması):** CMK 231 koşulları ve uygulaması
9. **Ceza indirimi hesaplaması:** TCK 62 (takdiri indirim), 31 (yaş indirimi), 32 (akıl hastalığı)

### Savunma Dilekçesi vs. Müdahil Dilekçesi Farklılaştırması

**DilekceWriterAgent Konfigürasyonu:**

| Parametre | Savunma Dilekçesi | Müdahil (Katılma) Dilekçesi |
|-----------|-------------------|---------------------------|
| Perspektif | Sanık/şüpheli lehine | Mağdur/katılan lehine |
| Argüman yönü | Beraat, ceza indirimi, suç vasfı değişikliği | Mahkumiyet, ceza artırımı, tazminat |
| İçtihat filtresi | Beraat ve bozma kararları ağırlıklı | Mahkumiyet onama kararları ağırlıklı |
| Ton | Hakları vurgulayan, usuli güvenceler | Mağduriyeti vurgulayan, zararın büyüklüğü |
| Delil yaklaşımı | Hukuka aykırılık, yetersizlik | Delil gücü, tutarlılık |

### CMK Madde Bazlı Süre Takip Tablosu (DeadlineTrackerAgent)

```
Süre Tipi                    | Madde   | Süre        | Başlangıç
─────────────────────────────┼─────────┼─────────────┼────────────────
Gözaltı süresi (bireysel)   | CMK 91  | 24 saat     | Yakalama anı
Gözaltı süresi (toplu)      | CMK 91  | 4 güne kadar| Yakalama anı
Tutuklama itiraz             | CMK 101 | Süresiz     | Her zaman
Tutukluluk inceleme          | CMK 108 | 30 günde bir| Son inceleme
Tutukluluk üst sınır (ağır) | CMK 102 | 2+3 yıl     | Tutuklama tarihi
Tutukluluk üst sınır (asliye)| CMK 102 | 1+6 ay      | Tutuklama tarihi
İddianameye itiraz           | CMK 174 | 15 gün      | Tebliğ tarihi
İstinaf süresi               | CMK 273 | 7 gün       | Tebliğ tarihi
Temyiz süresi                | CMK 291 | 15 gün      | Tebliğ tarihi
Yargılamanın yenilenmesi     | CMK 311 | Süresiz     | -
```

### Birden Fazla Sanık/Suç Tipinde Koordinasyon

`OrchestratorAgent` özel modu: **Multi-defendant Ceza Akışı**

- Her sanık için ayrı savunma stratejisi (çıkar çatışması kontrolü dahil)
- Sanıklar arası argüman uyumu/çelişki analizi
- Suç tiplerinin birleşmesi/ayrılması değerlendirmesi (TCK 44: fikri içtima)
- Her sanığın süre takibi ayrı tutulur

---

## 2.2 TİCARET VE ŞİRKETLER HUKUKU — TAM AJAN AKIŞI

### Ana İş Akışları

```
SÖZLEŞME İŞLERİ          ŞİRKET İŞLERİ           DAVA/UYUŞMAZLIK
────────────────          ─────────────           ────────────────
Sözleşme İnceleme         Kuruluş                 Alacak Davası
    │                        │                        │
    ▼                        ▼                        ▼
Risk Analizi ──▶ [A]     Esas Sözleşme ──▶ [C]   Dava Analizi ──▶ [E]
    │                        │                        │
    ▼                        ▼                        ▼
Müzakere Destek ──▶ [B]  Genel Kurul ──▶ [C]     İhtarname ──▶ [F]
    │                        │                        │
    ▼                        ▼                        ▼
İmza/Kapanış               Yapı Değişikliği        İcra Takibi
                            M&A / Due Diligence ──▶ [D]
```

### [A] Sözleşme Analizi ve Risk Tespiti

**ContractAnalysisAgent — Ticaret Modu:**

```json
{
  "analiz_katmanlari": [
    {
      "katman": "emredici_hukum_uyumu",
      "aciklama": "TBK ve TTK emredici hükümleriyle çelişen maddeler",
      "ornek": "TBK 347 kira sözleşmesi uzama kurallarına aykırı madde",
      "risk_seviyesi": "kritik"
    },
    {
      "katman": "dengesiz_maddeler",
      "aciklama": "Tek tarafa aşırı avantaj sağlayan hükümler",
      "ornek": "Tek taraflı fesih hakkı yalnızca bir tarafa tanınmış",
      "risk_seviyesi": "yuksek"
    },
    {
      "katman": "eksik_maddeler",
      "aciklama": "Bu sözleşme türünde bulunması gereken ama olmayan maddeler",
      "ornek": "Gizlilik maddesi yok, mücbir sebep tanımı yok",
      "risk_seviyesi": "orta"
    },
    {
      "katman": "belirsiz_ifadeler",
      "aciklama": "Birden fazla yoruma açık ifadeler",
      "ornek": "'makul süre' tanımlanmamış, 'gerekli önlemler' somutlaştırılmamış",
      "risk_seviyesi": "dusuk"
    },
    {
      "katman": "rekabet_hukuku_uyum",
      "aciklama": "4054 sayılı Kanun ve RKHK kararlarıyla uyumluluk",
      "ornek": "Rekabet yasağı süre/coğrafi sınır aşımı",
      "risk_seviyesi": "kritik"
    }
  ]
}
```

### [B] Müzakere Desteği

**CaseStrategyAgent — Sözleşme Müzakere Modu:**
- Karşı tarafın muhtemel itiraz noktalarını tahmin eder
- Her tartışmalı madde için alternatif formülasyonlar önerir
- "Piyasa standardı nedir?" sorusuna veri bazlı cevap (benzer sözleşme veritabanından)

### [C] Şirket Esas Sözleşmesi ve Genel Kurul

**Özel Ajan: `CorporateComplianceAgent`**

- TTK madde kontrolü (anonim şirket: md. 329-564, limited şirket: md. 573-644)
- Esas sözleşme değişikliği için gerekli karar nisaplarını hesaplar
- Genel kurul çağrı prosedürü doğrulaması
- Pay devri kısıtlamaları analizi
- Ticaret Sicili tescil gereksinimlerini listeler

### [D] Due Diligence Desteği

**Özel Akış: M&A Due Diligence Pipeline**

```
Hedef Şirket Belgeleri Yükleme
         │
         ▼
DocumentReaderAgent ──▶ Tüm belgeleri parse et
         │
    ┌────┼──────────────┬──────────────┐
    ▼    ▼              ▼              ▼
Sözleşme  Dava/Uyuşmazlık  Vergi/SGK    Mülkiyet
Analizi    Taraması        Risk          Hakları
  │          │               │             │
  ▼          ▼               ▼             ▼
Birleştirilmiş Risk Raporu
```

- **Sözleşme taraması:** Tüm sözleşmelerde change of control maddeleri, devir kısıtlamaları, key person klozları
- **Dava taraması:** UYAP'tan (veya avukat verdiği listeden) aktif dava ve icra takipleri, potansiyel yükümlülükler
- **Vergi/SGK riski:** Matrah farkı, gecikme zammı, potansiyel ceza hesaplaması
- **Çıktı:** Executive summary + detaylı rapor + red flag listesi

### [E] Ticaret Mahkemesi İçtihat Örüntüleri

**EmsalAnalysisAgent — Ticaret Modu:**

Özelleşmiş arama alanları:
1. Yargıtay 11. HD (Ticaret Davaları) — marka, patent, haksız rekabet
2. Yargıtay 19. HD (Ticaret Davaları) — ticari alacak, sigorta
3. Yargıtay 23. HD — kooperatif, şirket, iflas
4. İstanbul BAM Ticaret Daireleri — büyük ticaret uyuşmazlıkları

Trend analizi:
- Cezai şart indirimi oranları (TBK 182/son fıkra uygulaması)
- Temerrüt faizi hesaplaması (avans faizi vs. yasal faiz)
- Ticari dava süresi ortalama ve dağılımı

### [F] Rekabet Hukuku Uyum Kontrolü

**Özel Ajan: `CompetitionComplianceAgent`**

- **Araçlar:** `yargi-mcp` Rekabet Kurulu kararları modülü, RKHK karar veritabanı
- Sözleşme/anlaşmalarda 4054 sayılı Kanun md. 4 (rekabeti sınırlayıcı anlaşmalar) ve md. 6 (hakim durumun kötüye kullanılması) riski tarama
- Birleşme/devralma bildirim eşik kontrolü
- Muafiyet değerlendirmesi (bireysel muafiyet / grup muafiyeti tebliğleri)

---

## 2.3 İŞ VE SOSYAL GÜVENLİK HUKUKU — TAM AJAN AKIŞI

### Ana İş Akışları

```
İŞE İADE                 TAZMİNAT DAVASI          ARABULUCULUK
─────────                 ────────────────          ────────────
İşten Çıkarma             İşçi Alacakları          Zorunlu Arabuluculuk
    │                        │                        │
    ▼                        ▼                        ▼
Fesih Analizi ──▶ [A]    Hesaplama ──▶ [C]        Başvuru ──▶ [E]
    │                        │                        │
    ▼                        ▼                        ▼
Arabuluculuk ──▶ [B]     Dava Açma ──▶ [D]        Müzakere ──▶ [E]
    │                        │                        │
    ▼                        ▼                        ▼
Dava ──▶ [D]              Karar                    Tutanak
```

### [A] Fesih Analizi — İşe İade Değerlendirmesi

**CaseStrategyAgent — İş Hukuku Modu:**

```json
{
  "fesih_kontrolu": {
    "is_guvenilirliği_kapsaminda_mi": {
      "isyeri_buyuklugu": ">=30 isci kontrolu",
      "kidem_suresi": ">=6 ay kontrolu",
      "belirli_sureli_mi": false,
      "isletme_muduru_mu": false
    },
    "fesih_sebebi_analizi": {
      "gecerli_sebep_mi": "performans|davranis|isletme geregi",
      "hakli_sebep_mi": "4857/25-II kontrolu",
      "son_care_ilkesi_uygulanmis_mi": true,
      "savunma_alinmis_mi": true,
      "orantililik_ilkesi": true
    },
    "usul_kontrolleri": {
      "yazili_fesih_bildirimi": true,
      "sebep_gosterilmis_mi": true,
      "ihbar_suresi_verilmis_mi": true
    }
  }
}
```

**Süreç:**
1. İşçi/işveren hangisinden bilgi alındığını belirle
2. Fesih türünü sınıflandır (haklı fesih / geçerli fesih / haksız fesih)
3. İşe iade şartlarını kontrol et (30 işçi, 6 ay kıdem, belirsiz süreli)
4. Fesih usulünü kontrol et (yazılı bildirim, sebep, savunma)
5. Son çare ilkesini değerlendir
6. Emsal kararlarla karşılaştır
7. Kazanma olasılığı hesapla

### [B] Zorunlu Arabuluculuk Süreci Desteği

**Özel Ajan: `MediationSupportAgent`**

- **Tetiklenme:** İş davası öncesi zorunlu arabuluculuk başvurusu yapılacağında
- **Araçlar:**
  - Arabuluculuk başvuru şablonu
  - UYAP arabuluculuk modülü entegrasyonu (browser extension)
  - Müzakere stratejisi motoru
- **İş akışı:**
  1. Başvuru dilekçesi oluştur
  2. Müvekkil taleplerini belirle (kıdem, ihbar, fazla mesai, yıllık izin)
  3. Karşı tarafın muhtemel teklif aralığını tahmin et (emsal kararlardan)
  4. Müzakere alt/üst sınır öner
  5. Tutanak taslağı hazırla (anlaşma veya anlaşamama)
- **Önemli:** Arabuluculuk son tutanak tarihi → dava açma süresi başlangıcı (2 hafta)

### [C] Kıdem/İhbar ve İşçi Alacakları Hesaplama

**Özel Ajan: `LaborCalculationAgent`**

- **Rolü:** Kıdem tazminatı, ihbar tazminatı, fazla mesai, AGİ, yıllık izin ücreti, ulusal bayram/genel tatil ücreti hesaplama
- **Araçlar:**
  - Hesaplama motoru (Türk iş hukuku formülleri)
  - SGK prim gün ve kazanç verileri (kullanıcının girdiği)
  - Kıdem tazminatı tavan verileri (yıllar bazında güncellenen)
  - Asgari ücret tarihi verileri
  - Faiz hesaplama (en yüksek banka mevduat faizi)
- **Girdi:**
  ```json
  {
    "ise_giris_tarihi": "2018-03-15",
    "isten_cikis_tarihi": "2026-01-20",
    "son_brut_ucret": 45000,
    "ek_odemeler": {"yol": 2000, "yemek": 3000, "ikramiye_yillik": 12000},
    "fazla_mesai_saatleri": {"2025": 180, "2024": 220},
    "kullanilmayan_izin_gunu": 14,
    "fesih_turu": "isverenin_hakli_nedensiz_feshi"
  }
  ```
- **Çıktı:**
  ```json
  {
    "kidem_tazminati": {
      "brut": 315000,
      "net": 315000,
      "hesaplama_detayi": "7 yıl 10 ay 5 gün × giydirilmiş ücret (52,000 TL, tavan: 53,000 TL)",
      "tavan_kontrolu": "tavan aşılmadı"
    },
    "ihbar_tazminati": {
      "brut": 40000,
      "net": 34000,
      "sure": "8 hafta (3 yıldan fazla kıdem)"
    },
    "fazla_mesai": {
      "toplam": 85000,
      "hesaplama": "saat başı ücret × 1.5 × toplam saat",
      "uyari": "Yargıtay uygulamasında %30 hakkaniyet indirimi uygulanmaktadır"
    },
    "yillik_izin_ucreti": {
      "toplam": 21000,
      "gun": 14,
      "gunluk_brut": 1500
    },
    "toplam_alacak": {
      "brut": 461000,
      "tahmini_net": 400000
    },
    "faiz": {
      "kidem": "en yüksek banka mevduat faizi, fesih tarihinden itibaren",
      "diger": "yasal faiz, temerrüt tarihinden itibaren"
    },
    "uyari": "Bu hesaplama tahmini olup, mahkeme farklı değerlendirme yapabilir. Özellikle giydirilmiş ücret ve fazla mesai saatleri konusunda ispat yükü işçidedir."
  }
  ```
- **Başarı kriteri:** Hesaplama doğruluğu %99+ (formül bazlı, LLM değil)
- **Başarısızlık modu:** Eksik veri varsa ("SGK kayıtlı ücret mi, elden ödeme var mı?" sorar), varsayım yapıyorsa açıkça belirtir

### [D] İş Mahkemesi Dava Akışı

**Özelleşmiş İçtihat Arama Konfigürasyonu:**

```json
{
  "mahkeme_filtre": ["yargitay_9hd", "yargitay_22hd", "yargitay_hgk"],
  "konu_kategorileri": [
    "ise_iade",
    "kidem_tazminati",
    "ihbar_tazminati",
    "fazla_mesai",
    "mobbing",
    "is_kazasi",
    "meslek_hastaligi",
    "sendika_hakki",
    "esit_davranma"
  ],
  "onemli_ilkeler": [
    "son_care_ilkesi",
    "hakli_neden_ispati_yuku",
    "giydirilmis_ucret_hesabi",
    "hakkaniyet_indirimi_oranlari",
    "zamanasimai_5_yil"
  ]
}
```

### [E] Yargıtay 9. HD ve 22. HD Özelleşmiş Arama

**EmsalAnalysisAgent — İş Hukuku Modu:**

**9. Hukuk Dairesi Ana Alanları:**
- İşe iade davaları
- Kıdem ve ihbar tazminatı
- Fazla mesai alacağı
- İş güvencesi

**22. Hukuk Dairesi Ana Alanları:**
- Yıllık ücretli izin
- Ulusal bayram ve genel tatil ücreti
- Hafta tatili ücreti
- AGİ alacağı

**Trend Analizi Çıktısı:**
```json
{
  "konu": "ise_iade",
  "donem": "2023-2026",
  "trendler": [
    {
      "baslik": "Geçerli fesih sebebi değerlendirmesinde son care ilkesinin katılaşması",
      "aciklama": "2024'ten itibaren 9. HD, işverenin başka pozisyon teklif etme yükümlülüğünü daha sıkı denetliyor",
      "referans_kararlar": ["2024/1234", "2024/5678"]
    },
    {
      "baslik": "Fazla mesai ispatında WhatsApp yazışmalarının delil değeri",
      "aciklama": "2023'ten itibaren mesaj kayıtları delil olarak kabul ediliyor",
      "referans_kararlar": ["2023/9012"]
    }
  ]
}
```

### Arabuluculuk Süre Takibi (DeadlineTrackerAgent — İş Hukuku)

```
Süre Tipi                           | Dayanak      | Süre
────────────────────────────────────┼──────────────┼──────────
Zorunlu arabuluculuk başvuru süresi | 7036/3       | Dava şartı
Arabuluculuk süreci                 | 7036/3       | 3 hafta (+1 uzatma)
Arabuluculuk sonrası dava açma      | 7036/3       | 2 hafta
İşe iade dava açma                  | 4857/20      | 1 ay (arabuluculuktan sonra)
Fesih bildirimi itiraz              | 4857/20      | 1 ay (fesih tebliğinden)
Kıdem/ihbar zamanaşımı              | 4857/32      | 5 yıl
Fazla mesai zamanaşımı              | 4857/32      | 5 yıl
Yıllık izin zamanaşımı              | 4857/32      | 5 yıl
İş kazası zamanaşımı                | TBK 72       | 2 yıl / 10 yıl
```
