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

    # 4. Exhaustive flag + Celery active tasks
    ex_on = False
    celery_tasks = []
    try:
        import redis
        rd = redis.from_url(REDIS_URL)
        ex_on = rd.get("ingestion:exhaustive_running") == b"1"
        # Celery active task'ları kontrol et (unacked = çalışan task'lar)
        for key in rd.scan_iter("celery-task-meta-*"):
            try:
                meta = json.loads(rd.get(key) or b"{}")
                if meta.get("status") in ("STARTED", "PROGRESS"):
                    task_name = meta.get("task_name", meta.get("name", ""))
                    celery_tasks.append({
                        "name": task_name,
                        "status": meta.get("status"),
                        "result": meta.get("result", {}),
                    })
            except Exception:
                pass
    except Exception:
        pass

    # Celery worker'dan aktif task kontrolü (daha güvenilir)
    celery_active = []
    try:
        from celery import Celery
        app = Celery(broker="redis://lexora-redis-1:6379/1")
        inspect = app.control.inspect(timeout=3)
        active = inspect.active() or {}
        for worker_name, tasks in active.items():
            for t in tasks:
                celery_active.append({
                    "name": t.get("name", "?"),
                    "id": t.get("id", ""),
                    "args": t.get("args", []),
                })
    except Exception:
        pass

    any_ingestion_active = ex_on or bool(celery_active)

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

    if ex_on and active_list:
        a_key, a_val = active_list[0]
        name = a_key.replace("yargitay:", "Yargitay ").replace("danistay:", "Danistay ")
        # Daire ismi
        daire_names = {
            "2": "Ceza/Hukuk", "4": "Ceza/Hukuk", "9": "Hukuk (Is)", "12": "Hukuk (Icra)",
            "HGK": "Hukuk Genel Kurulu",
        }
        d_id = a_key.split(":")[1] if ":" in a_key else ""
        d_label = daire_names.get(d_id, "")
        if d_label:
            name = f"{name}. {d_label} Dairesi"

        pg = a_val.get("last_page", 0)
        emb = a_val.get("embedded", 0)
        api = a_val.get("api_total", 0)
        mx = api // 10 if api else 0
        pct = (pg / mx * 100) if mx > 0 else 0
        eta_h = ((mx - pg) * 8) / 3600 if mx > pg else 0

        bar_full = int(pct / 10)
        bar = "=" * bar_full + "-" * (10 - bar_full)

        L.append("CEKIM DURUMU: AKTIF")
        L.append(f"  Daire: {name}")
        L.append(f"  [{bar}] %{pct:.1f}")
        L.append(f"  Sayfa: {pg:,} / {mx:,}")
        L.append(f"  Uretilen: {emb:,} embedding")
        if eta_h > 0:
            if eta_h < 1:
                L.append(f"  Kalan: ~{eta_h * 60:.0f} dk")
            elif eta_h < 24:
                L.append(f"  Kalan: ~{eta_h:.0f} saat")
            else:
                L.append(f"  Kalan: ~{eta_h / 24:.1f} gun")
    elif ex_on:
        L.append("CEKIM DURUMU: AKTIF (basliyor...)")
    elif celery_active:
        # Exhaustive değil ama Celery'de çalışan ingestion task'ları var
        TASK_LABELS = {
            "ingest_aihm": "AiHM", "ingest_aym": "AYM",
            "ingest_rekabet": "Rekabet", "ingest_kvkk": "KVKK",
            "ingest_mevzuat": "Mevzuat", "ingest_topics": "Ictihat",
            "ingest_daire": "Daire", "ingest_batch": "Toplu",
        }
        task_names = []
        for t in celery_active:
            tname = t["name"].split(".")[-1] if t["name"] else "?"
            label = "?"
            for key, val in TASK_LABELS.items():
                if key in tname:
                    label = val
                    break
            task_names.append(label)
        L.append(f"CEKIM DURUMU: AKTIF ({', '.join(task_names)})")
    else:
        L.append("CEKIM DURUMU: Pasif")

    L.append("")
    done_n = len(done_list)
    active_n = len(active_list)
    pending = total_daire - done_n - active_n
    L.append(f"DAIRE ILERLEME: {done_n} tamam / {active_n} aktif / {pending} bekliyor ({total_daire} toplam)")

    if done_list:
        L.append("  Biten:")
        for k, v in done_list:
            name = k.replace("yargitay:", "Y:").replace("danistay:", "D:")
            L.append(f"    {name} — {v.get('embedded', 0):,}")

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
