# Lexora Optimizasyon Yol Haritası — Celery Worker Mimarisi

## Mevcut Durum ve Sorun

```
Şu anki mimari:

┌─────────────────────────────────────────────┐
│           FastAPI Process (1 worker)         │
│                                             │
│  ┌─── HTTP İstekleri ───┐                   │
│  │ GET /search/ictihat  │                   │
│  │ GET /dashboard       │  ← BLOKLANIYORLAR │
│  │ POST /auth/login     │                   │
│  └──────────────────────┘                   │
│                                             │
│  ┌─── Ingestion (aynı process!) ─────────┐  │
│  │ Bedesten'den karar çek (3s/karar)     │  │
│  │ bge-m3 embedding üret (CPU %300+)     │  │
│  │ Qdrant'a yaz                          │  │
│  │ ← SİTE DONUYOR ÇÜNKÜ AYNI PROCESS    │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  RAM: bge-m3 modeli ~1.3GB + FastAPI ~200MB │
│  CPU: embedding sırasında %300-400          │
└─────────────────────────────────────────────┘
```

### Sorunlar
1. Embedding üretimi CPU'yu %300+ kullanıyor → HTTP istekleri yanıt veremiyor → site donuyor
2. Model her worker'da ayrı yükleniyor → 2 worker = 2.6GB sadece model
3. Dokümanlar sırayla tek tek çekiliyor → 10 karar = 30 saniye bekleme
4. Task iptali yok, retry yok, monitoring yok
5. Günlük scheduler (03:00) aynı process'te çalışıyor → saatlerce site yavaş

---

## Hedef Mimari

```
┌──────────────────────┐     ┌──────────────────────────────────┐
│   FastAPI (2 worker)  │     │     Celery Worker (1 process)     │
│                      │     │                                  │
│  HTTP istekleri:     │     │  Ağır işler:                     │
│  - Arama             │     │  - Embedding üretimi (bge-m3)    │
│  - Login             │     │  - Bedesten'den karar çekme      │
│  - Dashboard         │     │  - AYM scraping                  │
│  - Admin panel       │     │  - AİHM HUDOC API                │
│                      │     │  - Qdrant'a yazma                │
│  Hafif, hızlı,       │     │  - Günlük otomatik güncelleme    │
│  hiç donmaz          │     │                                  │
│                      │     │  RAM: bge-m3 ~1.3GB (tek kopya)  │
│  RAM: ~300MB         │     │  CPU: istediği kadar kullanabilir│
│  CPU: düşük          │     │                                  │
└──────────┬───────────┘     └──────────────┬───────────────────┘
           │                                │
           │  task gönder / sonuç al        │
           │                                │
      ┌────▼────────────────────────────────▼────┐
      │              Redis (Broker + Backend)      │
      │                                            │
      │  - Task queue (ingestion görevleri)         │
      │  - Result backend (görev sonuçları)         │
      │  - Cache (mevcut arama/doküman cache)       │
      │  - Pub/Sub (SSE için canlı bildirimler)     │
      └────────────────────────────────────────────┘
                          │
      ┌───────────────────▼───────────────────────┐
      │              Qdrant (Vector DB)            │
      │                                            │
      │  ictihat_embeddings (1024d bge-m3)         │
      │  mevzuat_embeddings (1024d bge-m3)         │
      └────────────────────────────────────────────┘
```

---

## Docker Compose Yapısı

```yaml
# docker-compose.prod.yml — hedef yapı

services:
  frontend:
    # ... mevcut (değişmez)

  backend:
    # FastAPI — sadece HTTP
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
    deploy:
      resources:
        limits:
          memory: 1G    # Artık model yüklemek zorunda değil
    environment:
      - CELERY_BROKER_URL=redis://redis:6379/1
      - CELERY_RESULT_BACKEND=redis://redis:6379/2

  worker:
    # Celery Worker — ağır işler
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: celery -A app.worker worker --loglevel=info --concurrency=1 --pool=solo
    deploy:
      resources:
        limits:
          memory: 3G    # bge-m3 modeli burada
    environment:
      - CELERY_BROKER_URL=redis://redis:6379/1
      - CELERY_RESULT_BACKEND=redis://redis:6379/2
    depends_on:
      - redis
      - qdrant
      - postgres
    volumes:
      - ingestion_data:/app/data
    restart: always

  beat:
    # Celery Beat — zamanlanmış görevler (03:00 günlük ingestion)
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: celery -A app.worker beat --loglevel=info
    deploy:
      resources:
        limits:
          memory: 128M
    depends_on:
      - redis
    restart: always

  redis:
    # ... mevcut ama maxmemory artırılacak
    command: redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru

  qdrant:
    # ... mevcut ama memory artırılacak
    deploy:
      resources:
        limits:
          memory: 1.5G

  postgres:
    # ... mevcut (değişmez)
```

### RAM Dağılımı (7.6GB sunucu)

```
Servis            Şu an    Hedef     Açıklama
─────────────────────────────────────────────────
FastAPI backend   4GB  →   1GB       Model yok, sadece HTTP
Celery worker     yok  →   3GB       bge-m3 + ingestion
Celery beat       yok  →   128MB     Sadece scheduler
Qdrant            1GB  →   1.5GB     Daha hızlı arama
Redis             256MB →  512MB     Task queue + cache
Postgres          yok  →   512MB     Mevcut
Frontend          512MB →  512MB     Mevcut
─────────────────────────────────────────────────
Toplam                     7.2GB     (400MB boş)
Vesper                     Ayrı sunucuya taşınmalı veya
                           worker kapatılınca RAM serbest
```

---

## Dosya Yapısı

```
backend/
├── app/
│   ├── main.py                    # FastAPI — değişir (scheduler kaldırılır)
│   ├── worker.py                  # YENİ — Celery app tanımı
│   ├── tasks/                     # YENİ — Celery task'ları
│   │   ├── __init__.py
│   │   ├── ingestion_tasks.py     # ingest_topics, ingest_aym, ingest_aihm
│   │   ├── embedding_tasks.py     # embed_and_upsert
│   │   └── scheduled_tasks.py     # daily_incremental, cleanup
│   ├── ingestion/
│   │   ├── ingest.py              # Değişir — task queue'ya görev gönderir
│   │   ├── incremental.py         # Değişir — Celery task olarak çalışır
│   │   ├── chunker.py             # Değişmez
│   │   └── html_cleaner.py        # Değişmez
│   ├── services/
│   │   ├── embedding.py           # Değişir — sadece worker'da yüklenir
│   │   ├── vector_store.py        # Değişmez
│   │   ├── yargi.py               # Değişmez
│   │   ├── aym.py                 # Değişmez
│   │   ├── hudoc.py               # Değişmez
│   │   └── cache.py               # Değişmez
│   ├── api/
│   │   └── routes/
│   │       ├── admin.py           # Değişir — task.delay() ile görev gönderir
│   │       ├── ingest.py          # Değişir — task.delay() ile görev gönderir
│   │       └── search.py          # Değişir — embedding query worker'a gider
│   └── config.py                  # Değişir — Celery config eklenir
├── requirements.txt               # Değişir — celery eklenir
└── Dockerfile                     # Değişmez (aynı image, farklı command)
```

---

## Detaylı Uygulama Planı

### Adım 1: Celery App Oluşturma

**Yeni dosya: `backend/app/worker.py`**

```python
from celery import Celery
from celery.schedules import crontab
from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "lexora",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Europe/Istanbul",
    enable_utc=True,
    task_track_started=True,          # Task başladığında state güncelle
    task_time_limit=7200,             # Max 2 saat per task
    task_soft_time_limit=6000,        # 100 dk'da warning
    worker_max_tasks_per_child=50,    # Memory leak önleme
    worker_prefetch_multiplier=1,     # Bir seferde 1 task al
    task_acks_late=True,              # Task bitince ACK (crash recovery)
    task_reject_on_worker_lost=True,  # Worker ölürse task'ı tekrar kuyruğa koy
)

# Zamanlanmış görevler (APScheduler'ın yerini alır)
celery_app.conf.beat_schedule = {
    "daily-incremental-ingestion": {
        "task": "app.tasks.scheduled_tasks.daily_incremental",
        "schedule": crontab(hour=3, minute=0),  # Her gün 03:00 Istanbul
    },
    "weekly-full-ingestion": {
        "task": "app.tasks.scheduled_tasks.weekly_full_ingestion",
        "schedule": crontab(hour=4, minute=0, day_of_week=0),  # Pazar 04:00
    },
}

# Task modüllerini otomatik keşfet
celery_app.autodiscover_tasks(["app.tasks"])
```

### Adım 2: Ingestion Task'ları

**Yeni dosya: `backend/app/tasks/ingestion_tasks.py`**

```python
from app.worker import celery_app
from celery import current_task

@celery_app.task(bind=True, name="app.tasks.ingest_topics")
def ingest_topics_task(self, topics: list[str], pages_per_topic: int = 3):
    """Bedesten'den içtihat çekme — Celery task olarak."""
    import asyncio

    async def run():
        from app.services.yargi import YargiService
        from app.services.vector_store import VectorStoreService
        from app.services.embedding import EmbeddingService
        from app.services.cache import CacheService
        from app.ingestion.ingest import IngestionPipeline

        cache = CacheService()
        yargi = YargiService(cache=cache)
        vector_store = VectorStoreService()
        embedding = EmbeddingService()
        pipeline = IngestionPipeline(yargi, vector_store, embedding)

        # Task state'ini güncelle (admin panelden izlenebilir)
        self.update_state(state="PROGRESS", meta={
            "source": "bedesten",
            "total_topics": len(topics),
            "completed": 0,
        })

        result = await pipeline.ingest_topics(
            topics=topics,
            pages_per_topic=pages_per_topic,
        )

        await yargi.close()
        await vector_store.close()
        return result

    return asyncio.run(run())


@celery_app.task(bind=True, name="app.tasks.ingest_aym")
def ingest_aym_task(self, pages: int = 10):
    """AYM kararları çekme."""
    import asyncio

    async def run():
        # ... benzer setup
        pipeline = ...
        self.update_state(state="PROGRESS", meta={"source": "aym"})
        return await pipeline.ingest_aym(pages=pages)

    return asyncio.run(run())


@celery_app.task(bind=True, name="app.tasks.ingest_aihm")
def ingest_aihm_task(self, max_results: int = 500):
    """AİHM kararları çekme."""
    import asyncio

    async def run():
        # ... benzer setup
        pipeline = ...
        self.update_state(state="PROGRESS", meta={"source": "aihm"})
        return await pipeline.ingest_aihm(max_results=max_results)

    return asyncio.run(run())
```

### Adım 3: Admin Endpoint'lerini Güncelleme

**Değişen: `backend/app/api/routes/admin.py`**

```python
# Eski (şu anki):
@router.post("/ingest")
async def trigger_ingest(admin):
    asyncio.create_task(pipeline.ingest_topics(...))  # ← aynı process'te!
    return {"status": "started"}

# Yeni (Celery ile):
from app.tasks.ingestion_tasks import ingest_topics_task

@router.post("/ingest")
async def trigger_ingest(admin):
    task = ingest_topics_task.delay(topics=DEFAULT_TOPICS, pages_per_topic=3)
    return {"status": "started", "task_id": task.id}  # ← ayrı process'te!

@router.get("/ingest/status/{task_id}")
async def ingest_status(task_id: str, admin):
    from app.worker import celery_app
    result = celery_app.AsyncResult(task_id)
    return {
        "task_id": task_id,
        "status": result.status,      # PENDING, STARTED, PROGRESS, SUCCESS, FAILURE
        "progress": result.info,       # {"source": "bedesten", "completed": 5, ...}
    }

@router.post("/ingest/cancel/{task_id}")
async def cancel_ingest(task_id: str, admin):
    from app.worker import celery_app
    celery_app.control.revoke(task_id, terminate=True)
    return {"status": "cancelled"}
```

### Adım 4: Paralel Doküman Çekme

**Değişen: `backend/app/ingestion/ingest.py`**

```python
# Eski (sıralı, yavaş):
for item in items:
    doc = await self.yargi.get_document(doc_id)  # 1 karar
    await asyncio.sleep(3.0)                      # 3 saniye bekle
    # Sonraki karar...
# 10 karar = 30+ saniye

# Yeni (paralel, hızlı):
semaphore = asyncio.Semaphore(5)  # Max 5 eşzamanlı istek

async def fetch_one(item):
    async with semaphore:
        doc_id = item.get("documentId", "")
        if not doc_id:
            return None
        try:
            doc = await self.yargi.get_document(doc_id)
            await asyncio.sleep(0.5)  # Hafif rate limit
            return (item, doc)
        except Exception:
            return None

results = await asyncio.gather(*[fetch_one(item) for item in items])
# 10 karar = ~3-4 saniye (5 paralel × 0.5s)
```

### Adım 5: SSE → Redis Pub/Sub

**Değişen: Admin SSE endpoint**

```python
# Eski: _ingest_state in-memory dict (sadece aynı process'te çalışır)
# Yeni: Redis Pub/Sub ile worker → backend → frontend

# Worker'da (task çalışırken):
import redis
r = redis.Redis()
r.publish("ingestion_events", json.dumps({
    "source": "aym",
    "task": "Sayfa 3/10",
    "fetched": 30,
    "embedded": 95,
}))

# Backend'de (SSE endpoint):
@router.get("/ingest/stream")
async def ingest_stream():
    async def event_generator():
        pubsub = redis_client.pubsub()
        await pubsub.subscribe("ingestion_events")
        async for message in pubsub.listen():
            if message["type"] == "message":
                yield f"data: {message['data']}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

### Adım 6: Config Güncellemesi

**Değişen: `backend/app/config.py`**

```python
class Settings(BaseSettings):
    # ... mevcut ayarlar

    # Celery
    celery_broker_url: str = "redis://redis:6379/1"
    celery_result_backend: str = "redis://redis:6379/2"

    # Ingestion tuning
    ingestion_batch_size: int = 8           # Embedding batch
    ingestion_concurrent_fetches: int = 5   # Paralel doküman çekme
    ingestion_rate_limit: float = 0.5       # Saniye/istek (rate limit)
    ingestion_page_delay: float = 2.0       # Sayfa arası bekleme
```

### Adım 7: Requirements Güncellemesi

**Değişen: `backend/requirements.txt`**

```
# Task Queue
celery[redis]>=5.3.0
```

APScheduler kaldırılır — Celery Beat aynı işi yapıyor.

---

## Uygulama Sırası

```
Faz 1 (2-3 saat): Celery altyapısı
  ├── worker.py oluştur
  ├── tasks/ klasörü oluştur
  ├── config.py'ye Celery ayarları ekle
  ├── requirements.txt güncelle
  └── docker-compose.prod.yml'e worker + beat ekle

Faz 2 (2-3 saat): Task'ları taşı
  ├── ingestion_tasks.py — mevcut pipeline'ı Celery task'a sar
  ├── admin.py — asyncio.create_task → task.delay()
  ├── ingest.py routes — background_tasks → task.delay()
  └── scheduler.py kaldır — Celery Beat kullan

Faz 3 (2-3 saat): Paralel fetch + SSE
  ├── ingest.py — sıralı fetch → asyncio.gather + semaphore
  ├── SSE endpoint — in-memory state → Redis Pub/Sub
  └── Admin panel — task_id ile durum sorgulama

Faz 4 (1-2 saat): Test ve deploy
  ├── Lokal test (docker-compose up)
  ├── CI/CD güncelle (worker build + deploy)
  ├── Sunucu deploy
  └── RAM/CPU monitoring
```

---

## Beklenen İyileşmeler

```
Metrik                    Şu an           Hedef
──────────────────────────────────────────────────
Site yanıt süresi        10s+ (donuyor)   <200ms (her zaman)
Ingestion hızı           3-5 karar/dk     15-20 karar/dk
RAM (backend)            3.3GB            ~300MB
RAM (worker)             —                ~1.5GB
CPU etkisi (site)        %300+ spike      %0 (ayrı process)
Task iptali              yok              var (tek tıkla)
Task retry               yok              otomatik (3 deneme)
Monitoring               in-memory log    Redis + Celery dashboard
Zamanlama                APScheduler      Celery Beat (daha güvenilir)
Paralel fetch            1 karar/3s       5 karar/3s
Toplam ingestion süresi  ~6 saat          ~2 saat
```

---

## Notlar

- Aynı Dockerfile kullanılır, sadece `command` farklı (uvicorn vs celery)
- Redis zaten var, ek altyapı gerekmez
- Celery Flower (monitoring dashboard) opsiyonel eklenebilir: `celery -A app.worker flower`
- Worker crash olursa task otomatik tekrar kuyruğa girer (`task_acks_late=True`)
- `worker_max_tasks_per_child=50` ile bellek sızıntısı önlenir
- Vesper'ı ayrı sunucuya taşımak RAM'i rahatlatır ama zorunlu değil
