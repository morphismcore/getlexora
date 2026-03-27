# LEGACY: Qdrant/embedding-based Telegram raporu. PostgreSQL-first mimaride kullanılmaz.
"""LEGACY — Telegram PostgreSQL raporu — cron ile calistirilir. Qdrant bağımlıdır."""
import os
import subprocess
import sys
from collections import Counter
from datetime import datetime

import httpx

# --- Config ---
BOT_TOKEN = "8795172808:AAGUevWMBVTW2vEy5-4RJ7czBW5AGNxZRgY"
CHAT_ID = "5547858506"
GPU_URL = "http://172.17.0.1:9090"
REDIS_URL = "redis://lexora-redis-1:6379/0"
PG_DSN = os.environ.get(
    "DATABASE_URL",
    "postgresql://lexora:lexora@lexora-postgres-1:5432/lexora",
)

LABEL = {
    "yargitay": "Yargitay",
    "danistay": "Danistay",
    "aym": "AYM",
    "aihm": "AiHM",
    "rekabet": "Rekabet",
    "kvkk": "KVKK",
}


def pg_query(dsn, sql):
    """Run a read-only query via SQLAlchemy (sync) and return rows."""
    from sqlalchemy import create_engine, text
    # Convert async DSN to sync if needed
    sync_dsn = dsn.replace("postgresql+asyncpg://", "postgresql://")
    engine = create_engine(sync_dsn, pool_pre_ping=True)
    with engine.connect() as conn:
        result = conn.execute(text(sql))
        return result.fetchall()


def main():
    # ── 1. Toplam karar sayisi ──
    try:
        rows = pg_query(PG_DSN, "SELECT COUNT(*) FROM decisions;")
        total_decisions = rows[0][0]
    except Exception as e:
        send(f"PG baglanti hatasi: {e}")
        return

    # ── 2. Mahkeme dagilimi ──
    mah_rows = pg_query(PG_DSN, """
        SELECT mahkeme, COUNT(*) AS cnt
        FROM decisions
        GROUP BY mahkeme
        ORDER BY cnt DESC;
    """)

    # ── 3. Kaynak dagilimi ──
    kaynak_rows = pg_query(PG_DSN, """
        SELECT kaynak, COUNT(*) AS cnt
        FROM decisions
        GROUP BY kaynak
        ORDER BY cnt DESC;
    """)

    # ── 4. Embedding durumu ──
    emb_rows = pg_query(PG_DSN, """
        SELECT is_embedded, COUNT(*) AS cnt
        FROM decisions
        GROUP BY is_embedded;
    """)
    embedded = 0
    not_embedded = 0
    for row in emb_rows:
        if row[0]:
            embedded = row[1]
        else:
            not_embedded = row[1]

    # ── 5. Ingestion log ozeti ──
    log_rows = pg_query(PG_DSN, """
        SELECT status, COUNT(*) AS cnt
        FROM ingestion_logs
        GROUP BY status
        ORDER BY cnt DESC;
    """)

    # ── 6. Daire ilerlemesi (top 15) ──
    daire_rows = pg_query(PG_DSN, """
        SELECT daire, COUNT(*) AS cnt
        FROM decisions
        WHERE daire IS NOT NULL AND daire != ''
        GROUP BY daire
        ORDER BY cnt DESC
        LIMIT 15;
    """)

    # ── 7. Son 1 saat aktivite ──
    recent_rows = pg_query(PG_DSN, """
        SELECT COUNT(*) FROM decisions
        WHERE created_at > NOW() - INTERVAL '1 hour';
    """)
    recent_count = recent_rows[0][0] if recent_rows else 0

    # ── 8. Active task via backend API ──
    celery_active = []
    any_ingestion_active = False
    try:
        r = httpx.get("http://lexora-backend-1:8000/api/v1/admin/ingest/active", timeout=5)
        if r.status_code == 200:
            data = r.json()
            any_ingestion_active = data.get("running", False)
            celery_active = data.get("tasks", [])
        elif r.status_code == 401:
            import redis as _redis
            rd = _redis.from_url(REDIS_URL)
            any_ingestion_active = rd.get("ingestion:exhaustive_running") == b"1"
    except Exception:
        try:
            import redis as _redis
            rd = _redis.from_url(REDIS_URL)
            any_ingestion_active = rd.get("ingestion:exhaustive_running") == b"1"
        except Exception:
            pass

    # ── 9. GPU ──
    gpu_ok = False
    gpu_name = ""
    try:
        g = httpx.get(f"{GPU_URL}/health", timeout=5).json()
        gpu_ok = True
        gpu_name = g.get("gpu", "?")
    except Exception:
        pass

    # ── 10. Disk ──
    try:
        dk = subprocess.check_output(["df", "-h", "/"]).decode().split("\n")[1].split()
        disk = f"{dk[2]}/{dk[1]} ({dk[4]})"
    except Exception:
        disk = "?"

    # ── Mesaj ──
    ts = datetime.now().strftime("%d.%m.%Y %H:%M")
    L = []
    L.append(f"LEXORA PG RAPORU - {ts}")
    L.append("")

    L.append(f"TOPLAM KARAR: {total_decisions:,}")
    L.append(f"  Embedded: {embedded:,}")
    L.append(f"  Bekleyen: {not_embedded:,}")
    L.append(f"  Son 1 saat: +{recent_count:,}")
    L.append("")

    L.append("MAHKEME DAGILIMI:")
    for row in mah_rows:
        label = LABEL.get(row[0], row[0])
        L.append(f"  {label}: {row[1]:,}")
    L.append("")

    L.append("KAYNAK DAGILIMI:")
    for row in kaynak_rows:
        L.append(f"  {row[0]}: {row[1]:,}")
    L.append("")

    L.append("INGESTION LOG:")
    for row in log_rows:
        L.append(f"  {row[0]}: {row[1]:,}")
    L.append("")

    if daire_rows:
        L.append("DAIRE ILERLEMESI (top 15):")
        for row in daire_rows:
            L.append(f"  {row[0]}: {row[1]:,}")
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
    L.append(f"GPU: {gpu_str} | Disk: {disk}")

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
