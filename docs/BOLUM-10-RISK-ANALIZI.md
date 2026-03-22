# BÖLÜM 10: RİSK VE BAŞARISIZLIK SENARYOLARI

> **Temel İlke:** Her risk için "erken uyarı sinyali ne?" ve "tetiklendiğinde ilk 48 saatte ne yapılır?" sorularına net cevap verilmelidir.

---

## Risk 1: Hallüsinasyon Güven Krizi — "Avukat Yanlış İçtihadı Mahkemede Kullandı"

### Senaryo
Sistem hallüsine bir içtihat referansı üretir. Avukat bunu doğrulamadan dilekçeye koyar. Hakim veya karşı taraf bunu fark eder. Avukat mesleki itibarını kaybeder. Ürüne güvenmez, ayrılır, başkalarına anlatır.

### Olasılık: ORTA-YÜKSEK (ilk 6 ayda)
### Etki: KRİTİK (ürünü öldürebilir)

### Erken Uyarı Sinyalleri
- Citation verification success rate <%95'e düştü
- Kullanıcı feedback'te "yanlış karar numarası" şikayeti geldi
- LLM model güncellemesi sonrası hallücinasyon oranı arttı
- Yeni bir hukuk alanına genişleme sonrası kalite düştü

### Kurtarma Planı

**Önleme (proaktif):**
```
1. Citation verification pipeline'ı ASLA bypass edilemez
2. Doğrulanamayan referans → KIRMIZI etiket + "Manuel doğrulama gerekir" uyarısı
3. Her dilekçe çıktısının altında:
   "Bu taslaktaki referanslar otomatik doğrulanmıştır [✓].
    Yine de avukatın bağımsız kontrolü önerilir."
4. Kullanıcı onboarding'de: "Sistem yardımcıdır, karar sizindir"
   vurgusu
5. Haftalık hallücinasyon audit: Random 100 cevap → insan kontrolü
```

**Kriz anında (48 saat planı):**
```
Saat 0-4:
├── Sorun tespit edildi → Hangi çıktıda, hangi referansta
├── İlgili avukata anında ulaş (telefon + email)
├── "Bu referansın doğrulanamadığını tespit ettik" bildirimi
└── Dilekçede kullanıldıysa: Düzeltme stratejisi öner

Saat 4-12:
├── Kök neden analizi: Neden doğrulama yakalamadı?
├── Pipeline fix: Benzer hallücinasyonu yakalayacak kural ekle
├── Tüm kullanıcılara: Şeffaf iletişim (eğer yaygınsa)
└── Etkilenen tüm çıktıları retroaktif kontrol

Saat 12-48:
├── Kalıcı düzeltme deploy et
├── Etkilenen avukata: Ücretsiz 3 ay + kişisel destek
├── Post-mortem raporu hazırla
└── Hallücinasyon test setine bu vakayı ekle (regression test)
```

**Uzun vadeli:**
- "Hallücinasyon sıfır tolerans" politikası → her sprint'te hallücinasyon oranı ölçülür
- Güven skorunu UI'da merkeze koy → kullanıcıyı eğit
- "Doğrulanamayan referans" sayısı haftalık KPI olarak takip

---

## Risk 2: Veri Kaynağı Kaybı — "yargi-mcp Çalışmayı Durdurursa"

### Senaryo
yargi-mcp (açık kaynak/topluluk projesi) bakımı durur, API değişir, erişim kesilir veya yasal sorun çıkar. Ürünün içtihat arama yeteneği çöker.

### Olasılık: ORTA
### Etki: YÜKSEK

### Erken Uyarı Sinyalleri
- yargi-mcp GitHub repo'sunda commit aktivitesi azaldı (30+ gün inaktif)
- API yanıt süresi artıyor (p95 > 2 saniye)
- API hata oranı artıyor (%5+)
- Resmi kurumlardan (Adalet Bakanlığı) erişim kısıtlama sinyalleri
- Projenin maintainer'ı ayrılma sinyalleri verdi

### Kurtarma Planı

**Önleme (proaktif):**
```
1. Çoklu veri kaynağı stratejisi (gün 1'den itibaren):
   ├── Birincil: yargi-mcp
   ├── İkincil: Doğrudan web scraping (yasal çerçevede)
   ├── Üçüncül: Kamuya açık karar veritabanları
   └── Yedek: Kendi karar veritabanı (zamanla büyüyen)

2. Veri kopyalama ve caching:
   ├── Erişilen her karar lokal veritabanına kaydedilir
   ├── Aylık full snapshot (mevcut tüm kararların kopyası)
   └── 6 ayda 500K+ karar birikir → bağımsız çalışma kapasitesi

3. yargi-mcp'ye katkı:
   ├── Projeye contributor ol (kod katkısı)
   ├── Maintainer ile ilişki kur
   └── Gerekirse projenin fork'unu sürdürebilecek kapasiteyi hazırla
```

**Kriz anında:**
```
Saat 0-4:
├── Fallback veri kaynağına otomatik geçiş (health check + circuit breaker)
├── Kullanıcılara: "Arama hızında geçici yavaşlama olabilir" bildirimi
└── yargi-mcp maintainer'a ulaş: Sorunun kaynağını öğren

Gün 1-7:
├── Lokal karar veritabanı ile arama devam eder (cache'lenmiş kararlar)
├── Alternatif kaynakları (Kazancı web, Lexpera web) manual entegre et
└── Kendi scraping pipeline'ını aktif et (yasal sınırlar dahilinde)

Gün 7-30:
├── Kendi karar toplama altyapısını inşa et
├── Barolarla veri paylaşım anlaşması yap
└── Adalet Bakanlığı açık veri girişimlerini takip et
```

---

## Risk 3: Rakip Kopyalaması — "Kazancı veya Lexpera Aynı Özellikleri 3 Ayda Kopyalarsa"

### Senaryo
Kazancı veya Lexpera (50 yıllık kuruluşlar, devasa içtihat veritabanları, mevcut avukat tabanı) AI özelliği ekler. Mevcut müşteri tabanını leverage ederek hızla aynı özellikleri sunar.

### Olasılık: YÜKSEK (kesinlikle olacak)
### Etki: YÜKSEK

### Erken Uyarı Sinyalleri
- Kazancı/Lexpera iş ilanlarında "AI", "NLP", "LLM" aramaları arttı
- Ürünlerinde "beta" veya "yapay zeka" etiketi çıktı
- Sektör konferanslarında AI demolar yapıyorlar
- Müşterilerden "Kazancı'da da AI gelmiş, neden sizi tercih edeyim?" sorusu

### Kurtarma Planı

**Stratejik savunma hattı (korunabilir avantajlar):**
```
1. WORKFLOW > ARAMA
   Kazancı/Lexpera "AI arama" ekler. Biz zaten "iş akışı asistanı"yız.
   ├── Onlar: "Sorunu sor, cevap al"
   └── Biz: "Sabah briefingi → araştırma → dilekçe → duruşma hazırlığı → müvekkil raporu"
   Workflow kopyalamak arama kopyalamaktan 10x zor.

2. KİŞİSELLEŞTİRME HENDEK
   ├── 6 aylık kullanıcının stil tercihleri, arama pattern'leri, dava geçmişi birikmiş
   ├── Geçiş maliyeti yüksek: "Yeni sisteme baştan başlamak"
   └── Network etkisi: Büro içinde herkes kullanıyorsa birey ayrılamaz

3. HIZLI İTERASYON
   ├── Startup avantajı: Haftalık release, 48 saatte hotfix
   ├── Kazancı kurumsal yapısında özellik ekleme 3-6 ay sürer
   └── Avukat feedback'inden ürüne dönüşüm süresi: 1-2 hafta (biz) vs 3-6 ay (onlar)

4. VERTİKAL DERİNLİK
   ├── Genel AI arama yerine alan bazlı uzmanlaşma
   ├── İş hukuku kıdem hesaplama, ceza hukuku süre takibi gibi özel özellikler
   └── Bunları kopyalamak her alan için 3+ ay ek süre

5. UYAP ENTEGRASYONU
   ├── Biz extension ile UYAP verisini çekiyoruz, onlar yapmıyor
   └── Bu "dava dosyası → akıllı asistan" zincirini tamamlıyor
```

**Fiyat savaşına hazırlık:**
```
Kazancı "AI eklendi, ek ücret yok" derse:
├── Bizim AI kalitesi daha yüksek olmalı (sürekli benchmark)
├── Ücretsiz tier genişlet (freemium)
├── "Lexora + Kazancı aboneliğinizi birlikte kullanın" mesajı
│   (rakibi düşman değil, tamamlayıcı olarak konumla)
└── Enterprise segment'e odaklan (Kazancı bireysel, biz büro)
```

---

## Risk 4: Kullanıcı Büyümesi Yetersiz — "İlk 6 Ayda Yeterli Kullanıcı Gelmezse"

### Senaryo
6 ayda 50+ ücretli kullanıcı hedefine ulaşılamıyor. Burn rate devam ediyor, gelir yeterli değil. Pivot mi yapılmalı, devam mı edilmeli?

### Olasılık: ORTA
### Etki: YÜKSEK (şirket ölümü)

### Erken Uyarı Sinyalleri
- Ay 3 sonunda <10 aktif trial kullanıcı
- Trial → ücretli dönüşüm oranı <%20
- Demo talebi az (<5/hafta)
- NPS < 30
- Avukatlar "güzel ama benim için değil" diyor

### Kurtarma Planı

**Burn rate kontrolü:**
```
5 kişilik ekip, İstanbul:
├── Maaşlar: ~₺350,000/ay
├── Altyapı (cloud, LLM API): ~₺30,000/ay
├── Diğer: ~₺20,000/ay
└── Toplam: ~₺400,000/ay

6 aylık pist: ₺2,400,000
12 aylık pist: ₺4,800,000

Kısıtlı bütçe modu (3 kişilik ekip):
├── ₺200,000/ay
└── 12+ ay pist ile aynı parayla
```

**Pivot senaryoları (Ay 6 sonunda değerlendir):**

| Sinyal | Pivot Yönü | Neden |
|--------|-----------|-------|
| Avukat istemiyor ama hukuk öğrencisi istiyor | Eğitim platformu | Daha büyük pazar, daha düşük beklenti |
| Bireysel avukat istemiyor ama firma istiyor | B2B enterprise odak | Tek büyük müşteri = aylarca gelir |
| Türkçe hukuk çalışmıyor ama RAG pipeline güçlü | Farklı dikey (tıp, finans, mühendislik) | Teknik yetkinliği değerlendir |
| Hiçbir şey çalışmıyor | Consulting/özel proje | Teknolojiyi danışmanlık olarak sat |

**Pivot karar matrisi:**
```
Ay 6 sonunda:
├── MRR > ₺30K + NPS > 40 → DEVAM (tam gaz)
├── MRR ₺10-30K + NPS > 30 → DEVAM (ama strateji revize)
├── MRR < ₺10K + NPS > 40 → FIYATLANDIRMA SORUNU (düzelt)
├── MRR < ₺10K + NPS < 30 → PIVOT DÜŞÜN (ciddi değişiklik)
└── MRR = 0 + kullanıcı yok → PIVOT YAP (farklı segment)
```

---

## Risk 5: KVKK ve Veri Güvenliği — "Avukat Müvekkil Verisini Sisteme Girerse"

### Senaryo
Avukat, müvekkilinin kişisel verilerini (TC kimlik, adres, sağlık bilgileri, adli sicil) sisteme girer. Bu veriler:
1. Sızdırılırsa: Avukat-müvekkil gizliliği ihlali + KVKK cezası
2. LLM'e gönderilirse: 3. taraf (Anthropic) müvekkil verisine erişir
3. Cross-tenant erişim olursa: Bir avukat başka avukatın müvekkil verisini görür

### Olasılık: YÜKSEK (avukatlar mutlaka kişisel veri girecek)
### Etki: KRİTİK (yasal sorumluluk, ürün ölümü)

### Erken Uyarı Sinyalleri
- Kullanıcılar sorgu/dilekçede TC kimlik numarası, sağlık bilgisi giriyor
- KVKK denetim haberleri (sektörde genel denetim başlarsa)
- Veri ihlali haberleri (rakipte veya sektörde) → farkındalık artışı
- Baro'dan gelen KVKK uyumluluk soruları

### Kurtarma Planı

**Teknik Önlemler (gün 1'den itibaren):**

```
1. PII DETECTION & REDACTION
   ├── Her LLM'e gönderilen metinde PII tarama
   │   (TC kimlik, telefon, adres, IBAN regex + NER modeli)
   ├── PII tespit edildiğinde:
   │   Option A: Otomatik maskeleme ([TC_KIMLIK] placeholder)
   │   Option B: Kullanıcıya uyarı "Kişisel veri tespit edildi,
   │             göndermek istediğinize emin misiniz?"
   └── LLM response'unda maskelenen veriler geri yerleştirilir
       (lokal işlem, LLM görmez)

2. VERİ MİNİMİZASYONU
   ├── LLM'e sadece gerekli context gönder (tam dosya değil)
   ├── Kişisel veriler local'de kalır, LLM'e gitmez
   └── Embedding oluşturma: Kişisel veriler strip edildikten sonra

3. ŞİFRELEME
   ├── At rest: AES-256 (tüm veritabanları)
   ├── In transit: TLS 1.3 (tüm API çağrıları)
   ├── Per-tenant encryption key (tenant izolasyonu)
   └── Backup encryption

4. ERİŞİM KONTROLÜ
   ├── Row-level security (PostgreSQL RLS)
   ├── Qdrant payload filter (tenant_id zorunlu)
   ├── API gateway'de tenant doğrulama
   └── Audit log: Kim, ne zaman, hangi veriye erişti

5. VERİ SAKLAMA POLİTİKASI
   ├── LLM çağrı logları: 90 gün (sonra sil)
   ├── Kullanıcı belgeleri: Kullanıcı silene kadar
   ├── Silinen hesap: 30 gün içinde tüm veri kalıcı silinir
   └── Veri taşınabilirlik: JSON export butonu (KVKK md. 20)
```

**Hukuki Önlemler:**
```
1. KVKK VERBİS Kaydı (gün 1)
   ├── Veri sorumlusu olarak kayıt
   ├── İşlenen veri kategorileri
   ├── Veri saklama süreleri
   └── Yurt dışı aktarım (LLM API) bildirimi

2. Kullanıcı Sözleşmesi
   ├── Açık rıza metni (KVKK md. 5/1)
   ├── Veri işleme amaçları (açık ve sınırlı)
   ├── LLM'e veri gönderildiğinin açık bildirimi
   ├── Veri silme ve taşınabilirlik hakları
   └── Sorumluluk sınırı

3. Anthropic DPA (Data Processing Agreement)
   ├── Anthropic ile veri işleme sözleşmesi
   ├── EU Standard Contractual Clauses
   ├── Veri saklama/silme garantileri
   └── Alt-işleyici bildirimi

4. Avukatlık Kanunu Uyumu
   ├── Avukat-müvekkil gizliliği (1136 s.K. md. 36)
   ├── Mesleki sır saklama yükümlülüğü
   ├── Baro etik kurallarına uyumluluk
   └── Disiplin soruşturması riski değerlendirmesi
```

**Kriz anında (veri sızıntısı):**
```
Saat 0-4:
├── Sızıntının kapsamını belirle
├── Etkilenen kullanıcıları tespit et
├── Güvenlik açığını kapat
└── Hukuki danışmana bildir

Saat 4-24:
├── KVKK'ya bildirim (72 saat kuralı)
├── Etkilenen avukatlara bildirim
├── Basın açıklaması (gerekirse)
└── Bağımsız güvenlik auditi başlat

Gün 1-30:
├── Kapsamlı güvenlik auditi
├── Etkilenen kullanıcılara: Ücretsiz abonelik uzatma + destek
├── KVKK soruşturmasına hazırlık
└── Teknik düzeltmelerin tamamlanması + penetrasyon testi
```

---

## Risk Özet Matrisi

```
                        ETKİ
                 Düşük  Orta   Yüksek  Kritik
           ┌────────┬───────┬────────┬────────┐
  Yüksek   │        │       │ Risk 3 │ Risk 5 │
           │        │       │ Rakip  │ KVKK   │
Olasılık   ├────────┼───────┼────────┼────────┤
  Orta     │        │       │ Risk 2 │ Risk 1 │
           │        │       │ Risk 4 │ Halüs. │
           ├────────┼───────┼────────┼────────┤
  Düşük    │        │       │        │        │
           │        │       │        │        │
           └────────┴───────┴────────┴────────┘
```

### Öncelik Sırası (Hangi riskle ilk başa çıkılmalı)

1. **Risk 1 (Hallüsinasyon):** Gün 1'den itibaren citation verification pipeline → ürünün omurgası
2. **Risk 5 (KVKK):** Gün 1'den itibaren VERBİS + PII detection → yasal zorunluluk
3. **Risk 2 (Veri kaynağı):** Ay 1'den itibaren çoklu kaynak + cache → dayanıklılık
4. **Risk 3 (Rakip):** Ay 3'ten itibaren workflow derinliği + kişiselleştirme → savunulabilir hendek
5. **Risk 4 (Büyüme):** Ay 4'ten itibaren metrikleri takip → pivot kararı zamanında ver
