# BÖLÜM 1: AJAN MİMARİSİ — TAM DÖKÜM

> **Temel İlke:** Sistem avukatın işini destekler, yapmaz. Her çıktıda avukat son kararı verir; sistem araştırma + taslak + analiz üretir.

---

## 1.1 Ajan Envanteri — Toplam 19 Ajan

### ORKESTRATÖR (Meta-Ajan)

**Ajan Adı:** `OrchestratorAgent`
**Rolü:** Tüm ajanları koordine eden merkezi beyin. Kullanıcı isteğini analiz eder, hangi ajanların hangi sırayla çalışacağına karar verir, paralel/sıralı akışı yönetir, shared state tutar.

- **Tetiklenme:** Her kullanıcı isteğinde otomatik devreye girer
- **Araçlar:** Intent classifier (fine-tuned BERT modeli), task planner, agent registry, shared state manager (Redis), priority queue
- **Girdi:** Kullanıcının doğal dil isteği + aktif dava context'i + kullanıcı profili
- **Çıktı:** Ajan çalıştırma planı (DAG — Directed Acyclic Graph formatında)
- **Bağlantı:** Tüm ajanlarla bidirectional bağlantı. Event bus üzerinden pub/sub pattern.
- **Başarı kriteri:** Doğru ajanları doğru sırayla tetikleme, <%2 yanlış yönlendirme
- **Başarısızlık modu:** Intent belirsizse kullanıcıya 2-3 seçenek sunar ("İçtihat mı arıyorsunuz, dilekçe mi yazmak istiyorsunuz?")

---

### A. ARAŞTIRMA AJANLARI

#### A1. `IctihatSearchAgent` — İçtihat Arama Ajanı

- **Rolü:** Yargıtay, Danıştay, AYM, Bölge Adliye/İdare Mahkemeleri kararlarını arar, sıralar, özetler
- **Tetiklenme:** Kullanıcı içtihat sorusu sorduğunda VEYA dilekçe yazımında otomatik olarak
- **Araçlar:**
  - `yargi-mcp` API (Yargıtay, Danıştay, AYM, KİK, Rekabet, Sayıştay, KVKK, BDDK)
  - Vector DB semantic search (Qdrant)
  - BM25 keyword search (Elasticsearch)
  - Hybrid search orchestrator (RRF — Reciprocal Rank Fusion)
- **Girdi formatı:**
  ```json
  {
    "query": "doğal dil sorgusu",
    "hukuk_alani": "ceza|is|ticaret|idare|...",
    "tarih_araligi": {"baslangic": "2020-01-01", "bitis": "2026-03-19"},
    "mahkeme_filtre": ["yargitay_9hd", "danistay_5d"],
    "max_sonuc": 20,
    "siralama": "relevance|tarih|mahkeme"
  }
  ```
- **Çıktı formatı:**
  ```json
  {
    "sonuclar": [
      {
        "karar_id": "2023/1234",
        "mahkeme": "Yargıtay 9. HD",
        "tarih": "2023-05-15",
        "ozet": "...",
        "anahtar_ilke": "...",
        "relevance_score": 0.92,
        "guncellik_durumu": "gecerli|bozulmus|kismen_degistirilmis",
        "tam_metin_link": "...",
        "iliskili_kararlar": ["2022/5678", "2024/9012"]
      }
    ],
    "meta": {"toplam_bulunan": 156, "sure_ms": 340}
  }
  ```
- **Bağlantı:** `CitationVerifierAgent`'a çıktı verir (her sonuç doğrulanır), `StrategyAgent`'a veri sağlar, `DilekceWriterAgent` tarafından çağrılır
- **Başarı kriteri:** Precision@10 > 0.85, recall > 0.75, yanıt süresi <2 saniye
- **Başarısızlık modu:** Sonuç bulamazsa sorguyu genişletir (tarih aralığını genişlet, eş anlamlı terimler ekle). Hâlâ sonuç yoksa kullanıcıya "Bu konuda içtihat bulunamadı, aramayı şu şekilde genişletebilirsiniz" önerir.

#### A2. `MevzuatSearchAgent` — Mevzuat Tarama Ajanı

- **Rolü:** Kanun, KHK, yönetmelik, tüzük, tebliğ arama ve madde bazlı getirme
- **Tetiklenme:** Mevzuat referansı gerektiğinde (kullanıcı sorusu veya başka ajan talebi)
- **Araçlar:**
  - `mevzuat-mcp` API
  - Resmi Gazete açık erişim API
  - Mevzuat değişiklik takip sistemi (diff engine)
- **Girdi:**
  ```json
  {
    "query": "doğal dil veya kanun numarası",
    "kanun_no": "6098",
    "madde_no": "117",
    "tarih": "2026-03-19",
    "degisiklik_gecmisi": true
  }
  ```
- **Çıktı:**
  ```json
  {
    "madde_metni": "...",
    "yururluk_tarihi": "2012-07-01",
    "son_degisiklik": "2024-11-20",
    "degisiklik_gecmisi": [...],
    "iliskili_maddeler": [...],
    "iliskili_ictihatlar_ozet": "..."
  }
  ```
- **Bağlantı:** `IctihatSearchAgent` ile karşılıklı (içtihat mevzuata referans verir, mevzuat içtihada), `DilekceWriterAgent`'a doğrudan veri sağlar
- **Başarı kriteri:** Güncel mevzuat metninin %100 doğruluğu (bu alanda hallüsinasyon kabul edilemez)
- **Başarısızlık modu:** Mevzuat-mcp'den cevap gelmezse Resmi Gazete API'ye fallback. O da başarısızsa "Mevzuat kaynağına erişilemiyor, lütfen mevzuat.gov.tr üzerinden kontrol edin" uyarısı.

#### A3. `DoctrinSearchAgent` — Makale ve Doktrin Bulma Ajanı

- **Rolü:** Akademik makaleler, kitap bölümleri, tez özetleri, konferans bildirileri arama
- **Tetiklenme:** Kullanıcı akademik kaynak istediğinde veya strateji ajanı doktrin desteği gerektiğinde
- **Araçlar:**
  - DergiPark API
  - YÖK Tez Merkezi scraper (rate-limited)
  - Google Scholar API (SerpAPI üzerinden)
  - Özel hukuk dergileri index'i (Ankara Barosu Dergisi, İstanbul Barosu Dergisi vs.)
- **Girdi:**
  ```json
  {
    "konu": "doğal dil arama terimi",
    "yazar": "opsiyonel",
    "dergi": "opsiyonel",
    "yil_araligi": {"min": 2015, "max": 2026}
  }
  ```
- **Çıktı:**
  ```json
  {
    "makaleler": [
      {
        "baslik": "...",
        "yazar": "...",
        "dergi": "...",
        "yil": 2023,
        "ozet": "...",
        "doi": "...",
        "erisim_linki": "...",
        "relevance_score": 0.88
      }
    ]
  }
  ```
- **Bağlantı:** `StrategyAgent`'a akademik dayanak sağlar, `DilekceWriterAgent` doktrin referansı kullanır
- **Başarı kriteri:** Relevant makale bulma oranı >70%, yazar/yıl bilgisi %100 doğru
- **Başarısızlık modu:** DergiPark API erişim sorunu varsa cache'ten sunar + kullanıcıyı bilgilendirir

#### A4. `AIHMSearchAgent` — AİHM ve AYM Bireysel Başvuru Tarama Ajanı

- **Rolü:** Avrupa İnsan Hakları Mahkemesi kararları ve AYM bireysel başvuru kararları arama
- **Tetiklenme:** Temel hak ihlali iddiası içeren davalarda, AYM bireysel başvuru hazırlığında
- **Araçlar:**
  - HUDOC API (AİHM resmi veritabanı)
  - AYM Kararlar Bilgi Bankası API
  - `yargi-mcp` AYM modülü
- **Girdi:**
  ```json
  {
    "ihlal_edilen_hak": "adil yargilanma|ifade_ozgurlugu|mulkiyet|...",
    "anahtar_kelime": "...",
    "ulke_filtre": "TUR",
    "makale_no": "6/1"
  }
  ```
- **Çıktı:** AİHM/AYM karar özetleri, ihlal tespit oranları, Türkiye aleyhine verilen kararların analizi
- **Bağlantı:** `StrategyAgent` ile (özellikle AYM başvuru hazırlığında), `DilekceWriterAgent` ile
- **Başarı kriteri:** HUDOC ID doğruluğu %100, ihlal türü sınıflandırma doğruluğu >90%
- **Başarısızlık modu:** HUDOC API'de Türkçe çeviri yoksa orijinal İngilizce/Fransızca metni sunar + "Bu karar henüz Türkçeye çevrilmemiştir" notu ekler

#### A5. `EmsalAnalysisAgent` — Emsal Karar Analiz Ajanı

- **Rolü:** Bulunan içtihatları derinlemesine analiz eder: ilke çıkarır, karşılaştırır, trend belirler
- **Tetiklenme:** İçtihat arama sonuçları geldikten sonra, strateji ajanı talep ettiğinde
- **Araçlar:**
  - LLM (Claude API) — analiz ve karşılaştırma için
  - Graph DB (Neo4j) — karar ilişki ağı
  - Temporal analysis engine — zaman içinde içtihat değişim tespiti
- **Girdi:** İçtihat listesi + analiz sorusu ("Bu konuda Yargıtay görüşü değişti mi?")
- **Çıktı:**
  ```json
  {
    "ilke_ozeti": "...",
    "trend_analizi": "artan_koruma|gevsetme|istikrarli",
    "donum_noktalari": [{"tarih": "2021-03", "aciklama": "İBK ile görüş değişikliği"}],
    "guncel_baskın_gorus": "...",
    "muhalefet_serhi_ozeti": "..."
  }
  ```
- **Bağlantı:** `IctihatSearchAgent`'tan veri alır, `StrategyAgent`'a ve `DilekceWriterAgent`'a analiz sunar
- **Başarı kriteri:** Trend tespiti doğruluğu >85% (avukat validasyonu ile)
- **Başarısızlık modu:** Yeterli veri yoksa ("Bu konuda sadece 3 karar bulundu, trend analizi güvenilir değil") uyarısı

---

### B. YAZIM AJANLARI

#### B1. `DilekceWriterAgent` — Dilekçe Taslak Ajanı

- **Rolü:** Her türlü dilekçe taslağı üretir: dava, cevap, istinaf, temyiz, ihtarname, arabuluculuk tutanağı
- **Tetiklenme:** Kullanıcı dilekçe yazmak istediğinde
- **Araçlar:**
  - LLM (Claude API) — metin üretimi
  - Dilekçe şablon kütüphanesi (500+ şablon, hukuk alanı bazlı)
  - `IctihatSearchAgent` çağrısı (otomatik içtihat yerleştirme)
  - `MevzuatSearchAgent` çağrısı (otomatik madde referansı)
  - `StyleLearnerAgent` çağrısı (avukatın yazım stili)
  - `ContradictionCheckerAgent` çağrısı (çelişki kontrolü)
- **Girdi:**
  ```json
  {
    "dilekce_turu": "dava|cevap|istinaf|temyiz|ihtarname|arabuluculuk_tutanagi|vekaletname",
    "mahkeme": "...",
    "taraflar": {...},
    "olay_ozeti": "avukatın anlattığı olay",
    "talepler": [...],
    "mevcut_deliller": [...],
    "ton": "resmi|agresif|uzlasici",
    "kullanicinin_onceki_dilekceleri_stili": "style_embedding"
  }
  ```
- **Çıktı:**
  ```json
  {
    "taslak_metin": "...",
    "kullanilan_ictihatlar": [{"referans": "...", "dogrulanma_durumu": "verified", "relevance": 0.95}],
    "kullanilan_mevzuat": [...],
    "eksik_arguman_uyarilari": [...],
    "celiskiler": [...],
    "guven_skoru": 0.87,
    "revizyon_onerileri": [...]
  }
  ```
- **Bağlantı:** Araştırma ajanlarından veri alır, `CitationVerifierAgent`'a çıktı gönderir, `ContradictionCheckerAgent` ile paralel çalışır
- **Başarı kriteri:** Avukatın taslağı %70+ oranında kabul edip üzerinde çalışması, ortalama revizyon sayısı <3
- **Başarısızlık modu:** Yeterli bilgi yoksa "Bu dilekçe için şu bilgilere ihtiyacım var: [liste]" döner. Hiçbir zaman eksik bilgiyle tam dilekçe üretmez.

#### B2. `ContractWriterAgent` — Sözleşme Taslak Ajanı

- **Rolü:** Sözleşme taslağı oluşturma ve mevcut sözleşme düzenleme
- **Tetiklenme:** Sözleşme hazırlama talebi geldiğinde
- **Araçlar:**
  - LLM (Claude API)
  - Sözleşme şablon kütüphanesi (kira, iş, hizmet, franchise, lisans, NDA, SHA vs.)
  - `ContractAnalysisAgent` (mevcut sözleşme varsa risk analizi)
  - `MevzuatSearchAgent` (emredici hüküm kontrolü)
- **Girdi:** Sözleşme türü, taraflar, özel koşullar, süre, bedel, cezai şart tercihleri
- **Çıktı:** Sözleşme taslağı + risk uyarıları + emredici hüküm uyumluluk raporu
- **Başarı kriteri:** Emredici hüküm ihlali %0, avukatın genel yapıyı kabul etme oranı >80%
- **Başarısızlık modu:** Sözleşme türünü tanıyamıyorsa genel çerçeve sunar + "Bu özel sözleşme türü için uzman görüşü alınmasını öneririz" notu

---

### C. STRATEJİ AJANLARI

#### C1. `CaseStrategyAgent` — Dava Strateji Ajanı

- **Rolü:** Davanın güçlü/zayıf yönlerini analiz eder, kazanma olasılığı hesaplar, strateji önerir
- **Tetiklenme:** Yeni dava alındığında, duruşma öncesi hazırlıkta, strateji sorusu sorulduğunda
- **Araçlar:**
  - LLM (Claude API) — analiz ve reasoning
  - `EmsalAnalysisAgent` (benzer dava sonuçları)
  - İstatistik motoru (mahkeme bazlı kabul/red oranları)
  - Monte Carlo simülasyonu (outcome prediction)
  - `JudgeProfileAgent` (hakim eğilim verisi)
- **Girdi:**
  ```json
  {
    "dava_ozeti": "...",
    "deliller": [...],
    "hukuki_dayanak": [...],
    "mahkeme": "...",
    "hakim": "opsiyonel",
    "karsi_taraf_bilinen_argumanlar": [...]
  }
  ```
- **Çıktı:**
  ```json
  {
    "guclu_yonler": [...],
    "zayif_yonler": [...],
    "kazanma_olasiligi": {"genel": 0.72, "detay": {...}},
    "risk_skoru": "orta",
    "strateji_onerileri": [...],
    "karsi_taraf_tahmini_argumanlar": [...],
    "alternatif_cozum_yollari": ["arabuluculuk", "sulh"],
    "uyari": "Bu analiz tahmini niteliktedir, hukuki tavsiye yerine geçmez"
  }
  ```
- **Bağlantı:** Tüm araştırma ajanlarından veri alır, `DilekceWriterAgent`'a strateji bilgisi verir
- **Başarı kriteri:** Tahmin doğruluğu >65% (6 aylık retrospektif analiz ile), avukat memnuniyeti >4/5
- **Başarısızlık modu:** Yeterli veri yoksa geniş güven aralığı verir (ör. "30-70% arası, çünkü bu konuda yeterli emsal yok"). Kesinlikle yanıltıcı kesinlikte tahmin yapmaz.

#### C2. `JudgeProfileAgent` — Hakim Profil Ajanı

- **Rolü:** Belirli bir mahkeme/hakimin karar verme eğilimlerini analiz eder
- **Tetiklenme:** Dava strateji analizi sırasında veya kullanıcı doğrudan sorduğunda
- **Araçlar:**
  - `yargi-mcp` üzerinden mahkeme bazlı karar arama
  - İstatistik motoru (kabul/red oranı, ortalama tazminat miktarı, süre analizi)
  - Anonimleştirilmiş karar veri seti
- **Girdi:** Mahkeme adı, hukuk alanı, opsiyonel hakim adı (anonimleştirilmiş analiz)
- **Çıktı:** Mahkemenin kabul/red oranları, ortalama karar süreleri, sık başvurulan içtihatlar, eğilim analizi
- **Başarı kriteri:** İstatistiklerin gerçek verilerle örtüşme oranı >90%
- **Başarısızlık modu:** Yeterli karar verisi yoksa "Bu mahkemede [N] karar incelendi, istatistiksel güvenilirlik düşük" uyarısı

#### C3. `OpposingCounselAgent` — Karşı Taraf Analiz Ajanı

- **Rolü:** Karşı taraf avukatının daha önce kullandığı argümanları analiz eder
- **Tetiklenme:** Karşı taraf avukatı bilindiğinde, cevap dilekçesi hazırlanırken
- **Araçlar:**
  - Kamuya açık mahkeme kararlarında avukat adı arama
  - Argüman pattern extraction (LLM)
- **Girdi:** Karşı taraf avukat adı (baro sicil numarası opsiyonel), dava alanı
- **Çıktı:** Sık kullandığı argümanlar, kazanma/kaybetme oranları, strateji pattern'leri
- **Başarı kriteri:** Tespit edilen argümanların gerçekle örtüşmesi >70%
- **Başarısızlık modu:** Yeterli veri yoksa genel alan bazlı analiz sunar

---

### D. DOĞRULAMA AJANLARI

#### D1. `CitationVerifierAgent` — Kaynak Doğrulama Ajanı

- **Rolü:** Her içtihat referansının gerçek olduğunu doğrular, hallüsinasyonu tespit eder
- **Tetiklenme:** Her LLM çıktısında otomatik olarak (post-processing pipeline'ında)
- **Araçlar:**
  - `yargi-mcp` API (karar numarası ile doğrudan sorgulama)
  - `mevzuat-mcp` API (madde numarası doğrulama)
  - Regex parser (karar numarası formatı: "Yargıtay X. HD 2023/1234 E., 2023/5678 K.")
  - Cache (doğrulanmış referanslar Redis'te 24 saat saklanır)
- **Girdi:** LLM'nin ürettiği metin + içindeki tüm referanslar (otomatik extract edilir)
- **Çıktı:**
  ```json
  {
    "dogrulanan_referanslar": [{"ref": "...", "durum": "dogru", "api_response_ms": 120}],
    "dogrulanamayan_referanslar": [{"ref": "...", "durum": "bulunamadi", "oneri": "..."}],
    "halusinasyon_tespit": true/false,
    "genel_guvenilirlik": 0.95
  }
  ```
- **Bağlantı:** `DilekceWriterAgent` ve tüm LLM çıktı üreten ajanların output'unu işler
- **Başarı kriteri:** Hallücinasyon tespit oranı >99%, false positive <2%
- **Başarısızlık modu:** API erişim sorunu varsa referansı "doğrulanamadı — manuel kontrol gerekir" olarak işaretler

#### D2. `FreshnessCheckerAgent` — Güncellik Kontrol Ajanı

- **Rolü:** Bir içtihadın hâlâ geçerli olup olmadığını kontrol eder (bozma, değiştirme, İBK ile aşılma)
- **Tetiklenme:** İçtihat sonucu döndüğünde ve dilekçeye referans eklenirken
- **Araçlar:**
  - `yargi-mcp` — aynı dosya numarası ile sonraki kararları arama
  - Karar ilişki graph'ı (Neo4j) — bozma/onama zinciri
  - İçtihadı Birleştirme Kararları (İBK) veritabanı
- **Girdi:** Karar bilgileri (mahkeme, esas no, karar no, tarih)
- **Çıktı:**
  ```json
  {
    "guncel_mi": true/false,
    "durum": "gecerli|bozulmus|kismen_degistirilmis|IBK_ile_asilmis",
    "aciklama": "Bu karar 2024/7890 sayılı kararla bozulmuştur",
    "guncel_emsal": {"karar_id": "...", "ozet": "..."}
  }
  ```
- **Başarı kriteri:** Bozulmuş kararı tespit oranı >95%
- **Başarısızlık modu:** Zincir takip edilemezse "Bu kararın sonraki akıbeti doğrulanamadı" uyarısı

#### D3. `ContradictionCheckerAgent` — Çelişki Tespit Ajanı

- **Rolü:** Dilekçedeki argümanların birbiriyle çelişip çelişmediğini kontrol eder
- **Tetiklenme:** Dilekçe taslağı üretildikten sonra otomatik
- **Araçlar:**
  - LLM (Claude API) — semantic contradiction detection
  - NLI modeli (Natural Language Inference — fine-tuned Türkçe)
  - Mantık kuralları motoru (hukuki argüman tutarlılığı)
- **Girdi:** Dilekçe taslağı tam metni
- **Çıktı:** Tespit edilen çelişkiler listesi + önerilen düzeltmeler
- **Başarı kriteri:** Gerçek çelişkileri tespit oranı >85%, false positive <10%
- **Başarısızlık modu:** Emin değilse "potansiyel çelişki" olarak işaretler, avukata bırakır

---

### E. BELGE ANALİZ AJANLARI

#### E1. `DocumentReaderAgent` — Belge Okuma Ajanı

- **Rolü:** PDF, DOCX, UDF formatındaki belgeleri okur, yapılandırır, metni extract eder
- **Tetiklenme:** Kullanıcı dosya yüklediğinde
- **Araçlar:**
  - Apache Tika / PyMuPDF (PDF extraction)
  - python-docx (DOCX)
  - UDF parser (özel geliştirme — Bölüm 5'te detay)
  - OCR motoru (Tesseract + Türkçe dil paketi) — taranmış belgeler için
  - Layout analysis (LayoutLMv3) — tablo ve yapı tespiti
- **Girdi:** Dosya binary + dosya türü
- **Çıktı:** Yapılandırılmış metin + metadata + tespit edilen bölümler (taraflar, talepler, deliller vs.)
- **Başarı kriteri:** Metin extraction doğruluğu >98%, yapı tespiti >90%
- **Başarısızlık modu:** OCR kalitesi düşükse "Bu belge düşük kalitede taranmış, bazı bölümler okunamadı" uyarısı + okunabilen kısımları sunar

#### E2. `ContractAnalysisAgent` — Sözleşme Analiz Ajanı

- **Rolü:** Mevcut bir sözleşmeyi analiz eder: risk tespit, eksik madde, emredici hüküm uyumsuzluk
- **Tetiklenme:** Sözleşme inceleme talebi geldiğinde
- **Araçlar:**
  - LLM (Claude API)
  - Sözleşme risk pattern kütüphanesi
  - `MevzuatSearchAgent` (emredici hüküm kontrolü)
  - Karşılaştırma motoru (piyasa standardı vs. mevcut sözleşme)
- **Girdi:** Sözleşme metni (DocumentReaderAgent'tan) + analiz odağı ("riskler" / "eksikler" / "tam analiz")
- **Çıktı:** Madde bazlı risk raporu + genel risk skoru + düzeltme önerileri
- **Başarı kriteri:** Kritik risklerin tespit oranı >90%
- **Başarısızlık modu:** Sözleşme türünü tanıyamıyorsa genel analiz + "Bu sözleşme türü için uzman görüşü önerilir" notu

#### E3. `EvidenceMatrixAgent` — Delil Matrisi Ajanı

- **Rolü:** Dava dosyasındaki delilleri organize eder, her iddia için hangi delilin var olduğunu matris haline getirir
- **Tetiklenme:** Dava hazırlığı veya duruşma hazırlığı sırasında
- **Araçlar:**
  - LLM — delil-iddia eşleştirmesi
  - Yapılandırılmış dava dosyası veritabanı
- **Girdi:** Dava dosyası belgeleri + iddia listesi
- **Çıktı:** İddia-delil matrisi + eksik delil uyarıları + delil gücü değerlendirmesi
- **Başarı kriteri:** Avukatın matrisi %80+ doğru bulması
- **Başarısızlık modu:** Belirsiz delil-iddia ilişkisini "avukat onayı gerekir" olarak işaretler

---

### F. OPERASYONEL AJANLAR

#### F1. `DeadlineTrackerAgent` — Süre Takip Ajanı

- **Rolü:** Hak düşürücü süreler, zamanaşımı, duruşma tarihleri, yasal sürelerin takibi ve uyarı
- **Tetiklenme:** Her gün sabah otomatik + yeni dava eklendiğinde + kullanıcı sorduğunda
- **Araçlar:**
  - Takvim motoru (iş günü hesaplama dahil — resmi tatiller otomatik)
  - Bildirim sistemi (push notification, e-mail, SMS)
  - CMK/HMK/İYUK süre veritabanı
  - `MevzuatSearchAgent` (süre değişikliği kontrolü)
- **Girdi:** Dava türü, işlem tarihi, mahkeme, ilgili kanun maddeleri
- **Çıktı:** Süre listesi + geri sayım + uyarı seviyeleri (yeşil/sarı/kırmızı)
- **Başarı kriteri:** %100 doğru süre hesaplaması (bu alanda hata kabul edilemez), uyarıların zamanında iletilmesi
- **Başarısızlık modu:** Süre belirsizse (özel durumlar, ek süre talepleri) avukata "Bu süre hesabı şu varsayımlara dayanmaktadır: [...]" notu + dikkat uyarısı

#### F2. `ClientReportAgent` — Müvekkil Raporu Ajanı

- **Rolü:** Avukat için müvekkile gönderilecek durum raporu üretir (teknik olmayan dil)
- **Tetiklenme:** Avukat müvekkil raporu istediğinde
- **Araçlar:** LLM — sadeleştirme ve rapor formatlaması
- **Girdi:** Dava dosyası özeti + son gelişmeler + bir sonraki adımlar
- **Çıktı:** Müvekkile uygun dilde rapor (PDF export ready)
- **Başarı kriteri:** Hukuk terminolojisi kullanılmadan anlaşılır metin üretimi
- **Başarısızlık modu:** Çok teknik konuları basitleştiremezse "Bu bölümü avukatın kendi açıklamasıyla tamamlaması önerilir" notu

---

### G. HAFIZA VE ÖĞRENME AJANI

#### G1. `MemoryAgent` — Hafıza ve Kişiselleştirme Ajanı

- **Rolü:** Avukatın tercihlerini, yazım stilini, sık çalıştığı alanları öğrenir ve sistemi kişiselleştirir
- **Tetiklenme:** Her etkileşimde pasif olarak veri toplar + periyodik analiz (haftalık)
- **Araçlar:**
  - User preference DB (PostgreSQL)
  - Style embedding modeli (avukatın dilekçelerinden stil vektörü çıkarma)
  - Usage analytics engine
  - A/B test framework (hangi öneriler kabul ediliyor)
- **Girdi:** Kullanıcı etkileşim logları, kabul/red edilen öneriler, düzenleme pattern'leri
- **Çıktı:** Kullanıcı profili güncellemesi, stil parametreleri, tercih ayarları
- **Bağlantı:** Tüm ajanlarla — her ajan MemoryAgent'tan kullanıcı tercihlerini okur
- **Başarı kriteri:** Zaman içinde kabul edilen öneri oranının artması
- **Başarısızlık modu:** Yeterli veri yoksa (yeni kullanıcı) default profil kullanır, explicit tercih sorar

---

## 1.2 Orkestrasyon Akışı

```
Kullanıcı İsteği
       │
       ▼
┌─────────────────┐
│  OrchestratorAgent │ ─── Intent Classification
└────────┬────────┘
         │
    ┌────┴────┐
    │ Intent  │
    │ Router  │
    └────┬────┘
         │
    ┌────┼────────────┬──────────────┬───────────────┐
    ▼    ▼            ▼              ▼               ▼
 Araştırma       Yazım          Strateji        Operasyonel
 Pipeline       Pipeline        Pipeline        Pipeline
    │              │               │               │
    ▼              ▼               ▼               ▼
┌────────┐   ┌────────┐     ┌──────────┐    ┌──────────┐
│İçtihat │   │Dilekçe │     │  Strateji│    │  Süre    │
│Mevzuat │──▶│Sözleşme│◀────│  Hakim   │    │  Takvim  │
│Makale  │   │        │     │  Karşı T.│    │  Rapor   │
│AİHM    │   └───┬────┘     └──────────┘    └──────────┘
│Emsal   │       │
└────────┘       ▼
            ┌──────────┐
            │Doğrulama │  (Her LLM çıktısında otomatik)
            │Pipeline  │
            ├──────────┤
            │Citation  │
            │Freshness │
            │Çelişki   │
            └──────────┘
                 │
                 ▼
         ┌──────────────┐
         │ Kullanıcıya  │
         │ Final Çıktı  │
         │ + Güven Skoru │
         │ + Kaynaklar   │
         └──────────────┘
```

### Paralel vs. Sıralı Çalışma Kuralları

| Senaryo | Çalışma Modu | Neden |
|---------|-------------|-------|
| İçtihat + Mevzuat arama | **Paralel** | Bağımsız veri kaynakları |
| İçtihat arama → Citation verification | **Sıralı** | Doğrulama aramaya bağımlı |
| Dilekçe yazımı → Çelişki kontrolü | **Sıralı** | Kontrol dilekçeye bağımlı |
| Strateji analizi: Hakim + Emsal + Karşıvekil | **Paralel** | Bağımsız analizler |
| Sabah briefingi: Takvim + Yeni kararlar + UYAP | **Paralel** | Bağımsız veri kaynakları |

### Shared State Yönetimi

```
┌─────────────────────────────────────┐
│         Redis Shared State          │
├─────────────────────────────────────┤
│ session:{user_id}:{session_id}      │
│   ├── active_case_context           │
│   ├── search_history                │
│   ├── current_document              │
│   └── agent_results_cache           │
├─────────────────────────────────────┤
│ user:{user_id}                      │
│   ├── preferences                   │
│   ├── style_embedding               │
│   ├── active_cases[]                │
│   └── notification_settings         │
├─────────────────────────────────────┤
│ case:{case_id}                      │
│   ├── parties                       │
│   ├── documents[]                   │
│   ├── deadlines[]                   │
│   ├── research_results[]            │
│   └── strategy_analysis             │
└─────────────────────────────────────┘
```

### Event Bus (Apache Kafka / Redis Streams)

Her ajan olayları event bus'a yazar, ilgili ajanlar dinler:

- `ictihat.found` → `CitationVerifierAgent`, `FreshnessCheckerAgent` dinler
- `dilekce.drafted` → `ContradictionCheckerAgent`, `CitationVerifierAgent` dinler
- `document.uploaded` → `DocumentReaderAgent` dinler
- `deadline.approaching` → `DeadlineTrackerAgent` bildirim gönderir
- `case.created` → `CaseStrategyAgent` ön analiz başlatır
- `user.feedback` → `MemoryAgent` tercih günceller
