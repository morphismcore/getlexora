# BÖLÜM 7: TEKNİK STACK — PRODUCTION GRADE

> **Temel İlke:** KVKK uyumlu, ölçeklenebilir, 500+ avukat destekleyen, Türkçe hukuk metni için optimize edilmiş altyapı.

---

## 7.1 LLM Seçimi

### Karşılaştırma Tablosu

| Kriter | Claude API (Sonnet 4.6) | GPT-4o | Açık Kaynak (Qwen2.5-72B) |
|--------|------------------------|--------|---------------------------|
| Türkçe kalitesi | Çok iyi | Çok iyi | İyi (fine-tune ile çok iyi) |
| Hukuk reasoning | Üstün (uzun context) | Çok iyi | Orta |
| Context window | 200K token | 128K token | 32K-128K |
| Maliyet (1M token) | ~$3 input / $15 output | ~$2.5 input / $10 output | Self-host: GPU maliyeti |
| Latency | 1-3s | 1-3s | Self-host: 2-5s |
| KVKK uyumu | EU veri işleme | EU veri işleme | Self-host: tam kontrol |
| Streaming | Evet | Evet | Evet |
| Tool use | Native | Native | Sınırlı |

### Önerilen Strateji: Hibrit Model Yaklaşımı

```
Tier 1 — Claude Sonnet 4.6 (ana model):
├── Dilekçe yazımı
├── Strateji analizi
├── Kompleks reasoning gerektiren tüm görevler
├── Uzun document analizi (200K context avantajı)
└── Maliyet: ~$0.10-0.30 per request

Tier 2 — Claude Haiku 4.5 (hızlı/ucuz görevler):
├── Intent classification
├── Basit sorgu yeniden yazma
├── Özet çıkarma
├── Confidence scoring
└── Maliyet: ~$0.01-0.03 per request

Tier 3 — Fine-tuned açık kaynak (opsiyonel, Ay 6+):
├── Citation extraction (özel NER)
├── Belge sınıflandırma
├── Türkçe hukuk embedding
└── Self-hosted, KVKK tam uyumlu
```

### Neden Claude Ana Model?

1. **200K context:** Uzun hukuk belgeleri ve çoklu içtihat analizi için kritik
2. **Tool use:** Native function calling → ajan mimarisi için ideal
3. **Reasoning kalitesi:** Hukuki analiz ve argüman üretiminde üstün
4. **Güvenlik:** Constitutional AI → hallücinasyon riski düşük, "bilmiyorum" deme eğilimi yüksek
5. **Anthropic API SLA:** %99.5 uptime garantisi

---

## 7.2 Ajan Framework Seçimi

### Karşılaştırma

| Kriter | LangGraph | CrewAI | AutoGen | LlamaIndex Workflows |
|--------|-----------|--------|---------|---------------------|
| Ajan orkestrasyonu | ★★★★★ | ★★★★☆ | ★★★☆☆ | ★★★☆☆ |
| State management | ★★★★★ | ★★★☆☆ | ★★☆☆☆ | ★★★☆☆ |
| Conditional routing | ★★★★★ | ★★★☆☆ | ★★★★☆ | ★★★★☆ |
| Streaming support | ★★★★★ | ★★★☆☆ | ★★☆☆☆ | ★★★★☆ |
| Human-in-the-loop | ★★★★★ | ★★☆☆☆ | ★★★☆☆ | ★★☆☆☆ |
| Production readiness | ★★★★★ | ★★★☆☆ | ★★☆☆☆ | ★★★★☆ |
| Debugging/observability | ★★★★★ | ★★★☆☆ | ★★☆☆☆ | ★★★☆☆ |
| Learning curve | ★★★☆☆ | ★★★★★ | ★★★☆☆ | ★★★★☆ |

### Karar: LangGraph

**Neden:**
1. **Graph-based orchestration:** 19 ajanı DAG olarak modellemek doğal; koşullu dallanma, paralel çalışma, döngü (retry) native destekleniyor
2. **State management:** `TypedDict` veya Pydantic model ile shared state tanımlama → avukat oturumundaki tüm context tek yerde
3. **Human-in-the-loop:** `interrupt_before` / `interrupt_after` ile avukat onay noktaları doğal şekilde eklenir (dilekçe onayı, strateji kabulü vs.)
4. **LangSmith entegrasyonu:** Her ajan çağrısının trace'i → debugging ve maliyet takibi
5. **Checkpointing:** Uzun süren ajan akışlarında durum kaydı → kullanıcı sayfayı kapatıp geri gelse devam eder

### LangGraph Ajan Tanımlama Örneği

```python
from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated, List

class LexoraState(TypedDict):
    query: str
    intent: str
    hukuk_alani: str
    ictihat_sonuclari: List[dict]
    mevzuat_sonuclari: List[dict]
    dogrulama_raporu: dict
    dilekce_taslagi: str
    guven_skoru: float
    aktif_dava: dict
    kullanici_profili: dict

graph = StateGraph(LexoraState)

# Ajanları node olarak ekle
graph.add_node("intent_classifier", intent_classifier_agent)
graph.add_node("ictihat_search", ictihat_search_agent)
graph.add_node("mevzuat_search", mevzuat_search_agent)
graph.add_node("citation_verifier", citation_verifier_agent)
graph.add_node("dilekce_writer", dilekce_writer_agent)
graph.add_node("contradiction_checker", contradiction_checker_agent)
graph.add_node("strategy_analyzer", strategy_analyzer_agent)

# Koşullu routing
graph.add_conditional_edges(
    "intent_classifier",
    route_by_intent,  # intent'e göre farklı ajanlara yönlendir
    {
        "arastirma": "ictihat_search",
        "dilekce": "dilekce_writer",
        "strateji": "strategy_analyzer",
        "genel_soru": "ictihat_search"
    }
)

# Paralel arama
graph.add_edge("ictihat_search", "citation_verifier")
graph.add_edge("mevzuat_search", "citation_verifier")

# Human-in-the-loop: Dilekçe onayı
graph.add_node("human_review", interrupt_before=True)
graph.add_edge("dilekce_writer", "contradiction_checker")
graph.add_edge("contradiction_checker", "human_review")
```

---

## 7.3 Vector DB Seçimi

### Karşılaştırma

| Kriter | Qdrant | Weaviate | Pinecone |
|--------|--------|----------|----------|
| Self-hosted | ✓ | ✓ | ✗ (Cloud only) |
| KVKK uyumu | ★★★★★ | ★★★★★ | ★★☆☆☆ |
| Hybrid search (BM25+vector) | ✓ Native | ✓ Native | ✗ (ayrı yapılmalı) |
| Payload filtering | ★★★★★ | ★★★★☆ | ★★★☆☆ |
| Performans (1M vector) | ★★★★★ | ★★★★☆ | ★★★★☆ |
| Multi-tenancy | ★★★★★ | ★★★★☆ | ★★★☆☆ |
| Maliyet (self-hosted) | Düşük | Orta | N/A |

### Karar: Qdrant (Self-hosted)

**Neden:**
1. **KVKK:** Self-hosted → avukat verisi Türkiye'de kalır
2. **Hybrid search:** Native sparse+dense vector → Türkçe hukuk termlerinde hem semantic hem keyword arama
3. **Payload filtering:** `{"mahkeme": "yargitay_9hd", "yil": {"gte": 2023}}` filtreleri direkt vector aramayla kombine
4. **Multi-tenancy:** Collection bazlı veya payload bazlı tenant izolasyonu
5. **Performans:** 5M+ vektörde <50ms arama süresi

### Qdrant Konfigürasyonu

```yaml
# qdrant-config.yaml
storage:
  storage_path: /data/qdrant
  wal_capacity_mb: 128

collections:
  - name: ictihat_embeddings
    vector_size: 1024  # bge-m3
    distance: Cosine
    sparse_vectors:
      bm25:
        modifier: idf
    payload_schema:
      mahkeme: keyword
      daire: keyword
      yil: integer
      hukuk_alani: keyword
      karar_sonucu: keyword
      tenant_id: keyword  # multi-tenancy

  - name: mevzuat_embeddings
    vector_size: 1024
    distance: Cosine
    payload_schema:
      kanun_no: keyword
      madde_no: keyword
      yururluk_tarihi: datetime
      son_degisiklik: datetime

  - name: kullanici_belgeleri
    vector_size: 1024
    distance: Cosine
    payload_schema:
      tenant_id: keyword  # avukat bazlı izolasyon
      dava_id: keyword
      belge_turu: keyword
```

---

## 7.4 Embedding Modeli

### Benchmark: Türkçe Hukuk Metni Retrieval

| Model | NDCG@10 (Türkçe genel) | Türkçe Hukuk (tahmini) | Boyut | Hız |
|-------|------------------------|----------------------|-------|-----|
| bge-m3 | 0.72 | 0.68-0.73 | 1024d | Orta |
| multilingual-e5-large | 0.70 | 0.65-0.70 | 1024d | Hızlı |
| text-embedding-3-large | 0.73 | 0.70-0.75 | 3072d | Hızlı (API) |
| nomic-embed-text-v2-moe | 0.71 | 0.67-0.72 | 768d | Çok hızlı |

### Karar: bge-m3 (ana) + text-embedding-3-large (karşılaştırma)

**bge-m3 Avantajları:**
1. **Hybrid output:** Hem dense hem sparse (BM25-like) vektör üretir → Qdrant hybrid search ile mükemmel uyum
2. **Multi-lingual:** 100+ dil, Türkçe iyi destekleniyor
3. **Self-hosted:** KVKK uyumu → avukat verisi dışarı çıkmaz
4. **Fine-tune edilebilir:** Türkçe hukuk terminolojisi için ince ayar yapılabilir

**Fine-tuning Stratejisi (Ay 3-4'te):**
```
Eğitim verisi:
├── Pozitif çiftler: Soru → İlgili karar paragrafı (avukat validasyonlu)
├── Hard negatives: Benzer ama ilgisiz kararlar
├── Hukuk terminolojisi: Eş anlamlı terimler
│   ("haksız fesih" ≈ "geçersiz fesih", "tazminat" ≈ "ödence")
└── 10,000+ çift hedefi

Beklenen iyileşme: NDCG@10'da +5-10% artış
```

---

## 7.5 Reranking

### Model Seçimi

| Model | Türkçe Desteği | Hız | Kalite |
|-------|---------------|-----|--------|
| bge-reranker-v2-m3 | ★★★★☆ | 50ms/query | ★★★★☆ |
| mxbai-rerank-v2 | ★★★☆☆ | 30ms/query | ★★★★☆ |
| Cohere rerank-v3 | ★★★★★ | 100ms/query | ★★★★★ |
| jina-reranker-v2 | ★★★★☆ | 40ms/query | ★★★★☆ |

### Karar: bge-reranker-v2-m3 (self-hosted)

- KVKK uyumlu (self-hosted)
- bge-m3 embedding ile aynı ekosistem
- Türkçe fine-tune yapılabilir

### Türkçe Fine-tune Gerekli mi?

**Evet, Ay 4-5'te yapılmalı.** Çünkü:
- Hukuk terminolojisi genel Türkçe'den farklı: "terditli talep", "hak düşürücü süre", "ıslah", "müdahale talebi" gibi terimler genel modellerde zayıf
- Fine-tune verisi: Avukat sorgusu → ilgili karar çiftleri (500+ çift yeterli başlangıç)
- Beklenen iyileşme: Reranking kalitesinde %8-15 artış

---

## 7.6 Chunking Stratejisi

### Hukuk Metni İçin Özel Chunking

**Genel text chunking (500 token, overlap) hukuk için YETERSIZ.**

```python
class LegalChunker:
    """Hukuk metni türüne göre özelleşmiş chunking"""

    def chunk_karar(self, karar_metni: str) -> List[Chunk]:
        """Yargıtay/Danıştay kararı chunking"""
        sections = self.detect_sections(karar_metni)
        # Tipik bölümler:
        # 1. Başlık + taraflar (metadata chunk)
        # 2. Dava konusu / olaylar (fact chunk)
        # 3. İlk derece kararı (procedure chunk)
        # 4. Temyiz/istinaf nedenleri (argument chunk)
        # 5. Değerlendirme (reasoning chunk) ← EN ÖNEMLİ
        # 6. Sonuç / Hüküm (decision chunk)

        chunks = []
        for section in sections:
            if len(section.text) > 1000:  # token
                # Uzun bölümleri paragraf bazlı böl
                sub_chunks = self.split_by_paragraph(section.text, max_tokens=800, overlap=100)
                for sc in sub_chunks:
                    chunks.append(Chunk(
                        text=sc,
                        metadata={
                            "section_type": section.type,
                            "karar_id": karar_metni.id,
                            **karar_metni.metadata
                        }
                    ))
            else:
                chunks.append(Chunk(text=section.text, metadata=...))
        return chunks

    def chunk_mevzuat(self, kanun_metni: str) -> List[Chunk]:
        """Kanun/yönetmelik chunking — madde bazlı"""
        maddeler = self.split_by_article(kanun_metni)
        chunks = []
        for madde in maddeler:
            # Her madde bir chunk (genellikle 100-500 token)
            # Uzun maddeler fıkra bazlı bölünür
            if madde.token_count > 500:
                fikralar = self.split_by_fikra(madde)
                for f in fikralar:
                    chunks.append(Chunk(
                        text=f.text,
                        metadata={"kanun": madde.kanun, "madde_no": madde.no, "fikra": f.no}
                    ))
            else:
                chunks.append(Chunk(text=madde.text, metadata=...))
        return chunks

    def chunk_makale(self, makale_metni: str) -> List[Chunk]:
        """Akademik makale chunking — bölüm bazlı"""
        # Başlık, özet, giriş, bölümler, sonuç
        # Her bölüm ayrı chunk, uzun bölümler paragraf bazlı
        pass
```

### Chunk Metadata Zenginleştirme

Her chunk'a eklenen metadata:
```json
{
  "chunk_id": "yargitay_9hd_2023_1234_reasoning_p2",
  "source_type": "ictihat",
  "mahkeme": "Yargıtay 9. HD",
  "karar_no": "2023/1234 E., 2023/5678 K.",
  "tarih": "2023-05-15",
  "section_type": "reasoning",
  "hukuk_alani": ["is_hukuku", "ise_iade"],
  "anahtar_kavramlar": ["gecerli_fesih", "savunma_hakki", "son_care"],
  "kanun_referanslari": ["4857/18", "4857/19"],
  "token_count": 450
}
```

---

## 7.7 Streaming

### Dilekçe Üretiminde Streaming

```python
async def stream_dilekce(request: DilekceRequest):
    """Uzun dilekçe üretiminde bölüm bazlı streaming"""

    # 1. İlk bölümü hemen gönder (başlık, taraflar — template'ten)
    yield StreamChunk(type="header", content=generate_header(request))

    # 2. Argümanları sırayla üret ve stream et
    async for chunk in llm.stream(dilekce_prompt):
        yield StreamChunk(type="body", content=chunk)

    # 3. Sonuç ve talep bölümü
    yield StreamChunk(type="conclusion", content=generate_conclusion(request))

    # 4. Citation verification (post-stream)
    # Tüm metin tamamlandıktan sonra doğrulama çalışır
    yield StreamChunk(type="verification_start", content="Referanslar doğrulanıyor...")

    verification = await citation_verifier.verify(full_text)
    yield StreamChunk(type="verification_result", content=verification)
```

### UI Streaming UX

```
[Dilekçe oluşturuluyor...]

İSTANBUL ( ). İŞ MAHKEMESİ'NE        ← Anında görünür

Davacı: Ahmet YILMAZ                   ← Anında görünür
Vekili: Av. Mehmet ...

AÇIKLAMALAR:                            ← Streaming başlıyor

1. Müvekkilimiz davalı işyerinde█       ← Cursor tipi streaming
   [metin karakter karakter gelir]

[Referanslar doğrulanıyor... ████░░░░]  ← Son aşama
[3/4 referans doğrulandı ✓]
```

---

## 7.8 Caching Stratejisi

### Multi-Layer Cache

```
Layer 1: Client Cache (Browser)
├── Son arama sonuçları (SessionStorage)
├── Kullanıcı tercihleri (LocalStorage)
└── TTL: Session / 7 gün

Layer 2: CDN Cache (CloudFlare)
├── Statik mevzuat metinleri
├── Sık erişilen kanun maddeleri
└── TTL: 24 saat

Layer 3: Application Cache (Redis)
├── Citation verification sonuçları → TTL: 24 saat
├── Mevzuat madde metinleri → TTL: 6 saat (Resmi Gazete güncellemesi)
├── Sık sorulan sorgu sonuçları → TTL: 1 saat
├── LLM response cache (aynı sorgu + aynı context) → TTL: 4 saat
├── User session state → TTL: 8 saat
└── Embedding cache (sık embed edilen metinler) → TTL: 7 gün

Layer 4: Persistent Cache (PostgreSQL)
├── Tüm doğrulanmış içtihat metadata → kalıcı
├── Mevzuat değişiklik geçmişi → kalıcı
└── Kullanıcı araştırma geçmişi → 1 yıl
```

### Cache Invalidation

| Olay | Etkilenen Cache | Aksiyon |
|------|----------------|---------|
| Resmi Gazete yayını | Mevzuat cache | Invalidate + yeniden fetch |
| Yeni Yargıtay kararı | İçtihat cache | Ekleme (mevcut invalidate edilmez) |
| Kullanıcı feedback | LLM response cache | Invalidate (yanlış cevap düzeltildi) |

---

## 7.9 Multi-Tenancy

### Veri İzolasyonu Mimarisi

```
┌─────────────────────────────────────────────┐
│ Shared Resources (Tüm kullanıcılar)         │
│ ├── İçtihat veritabanı (read-only)           │
│ ├── Mevzuat veritabanı (read-only)           │
│ ├── LLM API (shared, rate-limited)           │
│ └── Şablon kütüphanesi                       │
├─────────────────────────────────────────────┤
│ Tenant-Isolated Resources (Avukat bazlı)     │
│ ├── Dava dosyaları                           │
│ ├── Yüklenen belgeler                        │
│ ├── Dilekçe taslakları                       │
│ ├── Araştırma geçmişi                        │
│ ├── Müvekkil bilgileri                       │
│ ├── UYAP senkronizasyon verisi               │
│ └── Tercihler ve stil profili                │
└─────────────────────────────────────────────┘
```

### Implementasyon

```
1. Database: Row-Level Security (PostgreSQL RLS)
   CREATE POLICY tenant_isolation ON cases
   USING (tenant_id = current_setting('app.current_tenant'));

2. Vector DB: Qdrant payload filter
   filter={"must": [{"key": "tenant_id", "match": {"value": "avukat_123"}}]}

3. Object Storage: Bucket per tenant (MinIO/S3)
   s3://lexora-documents/tenant_123/dava_456/belgeler/

4. Cache: Redis key prefix
   tenant:123:cache:query_hash

5. LLM: Context isolation
   Her LLM çağrısında sadece ilgili tenant'ın verisi context'e eklenir
```

---

## 7.10 Auth ve Baro Doğrulaması

### Baro Numarası Doğrulaması

**Mevcut durum:** Türkiye Barolar Birliği (TBB) resmi avukat sicil sorgulaması web üzerinden mümkün (barobirlik.org.tr). API doğrudan mevcut değil, ancak:

```
Doğrulama Akışı:
1. Avukat kayıt olurken baro sicil numarası ve TC kimlik girer
2. Sistem TBB avukat sorgulaması ile doğrular
   (web scraping veya manual verification ilk aşamada)
3. e-posta doğrulaması (@barosu.org.tr uzantılı e-posta varsa)
4. Baro ile partnership oluşturuldukça → baro API entegrasyonu

Alternatif Doğrulama:
├── e-imza ile giriş (avukat e-imzası TC doğrulama içerir)
├── Baro kart fotoğrafı yükleme + manual review
└── TBB ile resmi protokol (uzun vadeli)
```

### Auth Stack

```
├── NextAuth.js / Auth.js (framework)
├── JWT + Refresh token
├── 2FA: TOTP (Google Authenticator) + SMS fallback
├── Session: Redis-backed, 8 saat timeout
├── Role-based access:
│   ├── solo_avukat: Tek kullanıcı
│   ├── buro_admin: Büro yöneticisi
│   ├── buro_member: Büro çalışanı (sınırlı erişim)
│   └── stajyer: Salt okuma + draft (onay gerektirir)
└── KVKK: Rıza yönetimi, veri silme endpoint'i, veri taşınabilirlik
```

---

## 7.11 Tam Altyapı Mimarisi

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                             │
│  Next.js 15 (App Router) + React + TailwindCSS              │
│  Vercel (hosting) veya self-hosted Docker                    │
├─────────────────────────────────────────────────────────────┤
│                         API GATEWAY                          │
│  FastAPI (Python) + nginx reverse proxy                      │
│  Rate limiting, auth middleware, request logging             │
├─────────────────────────────────────────────────────────────┤
│                      AJAN KATMANI                            │
│  LangGraph + LangSmith (observability)                       │
│  19 ajan, event-driven orchestration                         │
├──────────┬──────────┬──────────┬───────────┬────────────────┤
│ Claude   │ Qdrant   │ Postgres │ Redis     │ MinIO (S3)     │
│ API      │ (Vector) │ (RDBMS)  │ (Cache)   │ (Object Store) │
│          │          │          │ (State)   │ (Documents)    │
├──────────┴──────────┴──────────┴───────────┴────────────────┤
│                      DATA PIPELINE                           │
│  yargi-mcp │ mevzuat-mcp │ DergiPark │ Resmi Gazete         │
│  Scheduled ingestion (Apache Airflow)                        │
├─────────────────────────────────────────────────────────────┤
│                      INFRASTRUCTURE                          │
│  Docker Compose (dev) → Kubernetes (prod)                    │
│  Monitoring: Grafana + Prometheus                            │
│  Logging: ELK Stack (Elasticsearch + Logstash + Kibana)      │
│  CI/CD: GitHub Actions                                       │
│  Hosting: Hetzner Cloud (DE/FI) veya Türk cloud (KVKK)      │
└─────────────────────────────────────────────────────────────┘
```

### Hosting — KVKK Açısından

| Seçenek | KVKK Uyumu | Maliyet | Performans |
|---------|-----------|---------|------------|
| Hetzner (Almanya/Finlandiya) | ✓ (EU — yeterli koruma) | Düşük ($200-500/ay) | Çok iyi |
| Türk Cloud (Turkcell, Türk Telekom) | ✓ (TR — tam uyum) | Yüksek ($500-1500/ay) | İyi |
| AWS Frankfurt | ✓ (EU) | Orta-Yüksek | Çok iyi |
| Self-hosted (colocation TR) | ✓ (tam kontrol) | Yüksek (başlangıç) | Değişken |

**Öneri:** Başlangıçta Hetzner (EU), büyüdükçe Türk cloud'a migration planı. KVKK VERBİS kaydı ilk günden yapılmalı.
