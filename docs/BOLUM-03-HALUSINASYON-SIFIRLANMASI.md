# BÖLÜM 3: HALÜSİNASYON SIFIRLANMASI — TEKNİK MİMARİ

> **Temel İlke:** Hukukta yanlış içtihat referansı = mesleki sorumluluk riski = avukatın güvenini kaybetme = ürün ölümü. Bu bölüm, ürünün yaşamsal organıdır.

---

## 3.1 Citation Verification Pipeline

### Mimari

```
LLM Çıktısı
    │
    ▼
┌──────────────────────┐
│  Reference Extractor │  (Regex + NER modeli)
│  ────────────────────│
│  Yargıtay 9. HD      │
│  2023/1234 E.         │
│  2023/5678 K.         │
│  TCK md. 157/1        │
│  TBK md. 49           │
└──────────┬───────────┘
           │
    ┌──────┴──────┐
    ▼             ▼
┌────────┐  ┌────────────┐
│İçtihat │  │ Mevzuat    │
│Verify  │  │ Verify     │
└───┬────┘  └─────┬──────┘
    │             │
    ▼             ▼
┌────────────────────────┐
│    Verification Cache   │ (Redis, TTL: 24h)
└────────────┬───────────┘
             │
             ▼
┌────────────────────────┐
│  Verification Report    │
│  ├── verified: ✓        │
│  ├── not_found: ✗       │
│  ├── partial_match: ~   │
│  └── outdated: ⚠        │
└────────────────────────┘
```

### Reference Extractor — Türk Hukuk Referans Regex Kalıpları

```python
PATTERNS = {
    "yargitay": r"Yargıtay\s+(\d+)\.\s*(HD|CD|HGK|CGK|İBK)\s+(\d{4})/(\d+)\s*E\.\s*,?\s*(\d{4})/(\d+)\s*K\.",
    "danistay": r"Danıştay\s+(\d+)\.\s*(D|İDDK|VDDK)\s+(\d{4})/(\d+)\s*E\.\s*,?\s*(\d{4})/(\d+)\s*K\.",
    "aym": r"AYM\s+([\d/]+)\s*(?:B\.?N\.?|Başvuru\s+No)\s*:\s*([\d/]+)",
    "aym_bireysel": r"AYM\s+Bireysel\s+Başvuru\s+No:\s*(\d{4}/\d+)",
    "kanun_madde": r"(\d+)\s*sayılı\s+(?:Kanun|KHK)\s+(?:md?\.?\s*|madde\s+)(\d+)(?:/(\d+))?",
    "tbk": r"TBK\s+(?:md?\.?\s*|madde\s+)(\d+)",
    "tck": r"TCK\s+(?:md?\.?\s*|madde\s+)(\d+)(?:/(\d+))?",
    "cmk": r"CMK\s+(?:md?\.?\s*|madde\s+)(\d+)",
    "hmk": r"HMK\s+(?:md?\.?\s*|madde\s+)(\d+)",
    "aihm": r"AİHM[,\s]+([A-Za-zçğıöşüÇĞİÖŞÜ\s]+)\s+[vV]\.?\s*(?:Türkiye|Turkey)\s*,?\s*(?:Başvuru\s+No\.?\s*)?(\d+/\d+)"
}
```

### Doğrulama Akışı — Adım Adım

**Adım 1: Extraction** (~5ms)
- Regex ile tüm referansları çıkar
- Her referansı tipine göre sınıfla (içtihat/mevzuat/doktrin)

**Adım 2: Cache Check** (~2ms)
- Redis'te daha önce doğrulanmış mı kontrol et
- Cache hit → direkt sonuç dön

**Adım 3: API Verification** (~100-500ms per reference)
- İçtihat: `yargi-mcp` API'ye karar numarasıyla sorgu
- Mevzuat: `mevzuat-mcp` API'ye kanun/madde numarasıyla sorgu
- AİHM: HUDOC API'ye başvuru numarasıyla sorgu

**Adım 4: Fuzzy Match** (doğrudan bulunamadığında, ~200ms)
- Yıl ve daire eşleşiyor ama numara farklıysa → "yakın eşleşme" öner
- Örnek: "9. HD 2023/1234" bulunamadı ama "9. HD 2023/1235" var → "Muhtemelen şu kararı kastettiniz: ..." önerisi

**Adım 5: Result Aggregation** (~5ms)
- Tüm referanslar için birleşik rapor oluştur
- Güven skoru hesapla

### Toplam Pipeline Süresi

| Senaryo | Süre |
|---------|------|
| 5 referans, hepsi cache'te | ~15ms |
| 5 referans, hiçbiri cache'te değil | ~600ms (paralel API çağrıları) |
| 20 referans, karışık | ~800ms |
| **Hedef üst sınır** | **<2 saniye** |

---

## 3.2 Grounding Stratejisi

### Katı Grounding Kuralları

```
KURAL 1: İçtihat ve mevzuat referansları → SADECE RAG context'inden
         LLM kendi parametrik bilgisinden referans ÜRETEMEZ

KURAL 2: Hukuki yorum ve analiz → RAG context + LLM reasoning
         LLM genel hukuk bilgisini yorum için kullanabilir
         AMA: Her yorum için dayanak göstermeli

KURAL 3: Strateji ve tahmin → LLM reasoning + istatistik verisi
         Açıkça "bu bir tahmindir" etiketi ile
```

### System Prompt Grounding Talimatları

```
Sen bir hukuk araştırma asistanısın. Avukata yardımcı olursun, onun yerine karar vermezsin.

MUTLAK KURALLAR:
1. ASLA uydurma içtihat numarası verme. Bir karar numarası yazıyorsan, bu numara sana verilen context'te AYNEN bulunmalıdır.
2. Context'te olmayan bir karardan bahsetme. "Bildiğim kadarıyla" diye başlayan içtihat referansları YASAKTIR.
3. Bir bilgiyi bilmiyorsan "Bu konuda elimdeki kaynaklarda bilgi bulunamadı" de.
4. Her içtihat referansının yanına [Doğrulanmış ✓] veya [Doğrulanmamış — kontrol gerekir] etiketi koy.
5. Mevzuat madde metni veriyorsan, context'teki tam metni kullan, kendi hafızandan madde metni yazma.
```

### Grounding Enforcement Katmanları

```
Katman 1: System Prompt (yukarıdaki talimatlar)
    │
Katman 2: RAG Context Injection
    │     Sadece doğrulanmış kaynaklar context'e eklenir
    │
Katman 3: Output Parser
    │     LLM çıktısındaki her referansı otomatik extract et
    │
Katman 4: Citation Verification (3.1'deki pipeline)
    │     Her referansı API ile doğrula
    │
Katman 5: UI Rendering
          Doğrulanmamış referanslar kırmızı etiketle gösterilir
```

---

## 3.3 Confidence Scoring

### Güven Skoru Hesaplama Formülü

```python
def calculate_confidence(response):
    scores = {
        "source_coverage": 0.0,      # Cevabın ne kadarı kaynaklı (0-1)
        "citation_verification": 0.0, # Referansların doğrulanma oranı (0-1)
        "freshness": 0.0,             # Kaynakların güncelliği (0-1)
        "consistency": 0.0,           # İç tutarlılık (0-1)
        "context_relevance": 0.0      # RAG sonuçlarının soruyla ilgisi (0-1)
    }

    weights = {
        "source_coverage": 0.30,
        "citation_verification": 0.30,
        "freshness": 0.15,
        "consistency": 0.15,
        "context_relevance": 0.10
    }

    final_score = sum(scores[k] * weights[k] for k in scores)
    return final_score
```

### Güven Skoru Gösterimi (UI)

```
┌─────────────────────────────────────────────────┐
│ Güven Skoru: ████████░░ 82%                     │
│                                                  │
│ 📊 Kaynak Kapsamı: ████████░░ 85%              │
│    → 12/14 argüman kaynaklı                      │
│                                                  │
│ ✓ Referans Doğrulama: █████████░ 95%            │
│    → 19/20 referans doğrulandı                   │
│    → 1 referans doğrulanamadı (⚠ aşağıda)       │
│                                                  │
│ 📅 Güncellik: ███████░░░ 70%                    │
│    → 3 karar 2020 öncesi (güncel emsal önerildi) │
│                                                  │
│ 🔗 Tutarlılık: █████████░ 90%                   │
│    → Çelişki tespit edilmedi                     │
└─────────────────────────────────────────────────┘
```

### Düşük Güven Skoru Eylemleri

| Skor Aralığı | Eylem |
|--------------|-------|
| 90-100% | Yeşil rozet, normal gösterim |
| 70-89% | Sarı rozet, "Bazı bilgiler doğrulanamamıştır" notu |
| 50-69% | Turuncu rozet, "Bu cevap sınırlı kaynağa dayanmaktadır, avukat doğrulaması önerilir" |
| 0-49% | Kırmızı rozet, "Bu cevabın güvenilirliği düşüktür. Bağımsız araştırma yapmanız önerilir." |
| <30% | **Cevap gösterilmez**, "Bu soru için yeterli kaynak bulunamadı" mesajı |

---

## 3.4 "Bilmiyorum" Modu

### Karar Ağacı

```
Soru geldi
    │
    ▼
RAG sonuçları var mı?
    │
    ├── Hayır → "Bu konuda kaynaklarımda bilgi bulunamadı."
    │           + Alternatif arama önerileri sun
    │
    ├── Evet ama düşük relevance (<0.5) →
    │       "Bu konuya yakın şu sonuçları buldum, ancak
    │        doğrudan cevap veremiyorum:" + sonuçları listele
    │
    └── Evet ve yüksek relevance (>0.5) →
            │
            Cevap üret
            │
            ▼
        Cevaptaki referanslar doğrulanıyor mu?
            │
            ├── Hayır (>%30 doğrulanamadı) →
            │       "Bu konuda bulduğum kaynakları doğrulayamadım.
            │        Manuel araştırma öneriyorum."
            │
            └── Evet → Normal çıktı + güven skoru
```

### "Bilmiyorum" Tetikleme Koşulları

1. **RAG boş dönerse:** Hiç ilgili kaynak bulunamadı
2. **RAG düşük skor dönerse:** En iyi sonucun relevance skoru <0.4
3. **Çelişkili kaynaklar:** Bulunan kaynaklar birbirine zıt ve çözümleme yapılamıyorsa
4. **Zaman aşımı:** Doğrulama API'leri timeout verirse
5. **Soru kapsamı dışında:** Türk hukuku dışı, henüz düzenlenmemiş alan
6. **Etik sınır:** "Nasıl suç işlenir" türü sorular

### Kullanıcıya Gösterim

```
┌─────────────────────────────────────────────────────┐
│ ⚠ Bu soru için yeterli güvenilir kaynak bulunamadı  │
│                                                      │
│ Ne yapabilirsiniz:                                   │
│ • Sorunuzu daha spesifik hale getirin               │
│   (örn: tarih aralığı, mahkeme, suç tipi)           │
│ • Şu alternatif aramayı deneyin: [önerilen sorgu]   │
│ • Kazancı/Lexpera üzerinden manuel arama yapın      │
│                                                      │
│ Neden cevap veremiyorum:                             │
│ [X] Kaynaklarda bu konuda yeterli emsal bulunamadı  │
│ [ ] Bulunan kaynaklar birbirine çelişiyor            │
│ [ ] Referanslar doğrulanamadı                        │
└─────────────────────────────────────────────────────┘
```

---

## 3.5 İçtihat Güncellik Kontrolü

### Bozulma/Değişiklik Tespit Mekanizması

```
İçtihat Bulundu: Yargıtay 9. HD 2019/1234 E., 2019/5678 K.
    │
    ▼
┌─────────────────────────────┐
│ FreshnessCheckerAgent       │
│                             │
│ 1. Aynı dosya numarasıyla  │
│    sonraki kararları ara    │
│    (yargi-mcp)              │
│                             │
│ 2. Bu kararı bozan/onayan   │
│    karar var mı?            │
│    → HGK/CGK kararı        │
│    → İBK kararı             │
│                             │
│ 3. İlgili kanun maddesi     │
│    değişmiş mi?             │
│    (mevzuat-mcp diff)       │
│                             │
│ 4. Sonraki yıllarda aynı   │
│    konuda farklı yönde      │
│    karar verilmiş mi?       │
│    (içtihat değişikliği)    │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ Güncellik Raporu            │
│                             │
│ Durum: ⚠ DİKKAT            │
│                             │
│ Bu karar (2019/5678) için:  │
│ • 2023/9012 K. ile Yargıtay │
│   HGK bu karardaki ilkeyi   │
│   değiştirmiştir            │
│ • Güncel emsal: 2023/9012   │
│ • İlgili kanun maddesi      │
│   (4857/18) değişmemiştir   │
│                             │
│ Öneri: 2023/9012 sayılı     │
│ HGK kararını kullanın       │
└─────────────────────────────┘
```

### Güncellik Kontrolü Katmanları

| Kontrol | Yöntem | Periyot |
|---------|--------|---------|
| Bozma/onama zinciri | Dosya numarası ile forward search | Her kullanımda (real-time) |
| İBK kontrolü | İBK veritabanı full-text search | Haftalık batch + her kullanımda |
| Kanun değişikliği | Mevzuat-mcp diff engine | Resmi Gazete yayımı tetikler |
| İçtihat eğilim değişikliği | Son 2 yıl kararlarıyla karşılaştırma | Aylık batch analiz |

### Proaktif Güncelleme Sistemi

Avukat bir kararı "kaydettiğinde" → `FreshnessCheckerAgent` o kararı watchlist'e ekler:
1. Haftalık kontrol: Bu kararla ilgili yeni gelişme var mı?
2. Yeni gelişme tespit edildiğinde avukata push notification:
   "Kaydettiğiniz Yargıtay 9. HD 2023/1234 kararı ile ilgili yeni bir HGK kararı yayımlandı."

---

## 3.6 Çapraz Doğrulama (Cross-Validation)

### Dual-Prompt Doğrulama

**Ne zaman kullanılır:** Güven skoru 50-80% arasında olan cevaplar için

```
Prompt A (Analitik): "Bu soruyu hukuki analiz yaparak cevapla.
Kullandığın her kaynağı belirt."

Prompt B (Eleştirel): "Bir avukat şu soruyu sordu ve şu cevabı aldı:
[Prompt A'nın cevabı]. Bu cevaptaki hataları, eksiklikleri ve
yanlış referansları tespit et."
```

### Çelişki Durumunda

```python
def handle_cross_validation_conflict(response_a, response_b):
    conflicts = detect_conflicts(response_a, response_b)

    if not conflicts:
        return response_a  # Çelişki yok, orijinal cevabı göster

    for conflict in conflicts:
        if conflict.type == "factual":
            # Olgusal çelişki → API ile doğrula
            verified = verify_with_api(conflict)
            use_verified_version(verified)

        elif conflict.type == "interpretive":
            # Yorumsal çelişki → Her iki görüşü de sun
            present_both_views(conflict)
            add_note("Bu konuda farklı yorumlar mevcuttur")

        elif conflict.type == "citation":
            # Referans çelişkisi → Citation verifier'a gönder
            verification = citation_verifier.verify(conflict.references)
            use_verified_references(verification)

    recalculate_confidence_score()
```

### Çapraz Doğrulama Performans Etkisi

- Ek LLM çağrısı: ~2-4 saniye
- Sadece orta güven aralığındaki cevaplar için kullanılır (tüm cevaplar için değil)
- Aylık maliyet etkisi: ~%15-20 ek LLM maliyeti

---

## 3.7 Audit Trail — Tam Kaynak Zinciri

### Her Cevap İçin Saklanan Metadata

```json
{
  "response_id": "resp_2026031900001",
  "timestamp": "2026-03-19T14:30:00Z",
  "user_id": "avukat_123",
  "query": "Orijinal soru",
  "response_text": "Cevap metni",
  "audit_trail": {
    "rag_sources": [
      {
        "source_type": "ictihat",
        "reference": "Yargıtay 9. HD 2023/1234 E., 2023/5678 K.",
        "retrieval_method": "hybrid_search",
        "relevance_score": 0.92,
        "verification_status": "verified",
        "verification_api": "yargi-mcp",
        "verification_timestamp": "2026-03-19T14:30:01Z",
        "freshness_check": "gecerli",
        "chunk_id": "chunk_yargitay_2023_1234_p3",
        "full_text_available": true
      }
    ],
    "llm_config": {
      "model": "claude-sonnet-4-6-20250514",
      "temperature": 0.1,
      "system_prompt_version": "v2.3",
      "context_window_usage": "45K/200K tokens"
    },
    "verification_results": {
      "total_citations": 8,
      "verified": 7,
      "unverified": 1,
      "verification_details": [...]
    },
    "confidence_score": {
      "overall": 0.85,
      "breakdown": {...}
    },
    "cross_validation": {
      "performed": false,
      "reason": "confidence > 80%"
    },
    "processing_time_ms": {
      "rag_retrieval": 340,
      "llm_generation": 2100,
      "citation_verification": 580,
      "total": 3020
    }
  }
}
```

### Kullanıcı Görünümü — "Neden Bu Cevabı Verdin?"

```
┌─────────────────────────────────────────────────────────┐
│ 📋 Kaynak Zinciri                                       │
│                                                          │
│ Bu cevap şu kaynaklara dayanmaktadır:                   │
│                                                          │
│ 1. Yargıtay 9. HD 2023/1234 E., 2023/5678 K. [✓]      │
│    → Karar tarihi: 15.05.2023                           │
│    → Güncellik: Geçerli (bozulmamış)                    │
│    → İlgili bölüm: "...işverenin fesihte son care       │
│      ilkesine uyması gerekir..."                        │
│    [Tam kararı görüntüle]                               │
│                                                          │
│ 2. 4857 sayılı İş Kanunu md. 18 [✓]                    │
│    → Son değişiklik: 12.10.2024                          │
│    → Tam madde metni: [Görüntüle]                       │
│                                                          │
│ 3. Prof. Dr. Sarper Süzek, İş Hukuku, 2023, s.587 [~]  │
│    → Doğrulama: Kitap referansı, otomatik doğrulama     │
│      yapılamadı                                          │
│                                                          │
│ ℹ Cevap üretim süresi: 3.0 saniye                      │
│ ℹ Model: Claude Sonnet 4.6                              │
│ ℹ Güven skoru: 85%                                      │
│                                                          │
│ [📥 Rapor olarak indir] [🔄 Yeniden doğrula]           │
└─────────────────────────────────────────────────────────┘
```

### Audit Trail Saklama Politikası

| Veri | Saklama Süresi | Neden |
|------|---------------|-------|
| Tam audit trail | 5 yıl | Hukuki sorumluluk (avukatlık meslek kuralları) |
| Kullanıcı sorguları (anonimleştirilmiş) | 2 yıl | Ürün geliştirme |
| LLM raw output | 90 gün | Debug ve kalite kontrol |
| Doğrulama logları | 1 yıl | Sistem güvenilirliği analizi |
| Cache | 24 saat | Performans |

### Hukuki Sorumluluk Notu

Her cevabın altında sabit disclaimer:
> "Bu çıktı yapay zeka destekli bir araştırma aracı tarafından üretilmiştir. Hukuki tavsiye niteliği taşımaz. Tüm referansların avukat tarafından bağımsız olarak doğrulanması önerilir. Nihai hukuki değerlendirme ve karar sorumluluğu avukata aittir."
