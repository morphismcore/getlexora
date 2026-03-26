"""Telegram embedding raporu — cron ile çalıştırılır."""
import httpx
import json
import subprocess
import sys
from collections import Counter
from datetime import datetime

BOT_TOKEN = "8795172808:AAGUevWMBVTW2vEy5-4RJ7czBW5AGNxZRgY"
CHAT_ID = "5547858506"
QDRANT = "http://lexora-qdrant-1:6333"
GPU_URL = "http://172.17.0.1:9090"
REDIS_URL = "redis://lexora-redis-1:6379/0"

LABEL = {
    "yargitay": "Yargitay", "danistay": "Danistay",
    "aym": "AYM", "aihm": "AiHM",
    "rekabet": "Rekabet", "kvkk": "KVKK",
}


def main():
    # 1. Qdrant sayilar
    try:
        ic = httpx.get(f"{QDRANT}/collections/ictihat_embeddings", timeout=10).json()["result"]
        mv = httpx.get(f"{QDRANT}/collections/mevzuat_embeddings", timeout=10).json()["result"]
    except Exception as e:
        send(f"Qdrant baglanti hatasi: {e}")
        return

    ic_t = ic["points_count"]
    mv_t = mv["points_count"]

    # 2. Mahkeme dagilimi (tam sayim)
    mah = Counter()
    offset = None
    while True:
        body = {"limit": 100, "with_payload": ["mahkeme"]}
        if offset:
            body["offset"] = offset
        r = httpx.post(f"{QDRANT}/collections/ictihat_embeddings/points/scroll", json=body, timeout=10)
        d = r.json()["result"]
        pts = d.get("points", [])
        if not pts:
            break
        for p in pts:
            mah[p.get("payload", {}).get("mahkeme", "?")] += 1
        offset = d.get("next_page_offset")
        if not offset:
            break

    # 3. Checkpoint
    try:
        cp = json.load(open("/app/data/ingestion_checkpoint.json"))
        ex = cp.get("exhaustive", {})
    except Exception:
        ex = {}

    done_list = [(k, v) for k, v in ex.items() if v.get("done")]
    active_list = [(k, v) for k, v in ex.items() if not v.get("done") and v.get("last_page", 0) > 0]

    # 4. Check active tasks via backend API
    celery_active = []
    any_ingestion_active = False
    try:
        r = httpx.get("http://lexora-backend-1:8000/api/v1/admin/ingest/active", timeout=5)
        if r.status_code == 200:
            data = r.json()
            any_ingestion_active = data.get("running", False)
            celery_active = data.get("tasks", [])
        elif r.status_code == 401:
            # Fallback: try Redis exhaustive flag
            import redis
            rd = redis.from_url(REDIS_URL)
            any_ingestion_active = rd.get("ingestion:exhaustive_running") == b"1"
    except Exception:
        # Fallback: try Redis
        try:
            import redis
            rd = redis.from_url(REDIS_URL)
            any_ingestion_active = rd.get("ingestion:exhaustive_running") == b"1"
        except Exception:
            pass

    # 5. GPU
    gpu_ok = False
    gpu_name = ""
    try:
        g = httpx.get(f"{GPU_URL}/health", timeout=5).json()
        gpu_ok = True
        gpu_name = g.get("gpu", "?")
    except Exception:
        pass

    # 6. Toplam daire sayisi
    try:
        from app.services.yargi import YARGITAY_HUKUK_DAIRELERI, YARGITAY_CEZA_DAIRELERI, DANISTAY_DAIRELERI
        total_daire = len(YARGITAY_HUKUK_DAIRELERI) + len(YARGITAY_CEZA_DAIRELERI) + len(DANISTAY_DAIRELERI)
    except Exception:
        total_daire = 47

    # 7. Disk
    try:
        dk = subprocess.check_output(["df", "-h", "/"]).decode().split("\n")[1].split()
        disk = f"{dk[2]}/{dk[1]} ({dk[4]})"
    except Exception:
        disk = "?"

    # Mesaj olustur
    ts = datetime.now().strftime("%d.%m.%Y %H:%M")
    L = []
    L.append(f"LEXORA VERI RAPORU — {ts}")
    L.append("")
    L.append(f"TOPLAM: {ic_t + mv_t:,}")
    L.append(f"  Ictihat: {ic_t:,}")
    L.append(f"  Mevzuat: {mv_t:,}")
    L.append("")

    L.append("DAGILIM:")
    for m, c in mah.most_common():
        L.append(f"  {LABEL.get(m, m)}: {c:,}")
    L.append("")

    if any_ingestion_active and celery_active:
        L.append(f"CEKIM DURUMU: AKTIF ({len(celery_active)} task)")
        for t in celery_active:
            L.append(f"  - {t.get('desc', t.get('name', '?'))}")
    elif any_ingestion_active:
        L.append("CEKIM DURUMU: AKTIF")
    else:
        L.append("CEKIM DURUMU: Pasif")

    L.append("")
    gpu_str = f"Aktif ({gpu_name})" if gpu_ok else "Kapali"
    L.append(f"GPU: {gpu_str} | Qdrant: {ic['status']} | Disk: {disk}")

    msg = "\n".join(L)
    send(msg)


def send(text):
    try:
        httpx.post(
            f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
            data={"chat_id": CHAT_ID, "text": text},
            timeout=10,
        )
    except Exception:
        pass


if __name__ == "__main__":
    main()
