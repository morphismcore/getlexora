# BÖLÜM 8: SATIŞ — AVUKATA NASIL SATILIR

> **Temel İlke:** Avukatlar güven ile karar verir, ROI hesabı ile değil. İlk satış "ürün" satışı değil, "güven" satışıdır.

---

## 8.1 Avukatın Karar Verme Süreci

### Avukat Psikolojisi

```
Avukat yazılım satın alırken:
├── ROI hesabı yapmaz (çoğu avukat gelir-gider takibi bile yapmaz)
├── Meslektaş referansı arar ("X kullanıyor, memnun mu?")
├── Güvenilirlik ister ("Yanlış içtihat verirse ne olur?")
├── Kontrol kaybından korkar ("İşimi yapay zeka mı yapacak?")
├── Teknik detaylarla ilgilenmez ("LLM", "RAG" demeyin)
├── Denemeden almaz ("Önce göster, sonra konuşuruz")
└── Zaman baskısı altındadır ("Öğrenmeye vaktim yok")
```

### Satış Hunisi (Avukata Özel)

```
1. FARKINDALIK (Ay 1-3)
   └── "Böyle bir şey var" → Baro etkinlikleri, LinkedIn, avukat grupları

2. İLGİ (İlk temas)
   └── "Nasıl çalışıyor?" → 15 dakikalık canlı demo

3. DENEME (7 günlük trial)
   └── "Gerçekten işe yarıyor mu?" → Kendi davalarıyla test

4. GÜVEN (1-2 hafta kullanım)
   └── "Yanlış bir şey söylemiyor mu?" → Citation doğrulama demosu

5. SATIN ALMA (Ay 1 sonunda)
   └── "Bu olmadan çalışamam" → Aylık abonelik

6. SAVUNUCULUK (Ay 3+)
   └── "Bunu kullanmalısın" → Meslektaşlarına önerir
```

---

## 8.2 Demo Stratejisi

### "Wow" Etkisi Yaratan Özellikler (Demo'da Göster)

| Sıra | Özellik | Demo Süresi | Wow Faktörü |
|------|---------|-------------|-------------|
| 1 | Canlı içtihat arama (doğal dil) | 2 dk | ★★★★★ |
| 2 | Citation doğrulama (gerçek zamanlı ✓/✗) | 1 dk | ★★★★★ |
| 3 | Dilekçe taslağı üretimi | 3 dk | ★★★★☆ |
| 4 | Süre hesaplama ve uyarı | 1 dk | ★★★★☆ |
| 5 | Dava outcome tahmini | 2 dk | ★★★★★ |

### "Sıkıcı" Gelen Özellikler (Demo'da Gösterme, Arka Planda Çalışsın)

- Audit trail
- Multi-tenancy
- KVKK uyumluluk
- Cache mekanizması
- Teknik altyapı detayları

### Gerçek Dava ile Canlı Demo

**Format:** "Bana bir davanızı anlatın, birlikte bakalım"

```
Demo Akışı (15 dakika):
━━━━━━━━━━━━━━━━━━━━━━

Dakika 0-2: "Bir davanızdan kısaca bahseder misiniz?"
→ Avukat gerçek bir davasını anlatır

Dakika 2-5: "Şimdi bu konuda içtihat arayalım"
→ Doğal dil ile arama → Sonuçlar gelir
→ Referans doğrulama gösterilir (gerçek zamanlı ✓)
→ "Bakın, bu karar gerçekten var ve güncel"

Dakika 5-8: "Bir de dilekçe taslağı üretelim"
→ Anlattığı olaylardan dilekçe taslağı üretilir
→ İçtihatlar otomatik yerleştirilir
→ Avukat: "Hmm, bunu genelde böyle yazmıyorum" →
   "Stilinizi öğreniriz, ilk birkaç dilekçenizden sonra
    sizin gibi yazar"

Dakika 8-10: "Peki bu davada süre durumu ne?"
→ Süre hesaplaması gösterilir
→ "3 gün sonra istinaf süreniz doluyor" gibi gerçek uyarı

Dakika 10-12: "Benzer davalarda mahkemeler ne karar vermiş?"
→ Outcome tahmini gösterilir
→ "Bu mahkemede benzer 85 davada %68 kabul"

Dakika 12-15: Sorular ve kapanış
→ "7 gün ücretsiz deneyin, kendi davalarınızla test edin"
```

### Demo Yapılacak Ortam

- **Baro toplantı salonu:** 10-20 avukat birden, canlı demo, sorular
- **1:1 online demo:** Zoom/Teams, avukatın kendi ekranını paylaşması
- **Konferans standı:** Hukuk konferanslarında stand + demo

---

## 8.3 Baro Kanalı Stratejisi

### Türkiye'de 80 Baro — Başlangıç Stratejisi

**Tier 1 (İlk 3 ay): Büyük barolar**
| Baro | Üye Sayısı (tahmini) | Neden | Yaklaşım |
|------|---------------------|-------|----------|
| İstanbul | ~55,000 | En büyük pazar, erken benimseyen avukatlar fazla | Genç avukat komisyonu ile başla |
| Ankara | ~22,000 | Kamu hukuku, idare hukuku ağırlıklı | İdare hukuku demo'su ile |
| İzmir | ~10,000 | Aktif baro yönetimi | Baro başkanı ile görüşme |

**Tier 2 (Ay 4-6): Aktif barolar**
- Antalya, Bursa, Konya, Gaziantep — bölgesel liderler
- Her baro için o şehrin dominant hukuk alanına özel demo

### Baro İle İşbirliği Modelleri

```
Model 1: Eğitim Sponsorluğu
├── Baro eğitim programlarında "AI ve Hukuk" semineri ver (ücretsiz)
├── Seminerde ürün demosu yap (soft sell)
├── Baro dergisinde sponsor makale
└── Maliyet: ~5,000-10,000 TL/baro + zaman

Model 2: Baro Üyelik İndirimi
├── Baro üyelerine %20-30 indirim
├── Baro web sitesinde "iş ortağı" olarak yer al
├── Baro e-posta listesine erişim
└── Baro'ya: referans komisyonu veya ücretsiz kurumsal lisans

Model 3: Stajyer Programı
├── Stajyer avukatlara 6 ay ücretsiz erişim
├── Avukat yanında staja başladığında, avukata da tanıtım
├── "Stajyerim kullanıyor, ben de bakmak istiyorum" etkisi
└── Uzun vadeli yatırım: Bugünün stajyeri, yarının müşterisi
```

---

## 8.4 Fiyatlandırma

### Türkiye'de Avukat Gelir Dağılımı (2026 tahmini)

```
Alt %30:   Aylık 15,000-30,000 TL (küçük şehir, yeni avukat)
Orta %40:  Aylık 30,000-80,000 TL (şehir merkezi, 5-15 yıl tecrübe)
Üst %20:  Aylık 80,000-200,000 TL (büyük şehir, uzmanlaşmış)
Top %10:   Aylık 200,000+ TL (büyük firma, kurumsal)
```

### Fiyatlandırma Modeli

```
┌─────────────────────────────────────────────────────────┐
│ PLAN: BAŞLANGIÇ                    PLAN: PROFESYONEL    │
│ ₺999/ay                           ₺2,499/ay            │
│                                                          │
│ ✓ İçtihat arama (50/gün)         ✓ Sınırsız arama      │
│ ✓ Mevzuat arama                   ✓ Dilekçe üretimi     │
│ ✓ Süre takibi (5 dava)           ✓ Süre takibi (sınırsız)│
│ ✓ Temel özet rapor                ✓ Strateji analizi     │
│ ✗ Dilekçe üretimi                 ✓ Outcome tahmini     │
│ ✗ Strateji analizi                ✓ Mahkeme profili      │
│ ✗ UYAP entegrasyonu               ✓ UYAP extension      │
│                                    ✓ Öncelikli destek    │
│                                                          │
│ PLAN: BÜRO (3+ avukat)            PLAN: ENTERPRISE      │
│ ₺1,999/avukat/ay                  İletişime geçin       │
│                                                          │
│ ✓ Profesyonel tüm özellikler     ✓ Tüm özellikler      │
│ ✓ Büro dashboard                  ✓ Özel entegrasyon     │
│ ✓ Dava atama ve paylaşma         ✓ Dedicated support    │
│ ✓ Büro istatistikleri             ✓ SLA garantisi        │
│ ✓ Stajyer hesapları (ücretsiz)   ✓ On-premise seçeneği  │
└─────────────────────────────────────────────────────────┘
```

### Fiyatlandırma Mantığı

- **₺999/ay:** Avukatın "bir aylık aboneliği bir saatlik vekalet ücreti ile ödenmeli" kuralı. Tek bir davada kazanılan zaman bunu karşılar.
- **Yıllık ödeme:** %20 indirim (₺799/ay) → churn azaltır
- **Dava bazlı fiyatlandırma YOK:** Avukat "her dava için ödeme" modelini sevmez, belirsizlik yaratır
- **İlk 7 gün ücretsiz trial**, kredi kartı gerekmez

---

## 8.5 İlk 10 Avukat Seçimi (Founder Users)

### Profil Kriterleri

```
İdeal İlk Kullanıcı:
├── 5-15 yıl deneyim (ne çok genç ne çok yaşlı)
├── Teknolojiye açık (zaten Kazancı/Lexpera kullanıyor)
├── Aktif sosyal medya (LinkedIn, Twitter/X — mesaj yayar)
├── Baro komisyonlarında aktif (topluluk etkisi)
├── Haftada 5+ dava ile ilgileniyor (aktif kullanıcı olur)
├── İş, ticaret veya ceza alanında (ilk 3 desteklenen alan)
└── Geri bildirim vermeye istekli (haftalık 30 dk görüşme)
```

### Bulma Kanalları

1. **LinkedIn:** "Avukat" + "hukuk teknolojisi" + "dijital dönüşüm" arayanlar
2. **Baro genç avukat komisyonu üyeleri**
3. **Hukuk teknolojisi konferanslarına katılanlar** (Legal Tech İstanbul)
4. **Twitter/X:** Hukuk ve teknoloji hakkında paylaşım yapan avukatlar
5. **Kişisel ağ:** Kurucu ekibin tanıdığı avukatlar

### Onlara Teklif

```
"Size özel bir program:
• 6 ay boyunca ücretsiz erişim (Profesyonel plan)
• Haftada 1 kez 30 dk feedback görüşmesi
• Ürün yol haritasında söz hakkı
• İlk 10 kullanıcı olarak ömür boyu %50 indirim
• 'Kurucu Üye' rozeti (social proof)

Karşılık:
• Haftada 30 dk feedback
• Dürüst geri bildirim (kötü olanı da)
• Memnunsan 2-3 meslektaşına önerme"
```

---

## 8.6 Onboarding — İlk 7 Gün

### Gün 1: İlk Karşılama

```
"Hoş geldiniz Av. Mehmet!

İlk adım olarak sizi tanımak istiyoruz:

1. Hangi hukuk alanlarında çalışıyorsunuz?
   □ İş hukuku  □ Ceza  □ Ticaret  □ Aile  □ İdare  □ Diğer

2. Kaç aktif davanız var?
   □ 1-5  □ 5-15  □ 15-30  □ 30+

3. Şu an hangi araçları kullanıyorsunuz?
   □ Kazancı  □ Lexpera  □ Hiçbiri  □ Diğer

Hadi ilk aramanızı yapalım!
[Arama kutusuna bir soru yazın →]"
```

### Gün 2-3: İlk Değer Anı

```
Hedef: Avukatın "İşte bu!" dediği anı 3 gün içinde yaşatmak

Aksiyon:
• İlk arama sonucunda "Bu karar gerçekten var [✓]" gösterimi
• İlk dilekçe taslağı → "Vay, bunu 1 saatte yapmak yerine 5 dakikada yaptım"
• İlk süre uyarısı → "Ben unutmuştum, iyi ki uyardı"
```

### Gün 4-5: Derinleştirme

```
• Aktif dava dosyalarını sisteme ekleme
• UYAP'tan birkaç belge yükleme
• İlk strateji analizi
• "Daha önce yazdığınız bir dilekçeyi yükleyin, stilinizi öğrenelim"
```

### Gün 6-7: Alışkanlık Oluşturma

```
• Sabah briefingi aktif
• Süre takibi tüm davalar için aktif
• Trial bitiyor → "Devam etmek ister misiniz?"
• Eğer aktif kullanım varsa → %90+ dönüşüm beklentisi
```

---

## 8.7 Churn Önleme

### Avukat Neden Ayrılır?

| Neden | Oran (tahmin) | Erken Uyarı | Önlem |
|-------|--------------|-------------|-------|
| Hallüsinasyon yaşadı | %30 | Citation verification failure report | Hallücinasyon → anında özür + düzeltme + kök neden analizi |
| "Kendi yapıyorum daha iyi" | %25 | Kullanım sıklığı düşüyor | Kişiselleştirme artır, stil öğren |
| Fiyat | %20 | Düşük kullanım + ödeme gününde iptal | Daha ucuz plan öner, ROI hesabı göster |
| Rakip geçiş | %10 | Rakip lansmanı sonrası düşüş | Feature parity + sadakat indirimi |
| Teknik sorun | %10 | Hata raporları, yavaşlık şikayetleri | 24 saat SLA, proaktif bilgilendirme |
| İhtiyaç kalmadı | %5 | Dava sayısı azaldı | Farklı ihtiyaçları (eğitim, compliance) sun |

### Churn Sinyalleri ve Otomatik Müdahale

```python
churn_signals = {
    "kullanim_azalmasi": {
        "kriter": "Son 7 günde 0 arama",
        "aksiyon": "Kişiselleştirilmiş e-mail: 'Yeni Yargıtay kararları alanınızda yayımlandı'"
    },
    "negatif_feedback": {
        "kriter": "Citation verification failure + kullanıcı şikayeti",
        "aksiyon": "Customer success ekibinden 1:1 arama, sorun çözümü"
    },
    "odeme_gunu_yaklasim": {
        "kriter": "Düşük kullanım + ödeme 3 gün sonra",
        "aksiyon": "Kullanım raporu: 'Bu ay X saat tasarruf ettiniz'"
    }
}
```

---

## 8.8 Referans Mekanizması

### Ağızdan Ağıza Yayılma Stratejisi

```
Tier 1: Memnun avukat → Meslektaşına söylüyor (organik)
├── Kolaylaştırıcı: "Bir meslektaşınızı davet edin,
│   ikinize de 1 ay ücretsiz" butonu
└── Ölçüm: Referral code tracking

Tier 2: Baro etkinliklerinde kullanıcı testimonial'ı
├── "Av. Ayşe Kara anlatıyor: Lexora ile işe iade
│   davamda 3 saat yerine 20 dakikada araştırma yaptım"
└── Video testimonial → LinkedIn + baro web sitesi

Tier 3: Case study yayını
├── "X hukuk bürosu Lexora ile ayda 40 saat tasarruf ediyor"
├── Avukatın izniyle anonim veya isimli
└── Baro dergisinde, LinkedIn'de, hukuk bloglarında

Tier 4: Avukat influencer programı
├── Aktif kullanan 5-10 avukatı "ambassador" yap
├── Ücretli değil, ürüne early access + feature request önceliği
└── Onların paylaşımları çok daha güvenilir gelir
```
