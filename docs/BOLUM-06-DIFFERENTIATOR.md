# BÖLÜM 6: DIFFERENTIATOR — KİMSENİN YAPMADIĞI 5 ÖZELLİK

> **Temel İlke:** Bu özellikler avukatın "sadece bu yüzden bile öderdim" diyeceği, rakipte olmayan, savunulabilir rekabet avantajı yaratan özelliklerdir.

---

## Özellik 1: Hakim/Mahkeme Profili Analizi

### Ne yapıyor (1 cümle)
Belirli bir mahkemenin (ve mümkünse hakimin) karar verme eğilimlerini, kabul/red oranlarını ve sık başvurduğu içtihatları istatistiksel olarak analiz eder.

### Neden kimse yapmamış
- **Veri engeli:** Mahkeme bazlı karar veritabanı oluşturmak masif veri işleme gerektirir. Kazancı/Lexpera karar metni satar, karar bazlı istatistik üretmez.
- **Teknik engel:** Kararların hangi mahkemeden geldiğini strukturize etmek NER + parsing gerektirir; mevcut veritabanları bu metadata'yı zengin şekilde sunmaz.
- **Hassasiyet:** Hakim bazlı profilleme etik açıdan tartışmalı, barolar itiraz edebilir.

### Nasıl yapılır

```
Veri Toplama:
├── yargi-mcp → Yargıtay/Danıştay kararlarından bozulan mahkeme bilgisi
├── BAM kararları → Hangi ilk derece mahkemesi kararı istinafta ne oldu
├── Kamuya açık kararlar → Mahkeme bazlı sınıflandırma
│
Veri İşleme:
├── NER modeli → Mahkeme adı, şehir, daire no extraction
├── Karar sonucu sınıflandırma → kabul/kısmi kabul/red/feragat
├── Süre analizi → Dava açılış - karar arası ortalama süre
├── Tazminat analizi → Konu bazlı ortalama tazminat miktarları
│
İstatistik Motoru:
├── Mahkeme bazlı: kabul oranı, ortalama süre, bozma oranı
├── Konu bazlı: iş davalarında kabul oranı vs ticaret davalarında
├── Zaman bazlı: Son 2 yıldaki trend değişimi
└── Güven aralığı: Karar sayısı az ise geniş güven aralığı
```

### Kullanıcı Görünümü

```
┌──────────────────────────────────────────────┐
│ 📊 Mahkeme Profili: İstanbul 3. İş Mahkemesi │
│                                                │
│ Toplam incelenen karar: 847 (2023-2026)       │
│                                                │
│ İşe İade Davaları:                             │
│ • Kabul oranı: %68 (ulusal ort: %62)          │
│ • Ortalama karar süresi: 8.5 ay               │
│ • En sık referans: Yargıtay 9.HD 2022/XXX    │
│                                                │
│ ⚠ NOT: Bu istatistikler geçmiş kararlara      │
│ dayanır, gelecek kararları garanti etmez.      │
│ Avukatın bağımsız değerlendirmesi esastır.     │
│                                                │
│ ℹ Hakim bazlı profilleme yapılmaz —           │
│ sadece mahkeme düzeyinde istatistik sunulur.   │
└──────────────────────────────────────────────┘
```

### Geliştirme süresi: 8-10 hafta
- 4 hafta: Veri pipeline (toplama, NER, sınıflandırma)
- 2 hafta: İstatistik motoru
- 2 hafta: UI ve raporlama

### Pazarlama
"Davanızın hangi mahkemede görüleceğini biliyorsunuz. Peki o mahkemenin sizin dava türünüzdeki eğilimini biliyor musunuz?"

### Etik Sınır
- Hakim adı bazlı profilleme **yapılmaz** — sadece mahkeme düzeyinde
- İstatistikler "tahmin" olarak sunulur, "garanti" olarak asla
- Her çıktının altında "Bu istatistiksel veri olup, mahkeme kararını yönlendirmez" notu

---

## Özellik 2: Karşı Vekil Argüman Analizi

### Ne yapıyor (1 cümle)
Karşı tarafın avukatının kamuya açık kararlarda daha önce kullandığı argüman pattern'lerini analiz ederek, muhtemel savunma/saldırı stratejisini tahmin eder.

### Neden kimse yapmamış
- **Veri birleştirme zorluğu:** Avukat adı → karar eşleştirmesi zor; kamuya açık kararlarda avukat adı her zaman yer almaz.
- **Gizlilik endişesi:** Avukat profillemesi baro kuralları açısından hassas.
- **Teknik zorluk:** Argüman extraction + sınıflandırma custom NLP modeli gerektirir.

### Nasıl yapılır

```
1. Veri Kaynağı:
   - Kamuya açık mahkeme kararlarında vekil adları (varsa)
   - Avukatın baro sicil numarasından kamuya açık bilgiler
   - Kullanıcının girdiği karşı taraf dilekçeleri (dosyaya yüklenen)

2. Argüman Extraction Pipeline:
   Karar/Dilekçe metni → LLM → Argüman listesi
   Her argüman: {tip, dayanak, güçlülük_skoru}

3. Pattern Recognition:
   Aynı avukatın 10+ davadaki argümanlarından:
   - Sık kullandığı argüman tipleri
   - Tercih ettiği içtihatlar
   - Argüman sıralaması tercihi
   - Zayıf noktaları (hangi argümanları sürekli kaybediyor)

4. Tahmin Motoru:
   Input: Karşı avukat + dava konusu
   Output: "Bu avukat muhtemelen şu argümanları kullanacak: [...]"
```

### Geliştirme süresi: 6-8 hafta
- 3 hafta: Argüman extraction modeli
- 2 hafta: Pattern recognition
- 2 hafta: UI ve tahmin motoru

### Pazarlama
"Karşı tarafın avukatı duruşmada ne söyleyecek? Biz daha önce ne söylediğini biliyoruz."

### Etik Sınır
- Kamuya açık veriler kullanılır, gizli bilgi asla
- Avukat "profili" değil, "argüman analizi" olarak konumlandırılır
- Baro kurallarına uyumluluk teyidi gerekir

---

## Özellik 3: Dava Outcome Tahmini (Predictive Analytics)

### Ne yapıyor (1 cümle)
Benzer 100+ davadaki sonuç dağılımını analiz ederek, mevcut davanın muhtemel sonucunu istatistiksel olarak tahmin eder ve güven aralığı sunar.

### Neden kimse yapmamış
- **Model eğitimi:** Türk hukuk kararları üzerinde eğitilmiş tahmin modeli yok; İngilizce hukuk modellerinden doğrudan transfer edilemez.
- **Veri kalitesi:** Kararların sonucunu (kabul/red/kısmi kabul + miktar) strukturize etmek büyük etiketleme çalışması gerektirir.
- **Sorumluluk korkusu:** "Kazanma olasılığı %70" dedikten sonra dava kaybedilirse güven sarsılır.

### Nasıl yapılır

```
1. Eğitim Verisi Oluşturma:
   10,000+ karar için:
   {
     "dava_turu": "ise_iade",
     "olgular": ["savunma_alinmamis", "5_yil_kidem", "30_ustu_isyeri"],
     "sonuc": "kabul",
     "tazminat_miktari": null,
     "mahkeme": "istanbul_3_is",
     "yil": 2025
   }

2. Model Mimarisi:
   - Feature engineering: Olgulardan binary feature vector
   - Model: XGBoost (tahmin) + SHAP (açıklanabilirlik)
   - LLM integration: Olgu çıkarma ve benzerlik hesaplama

3. Tahmin Akışı:
   Yeni dava olguları → Feature extraction → Model → Tahmin + güven aralığı

4. Açıklanabilirlik:
   "Bu tahmin şu faktörlere dayanmaktadır:
    +%15 savunma alınmamış olması
    +%12 5 yılı aşkın kıdem
    -% 8 işverenin performans belgesi sunması
    Benzer 127 davadan %68'i kabul ile sonuçlanmış"
```

### Kullanıcı Görünümü

```
┌──────────────────────────────────────────────┐
│ 📈 DAVA OUTCOME TAHMİNİ                      │
│                                                │
│ Dava: İşe iade                                 │
│ Benzer dava sayısı: 127                        │
│                                                │
│ Tahmini sonuç dağılımı:                        │
│ Kabul:      ████████████░░░░ 68%               │
│ Red:        ████░░░░░░░░░░░░ 22%               │
│ Sulh/Ferag: ██░░░░░░░░░░░░░░ 10%              │
│                                                │
│ Güven aralığı: %55 - %78 (95% CI)             │
│                                                │
│ En etkili faktörler:                           │
│ ✓ Savunma alınmamış (+15%)                    │
│ ✓ 5+ yıl kıdem (+12%)                        │
│ ✗ İşverenin performans belgesi (-8%)          │
│                                                │
│ ⚠ ÖNEMLİ UYARI: Bu istatistiksel bir tahmin  │
│ olup, mahkeme kararını garanti etmez.          │
│ Her dava kendine özgü koşullar içerir.         │
│ Nihai değerlendirme avukata aittir.            │
└──────────────────────────────────────────────┘
```

### Geliştirme süresi: 12-16 hafta
- 6 hafta: Veri etiketleme ve feature engineering
- 4 hafta: Model eğitimi ve validasyon
- 2 hafta: Açıklanabilirlik katmanı
- 2 hafta: UI ve entegrasyon

### Pazarlama
"Bu davayı almalı mısınız? 127 benzer davada ne olduğunu bilmeden karar vermek zorunda değilsiniz."

---

## Özellik 4: Strateji Simülatörü — "Ya Şunu Yaparsam?"

### Ne yapıyor (1 cümle)
Avukatın "Şu argümanı kullanırsam ne olur?", "İstinafa gidersem sonuç değişir mi?", "Arabuluculukta şu teklifi yaparsam?" sorularına senaryo bazlı analiz sunar.

### Neden kimse yapmamış
- **Karmaşık reasoning:** Hukuki senaryoları modellemek basit RAG ile yapılamaz, multi-step reasoning gerektirir.
- **Veri yetersizliği:** Senaryoların sonuçlarını eğitmek için tagged veri seti yok.
- **Güvenilirlik endişesi:** Yanlış simülasyon sonucu avukatı yanlış yönlendirebilir.

### Nasıl yapılır

```
1. Senaryo Motoru:
   LLM (Claude) + İçtihat veritabanı + İstatistik verisi

2. Akış:
   Avukat: "Haksız fesih yerine geçerli fesih iddiası ile gitsek?"
   │
   ├── Mevcut strateji analizi → Sonuç tahmini A
   ├── Alternatif strateji analizi → Sonuç tahmini B
   └── Karşılaştırmalı rapor

3. Simülasyon Çıktısı:
   ┌────────────────┬──────────────┬──────────────┐
   │                │ Mevcut       │ Alternatif   │
   │                │ Strateji     │ Strateji     │
   ├────────────────┼──────────────┼──────────────┤
   │ Kabul oranı    │ %68          │ %45          │
   │ Güçlü argüman  │ 3            │ 2            │
   │ Risk           │ Orta         │ Yüksek       │
   │ Süre etkisi    │ -            │ +2 ay        │
   │ Emsal desteği  │ Güçlü        │ Zayıf        │
   ├────────────────┼──────────────┼──────────────┤
   │ ÖNERİ          │ ✓ Mevcut strateji daha güçlü│
   └────────────────┴──────────────┴──────────────┘

4. Her senaryoda:
   - İlgili emsal kararlar gösterilir
   - Risk faktörleri listelenir
   - "Bu analiz istatistiksel veriye dayanır" notu eklenir
```

### Geliştirme süresi: 10-14 hafta
- 4 hafta: Senaryo modelleme altyapısı
- 3 hafta: LLM prompt engineering ve chain-of-thought
- 3 hafta: Karşılaştırmalı rapor engine
- 2 hafta: UI

### Pazarlama
"Strateji değiştirmeden önce sonucunu görün. Avukatın zaman makinesi."

---

## Özellik 5: Otomatik İçtihat Takip ve Güncelleme (Watchdog)

### Ne yapıyor (1 cümle)
Avukat bir kararı kaydetttiğinde veya dilekçede kullandığında, o kararın ilerleyen dönemdeki bozma/onama/değişiklik durumunu otomatik takip eder ve avukatı bilgilendirir.

### Neden kimse yapmamış
- **Sürekli monitoring altyapısı:** Tek seferlik arama değil, sürekli izleme gerektirir — altyapı maliyeti yüksek.
- **Bozma zinciri tespiti:** Kararın "bozulduğunu" tespit etmek dosya numarası üzerinden zincir takibi gerektirir, basit bir arama değildir.
- **Mevzuat değişikliği etkisi:** Kararın dayandığı kanun maddesi değişirse kararın hâlâ geçerli olup olmadığını değerlendirmek LLM reasoning gerektirir.

### Nasıl yapılır

```
1. Watchlist Oluşturma:
   Avukat karar kaydediyor veya dilekçede kullanıyor
   → FreshnessCheckerAgent watchlist'e ekler

2. Periyodik Kontrol (haftalık cron):
   Her watchlist kararı için:
   ├── yargi-mcp'de aynı dosya no ile yeni karar var mı?
   ├── İlgili İBK yayımlandı mı?
   ├── Dayandığı kanun maddesi değişti mi? (Resmi Gazete)
   └── Aynı konuda yeni içtihat eğilimi oluştu mu?

3. Bildirim Akışı:
   Değişiklik tespit edildiğinde:
   ├── Push notification: "Kaydettiğiniz karar ile ilgili güncelleme var"
   ├── E-mail özet: Haftalık watchlist raporu
   └── Dashboard: İlgili dava dosyasında uyarı işareti

4. Etki Analizi:
   Karar bozulmuşsa:
   "Bu kararı şu davalarınızda kullanmıştınız: [liste]
    Alternatif güncel emsal: [öneriler]
    Etkilenen dilekçeler: [liste]"
```

### Kullanıcı Görünümü

```
┌──────────────────────────────────────────────┐
│ 🔔 İÇTİHAT GÜNCELLEMESİ                     │
│                                                │
│ Kaydettiğiniz karar:                           │
│ Yargıtay 9. HD 2023/1234 E., 2023/5678 K.    │
│                                                │
│ ⚠ GELİŞME: Bu karar HGK tarafından           │
│ 2026/456 E. sayılı kararla BOZULMUŞTUR.       │
│                                                │
│ Bozma gerekçesi: "...iş güvencesi             │
│ kapsamında savunma hakkının..."                │
│                                                │
│ Bu kararı kullandığınız yerler:                │
│ • Yılmaz vs. XYZ — İşe iade dilekçesi (s.4)  │
│ • Kaya vs. ABC — Duruşma hazırlık notu        │
│                                                │
│ Güncel emsal önerisi:                          │
│ • Yargıtay HGK 2026/456 E., 2026/789 K. [✓] │
│                                                │
│ [Güncel emsali incele] [Dilekçeyi güncelle]   │
│ [Bu uyarıyı kapat]                             │
└──────────────────────────────────────────────┘
```

### Geliştirme süresi: 6-8 hafta
- 2 hafta: Watchlist altyapısı ve cron job sistemi
- 2 hafta: Bozma zinciri tespit algoritması
- 1 hafta: Mevzuat değişikliği etki analizi
- 1 hafta: Bildirim sistemi
- 1 hafta: UI

### Pazarlama
"Kullandığınız içtihat bozuldu mu? Siz öğrenmeden önce biz size söyleriz."

---

## Ek Özellik: Canlı Mevzuat Değişiklik Takibi

### Ne yapıyor
Avukatın ilgilendiği hukuk alanlarında Resmi Gazete'de yayımlanan kanun/KHK/yönetmelik değişikliklerini otomatik tespit eder ve "Bu değişiklik şu aktif davanızı etkileyebilir" uyarısı verir.

### Neden değerli
- Avukatlar Resmi Gazete'yi her gün takip edemez
- Değişikliğin aktif davalara etkisini manuel tespit etmek zaman alır
- Mevcut rakiplerde mevzuat takibi var ama "davanıza etkisi" analizi yok

### Geliştirme süresi: 4 hafta

---

## Özellik Öncelik Sıralaması

| Sıra | Özellik | Etki | Süre | Zorluk | Öncelik Notu |
|------|---------|------|------|--------|-------------|
| 1 | İçtihat Watchdog | Yüksek | 6-8 hafta | Orta | MVP sonrası ilk eklenmeli |
| 2 | Dava Outcome Tahmini | Çok Yüksek | 12-16 hafta | Yüksek | Demo'da "wow" etkisi en yüksek |
| 3 | Mahkeme Profili | Yüksek | 8-10 hafta | Orta | Veri pipeline outcome ile ortak |
| 4 | Karşı Vekil Analizi | Orta-Yüksek | 6-8 hafta | Orta | Etik onay gerektirir |
| 5 | Strateji Simülatörü | Çok Yüksek | 10-14 hafta | Yüksek | Outcome tahmini üzerine inşa edilir |
