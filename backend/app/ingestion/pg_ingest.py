"""
PostgreSQL-backed ingestion pipeline.
Bedesten, AYM ve AİHM kaynaklarından kararları çeker,
temizler ve decisions tablosuna yazar.

Eski dosya-tabanlı checkpoint yerine DB-driven checkpoint kullanır.
Dedup: md5(mahkeme|esas_no|karar_no|tarih_str) → dedup_hash ile INSERT ON CONFLICT DO NOTHING.
"""

from __future__ import annotations

import asyncio
import hashlib
import time
from datetime import date, datetime
from typing import Any

import structlog
from sqlalchemy import select, func, text, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import get_settings
from app.ingestion.html_cleaner import clean_legal_html
from app.models.database import Decision, DaireProgress, IngestionLog
from app.services.aym import AymService
from app.services.hudoc import HudocService
from app.services.telegram import TelegramService
from app.services.yargi import (
    YargiService,
    ITEM_TYPES,
    YARGITAY_HUKUK_DAIRELERI,
    YARGITAY_CEZA_DAIRELERI,
    DANISTAY_DAIRELERI,
    CircuitBreakerOpen,
)

logger = structlog.get_logger()

# ── Daire registry — court_type → {key: birim_adi} ──────────────────────

DAIRE_MAP: dict[str, dict[str, str]] = {
    "yargitay_hukuk": YARGITAY_HUKUK_DAIRELERI,
    "yargitay_ceza": YARGITAY_CEZA_DAIRELERI,
    "danistay": DANISTAY_DAIRELERI,
}

# Reverse lookup: court_type → Bedesten itemType
COURT_ITEM_TYPE: dict[str, str] = {
    "yargitay_hukuk": "YARGITAYKARARI",
    "yargitay_ceza": "YARGITAYKARARI",
    "danistay": "DANISTAYKARAR",
}

COURT_LABEL: dict[str, str] = {
    "yargitay_hukuk": "Yargitay",
    "yargitay_ceza": "Yargitay",
    "danistay": "Danistay",
}

# Error classification constants
_TRANSIENT_ERRORS = (
    "timeout",
    "connection",
    "429",
    "502",
    "503",
    "504",
    "rate",
    "throttl",
    "too many requests",
)

_PERMANENT_ERRORS = (
    "404",
    "not found",
    "invalid",
    "decode",
    "json",
)


class PgIngestionPipeline:
    """
    PostgreSQL-backed ingestion pipeline.

    Checkpoints are stored in ingestion_logs so that restarts
    resume from the last successfully processed page per daire.
    """

    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self.session_factory = session_factory
        self.settings = get_settings()
        self.telegram = TelegramService()

        # Counters — reset per top-level call
        self._saved = 0
        self._duplicates = 0
        self._errors = 0
        self._fetched = 0

    # ── helpers ───────────────────────────────────────────────────────────

    @staticmethod
    def _make_dedup_hash(
        mahkeme: str,
        esas_no: str | None,
        karar_no: str | None,
        tarih_str: str | None,
    ) -> str:
        """Deterministic MD5 from core identity fields."""
        parts = [
            (mahkeme or "").strip().lower(),
            (esas_no or "").strip(),
            (karar_no or "").strip(),
            (tarih_str or "").strip(),
        ]
        raw = "|".join(parts)
        return hashlib.md5(raw.encode("utf-8")).hexdigest()

    @staticmethod
    def _parse_date(date_str: str | None) -> date | None:
        """Parse 'DD.MM.YYYY' → date.  Returns None on failure."""
        if not date_str:
            return None
        date_str = date_str.strip()
        for fmt in ("%d.%m.%Y", "%d/%m/%Y", "%Y-%m-%d"):
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue
        # Try partial: just year
        if len(date_str) == 4 and date_str.isdigit():
            try:
                return date(int(date_str), 1, 1)
            except ValueError:
                pass
        logger.debug("date_parse_failed", raw=date_str)
        return None

    @staticmethod
    def _classify_error(exception: Exception) -> tuple[str, bool]:
        """
        Classify an exception into (error_type, can_retry).
        Returns a short slug and whether the item should be retried.
        """
        msg = str(exception).lower()

        if isinstance(exception, CircuitBreakerOpen):
            return "circuit_breaker", True

        if isinstance(exception, asyncio.TimeoutError):
            return "timeout", True

        for token in _TRANSIENT_ERRORS:
            if token in msg:
                return "transient", True

        for token in _PERMANENT_ERRORS:
            if token in msg:
                return "permanent", False

        return "unknown", True

    # ── DB operations ────────────────────────────────────────────────────

    async def _save_decision(
        self,
        db: AsyncSession,
        data: dict[str, Any],
    ) -> tuple[str, Any]:
        """
        Upsert a decision row using INSERT ... ON CONFLICT (dedup_hash) DO NOTHING.
        Returns ("saved", decision_id) or ("duplicate", None).
        """
        dedup_hash = data["dedup_hash"]

        stmt = (
            pg_insert(Decision)
            .values(
                dedup_hash=dedup_hash,
                kaynak=data["kaynak"],
                source_id=data["source_id"],
                mahkeme=data["mahkeme"],
                daire=data.get("daire"),
                esas_no=data.get("esas_no"),
                karar_no=data.get("karar_no"),
                tarih=data.get("tarih"),
                tarih_str=data.get("tarih_str"),
                raw_content=data.get("raw_content"),
                cleaned_text=data.get("cleaned_text"),
                content_type=data.get("content_type", "text/html"),
                source_meta=data.get("source_meta", {}),
            )
            .on_conflict_do_nothing(index_elements=["dedup_hash"])
            .returning(Decision.id)
        )

        result = await db.execute(stmt)
        row = result.fetchone()

        if row is not None:
            decision_id = row[0]
            logger.debug(
                "decision_saved",
                dedup_hash=dedup_hash,
                decision_id=str(decision_id),
            )
            return "saved", decision_id
        else:
            logger.debug("decision_duplicate", dedup_hash=dedup_hash)
            return "duplicate", None

    async def _log_attempt(
        self,
        db: AsyncSession,
        *,
        kaynak: str,
        source_id: str | None = None,
        mahkeme: str | None = None,
        daire: str | None = None,
        page: int | None = None,
        status: str,
        error_message: str | None = None,
        error_type: str | None = None,
        retry_count: int = 0,
        can_retry: bool = True,
        decision_id: Any | None = None,
    ) -> None:
        """Insert a row into ingestion_logs."""
        log_entry = IngestionLog(
            kaynak=kaynak,
            source_id=source_id,
            mahkeme=mahkeme,
            daire=daire,
            page=page,
            status=status,
            error_message=error_message,
            error_type=error_type,
            retry_count=retry_count,
            can_retry=can_retry,
            decision_id=decision_id,
        )
        db.add(log_entry)
        # Flush so that subsequent queries see this row; commit is caller's job.
        await db.flush()

    async def _get_last_page(
        self,
        db: AsyncSession,
        kaynak: str,
        mahkeme: str,
        daire: str | None,
    ) -> int:
        """
        Return the last successfully ingested page number for a
        (kaynak, mahkeme, daire) triple.  Returns 0 if none found.
        """
        q = (
            select(func.coalesce(func.max(IngestionLog.page), 0))
            .where(
                IngestionLog.kaynak == kaynak,
                IngestionLog.mahkeme == mahkeme,
                IngestionLog.status == "success",
            )
        )
        if daire is not None:
            q = q.where(IngestionLog.daire == daire)
        else:
            q = q.where(IngestionLog.daire.is_(None))

        result = await db.execute(q)
        return result.scalar() or 0

    async def _upsert_daire_progress(
        self,
        db: AsyncSession,
        *,
        kaynak: str,
        mahkeme: str,
        daire: str,
        **kwargs: Any,
    ) -> None:
        """
        Upsert a DaireProgress row using INSERT ON CONFLICT (kaynak, mahkeme, daire) DO UPDATE.
        Pass any DaireProgress column values as kwargs (status, last_page, total_api, etc.).
        """
        insert_values = {
            "kaynak": kaynak,
            "mahkeme": mahkeme,
            "daire": daire,
            **kwargs,
        }
        stmt = (
            pg_insert(DaireProgress)
            .values(**insert_values)
            .on_conflict_do_update(
                index_elements=["kaynak", "mahkeme", "daire"],
                set_={k: v for k, v in kwargs.items()},
            )
        )
        await db.execute(stmt)
        await db.flush()

    # ── Bedesten ingestion ───────────────────────────────────────────────

    async def ingest_bedesten(
        self,
        court_types: list[str] | None = None,
        year_from: int = 2020,
        year_to: int | None = None,
    ) -> dict[str, Any]:
        """
        Iterate every daire in the requested court types, paginate
        through Bedesten search results, fetch full text, and save.

        court_types: subset of ["yargitay_hukuk", "yargitay_ceza", "danistay"]
        """
        if court_types is None:
            court_types = ["yargitay_hukuk", "yargitay_ceza", "danistay"]
        if year_to is None:
            year_to = datetime.now().year

        self._reset_counters()
        t0 = time.monotonic()

        yargi = YargiService()
        date_from = f"01.01.{year_from}"
        date_to = f"31.12.{year_to}"

        try:
            for court_type in court_types:
                daire_dict = DAIRE_MAP.get(court_type, {})
                item_type = COURT_ITEM_TYPE.get(court_type, "YARGITAYKARARI")
                mahkeme_label = COURT_LABEL.get(court_type, court_type)

                for daire_key, birim_adi in daire_dict.items():
                    await self._ingest_bedesten_daire(
                        yargi=yargi,
                        item_type=item_type,
                        mahkeme=mahkeme_label,
                        daire_key=daire_key,
                        birim_adi=birim_adi,
                        date_from=date_from,
                        date_to=date_to,
                    )
        except CircuitBreakerOpen:
            logger.warning("bedesten_circuit_open_abort")
        finally:
            await yargi.close()

        elapsed = round(time.monotonic() - t0, 1)
        stats = self._build_stats("bedesten", elapsed)

        await self.telegram.send_ingestion_report(
            {
                "source": "bedesten",
                "fetched": self._fetched,
                "embedded": self._saved,
                "errors": self._errors,
                "elapsed": f"{elapsed}s",
                "status": "tamamlandi",
            }
        )

        # Update source registry
        try:
            async with self.session_factory() as db:
                from app.models.database import SourceRegistry

                # Count actuals per subcategory
                for subcat, mahkeme_filter in [
                    ("yargitay_hukuk", "Yargıtay"),
                    ("yargitay_ceza", "Yargıtay"),
                    ("danistay", "Danıştay"),
                ]:
                    # For Yargıtay, distinguish Hukuk vs Ceza by daire name
                    if subcat == "yargitay_hukuk":
                        count_q = select(func.count(Decision.id)).where(
                            Decision.mahkeme == "Yargıtay",
                            Decision.daire.like("%Hukuk%") | Decision.daire.like("%HGK%")
                        )
                    elif subcat == "yargitay_ceza":
                        count_q = select(func.count(Decision.id)).where(
                            Decision.mahkeme == "Yargıtay",
                            Decision.daire.like("%Ceza%") | Decision.daire.like("%CGK%")
                        )
                    else:
                        count_q = select(func.count(Decision.id)).where(
                            Decision.mahkeme == "Danıştay"
                        )

                    actual = (await db.execute(count_q)).scalar() or 0

                    # Get latest dates
                    date_q = select(
                        func.max(Decision.tarih),
                        func.max(Decision.created_at),
                    )
                    if subcat == "yargitay_hukuk":
                        date_q = date_q.where(Decision.mahkeme == "Yargıtay", Decision.daire.like("%Hukuk%") | Decision.daire.like("%HGK%"))
                    elif subcat == "yargitay_ceza":
                        date_q = date_q.where(Decision.mahkeme == "Yargıtay", Decision.daire.like("%Ceza%") | Decision.daire.like("%CGK%"))
                    else:
                        date_q = date_q.where(Decision.mahkeme == "Danıştay")

                    date_row = (await db.execute(date_q)).one_or_none()

                    # Upsert
                    stmt = pg_insert(SourceRegistry).values(
                        kaynak="bedesten",
                        subcategory=subcat,
                        display_name={"yargitay_hukuk": "Yargıtay Hukuk Daireleri", "yargitay_ceza": "Yargıtay Ceza Daireleri", "danistay": "Danıştay Daireleri"}[subcat],
                        actual_total=actual,
                        last_ingested_at=date_row[1] if date_row else None,
                        last_decision_date=date_row[0] if date_row else None,
                        status="active",
                        last_checked_at=func.now(),
                    ).on_conflict_do_update(
                        index_elements=["kaynak", "subcategory"],
                        set_={
                            "actual_total": actual,
                            "last_ingested_at": date_row[1] if date_row else None,
                            "last_decision_date": date_row[0] if date_row else None,
                            "status": "active",
                            "last_checked_at": func.now(),
                            "updated_at": func.now(),
                        },
                    )
                    await db.execute(stmt)
                await db.commit()
        except Exception as e:
            logger.warning("source_registry_update_error", error=str(e))

        logger.info("bedesten_ingestion_done", **stats)
        return stats

    async def _ingest_bedesten_daire(
        self,
        *,
        yargi: YargiService,
        item_type: str,
        mahkeme: str,
        daire_key: str,
        birim_adi: str,
        date_from: str,
        date_to: str,
    ) -> None:
        """Paginate a single daire, fetch documents, save."""
        async with self.session_factory() as db:
            start_page = await self._get_last_page(db, "bedesten", mahkeme, birim_adi)

        page = start_page + 1
        empty_streak = 0
        max_empty_streak = 3  # stop after 3 consecutive empty pages
        page_delay = self.settings.ingestion_page_delay
        concurrent = self.settings.ingestion_concurrent_fetches

        # Track per-daire counters for DaireProgress
        daire_saved = 0
        daire_skipped = 0
        daire_errors = 0

        # Mark daire as active
        async with self.session_factory() as db:
            await self._upsert_daire_progress(
                db,
                kaynak="bedesten",
                mahkeme=mahkeme,
                daire=birim_adi,
                item_type=item_type,
                status="active",
                last_page=start_page,
                started_at=func.now(),
                last_activity=func.now(),
            )
            await db.commit()

        logger.info(
            "bedesten_daire_start",
            mahkeme=mahkeme,
            daire=birim_adi,
            start_page=page,
        )

        try:
            while empty_streak < max_empty_streak:
                try:
                    search_result = await yargi.search_bedesten(
                        keyword="karar",
                        item_type=item_type,
                        birim_adi=birim_adi,
                        page=page,
                        page_size=10,
                        date_from=date_from,
                        date_to=date_to,
                        raise_on_circuit=True,
                    )
                except CircuitBreakerOpen:
                    raise
                except Exception as exc:
                    err_type, can_retry = self._classify_error(exc)
                    self._errors += 1
                    daire_errors += 1
                    async with self.session_factory() as db:
                        await self._log_attempt(
                            db,
                            kaynak="bedesten",
                            mahkeme=mahkeme,
                            daire=birim_adi,
                            page=page,
                            status="error",
                            error_message=str(exc)[:500],
                            error_type=err_type,
                            can_retry=can_retry,
                        )
                        await self._upsert_daire_progress(
                            db,
                            kaynak="bedesten",
                            mahkeme=mahkeme,
                            daire=birim_adi,
                            errors=daire_errors,
                            last_activity=func.now(),
                        )
                        await db.commit()
                    logger.warning(
                        "bedesten_search_error",
                        daire=birim_adi,
                        page=page,
                        error=str(exc)[:200],
                    )
                    if can_retry:
                        # Transient error (429, timeout, etc) — back off and retry same page
                        await asyncio.sleep(page_delay * 3)
                        empty_streak += 1
                    else:
                        # Permanent error — skip page
                        empty_streak += 1
                        page += 1
                        await asyncio.sleep(page_delay)
                    continue

                items = search_result.get("data", {}).get("emsalKararList", [])
                total = search_result.get("data", {}).get("total", 0)
                total_pages = (total + 9) // 10 if total else None

                if not items:
                    empty_streak += 1
                    page += 1
                    await asyncio.sleep(page_delay)
                    continue

                empty_streak = 0

                # Fetch full documents concurrently in small batches
                page_saved_before = self._saved
                doc_ids = [it.get("documentId") for it in items if it.get("documentId")]
                for batch_start in range(0, len(doc_ids), concurrent):
                    batch = doc_ids[batch_start : batch_start + concurrent]
                    doc_tasks = [
                        yargi.get_document(did, raise_on_circuit=True) for did in batch
                    ]
                    doc_results = await asyncio.gather(*doc_tasks, return_exceptions=True)

                    async with self.session_factory() as db:
                        for did, doc_or_exc, raw_item in zip(
                            batch,
                            doc_results,
                            items[batch_start : batch_start + concurrent],
                        ):
                            if isinstance(doc_or_exc, Exception):
                                err_type, can_retry = self._classify_error(doc_or_exc)
                                self._errors += 1
                                daire_errors += 1
                                await self._log_attempt(
                                    db,
                                    kaynak="bedesten",
                                    source_id=did,
                                    mahkeme=mahkeme,
                                    daire=birim_adi,
                                    page=page,
                                    status="error",
                                    error_message=str(doc_or_exc)[:500],
                                    error_type=err_type,
                                    can_retry=can_retry,
                                )
                                continue

                            self._fetched += 1
                            await self._process_bedesten_doc(
                                db=db,
                                raw_item=raw_item,
                                doc_data=doc_or_exc,
                                mahkeme=mahkeme,
                                birim_adi=birim_adi,
                                page=page,
                            )

                        await db.commit()

                # Update per-daire counters after page
                page_new_saved = self._saved - page_saved_before
                daire_saved += page_new_saved
                daire_skipped += len(items) - page_new_saved

                # Log page success checkpoint + update DaireProgress
                async with self.session_factory() as db:
                    await self._log_attempt(
                        db,
                        kaynak="bedesten",
                        mahkeme=mahkeme,
                        daire=birim_adi,
                        page=page,
                        status="success",
                    )
                    await self._upsert_daire_progress(
                        db,
                        kaynak="bedesten",
                        mahkeme=mahkeme,
                        daire=birim_adi,
                        last_page=page,
                        total_api=total if total else None,
                        total_pages=total_pages,
                        decisions_saved=daire_saved,
                        decisions_skipped=daire_skipped,
                        errors=daire_errors,
                        last_activity=func.now(),
                    )
                    await db.commit()

                logger.info(
                    "bedesten_page_done",
                    daire=birim_adi,
                    page=page,
                    total=total,
                    items=len(items),
                    saved=self._saved,
                )

                page += 1
                await asyncio.sleep(page_delay)

        except CircuitBreakerOpen:
            # Mark daire as error on circuit breaker
            async with self.session_factory() as db:
                await self._upsert_daire_progress(
                    db,
                    kaynak="bedesten",
                    mahkeme=mahkeme,
                    daire=birim_adi,
                    status="error",
                    errors=daire_errors,
                    last_activity=func.now(),
                )
                await db.commit()
            raise

        # Mark daire as done
        async with self.session_factory() as db:
            await self._upsert_daire_progress(
                db,
                kaynak="bedesten",
                mahkeme=mahkeme,
                daire=birim_adi,
                status="done",
                decisions_saved=daire_saved,
                decisions_skipped=daire_skipped,
                errors=daire_errors,
                completed_at=func.now(),
                last_activity=func.now(),
            )
            await db.commit()

        logger.info(
            "bedesten_daire_done",
            daire=birim_adi,
            pages_processed=page - start_page - 1,
        )

    async def _process_bedesten_doc(
        self,
        *,
        db: AsyncSession,
        raw_item: dict,
        doc_data: dict,
        mahkeme: str,
        birim_adi: str,
        page: int,
    ) -> None:
        """Clean, dedup, and save a single Bedesten document."""
        doc_id = raw_item.get("documentId", "")
        esas_yil = raw_item.get("esasNoYil", "")
        esas_sira = raw_item.get("esasNoSira", "")
        karar_yil = raw_item.get("kararNoYil", "")
        karar_sira = raw_item.get("kararNoSira", "")

        esas_no = f"{esas_yil}/{esas_sira}" if esas_yil and esas_sira else raw_item.get("esasNo", "")
        karar_no = f"{karar_yil}/{karar_sira}" if karar_yil and karar_sira else raw_item.get("kararNo", "")
        tarih_str = raw_item.get("kararTarihiStr", raw_item.get("kararTarihi", ""))

        decoded = doc_data.get("data", {}).get("decoded_content", "")
        cleaned = clean_legal_html(decoded) if decoded else ""

        if len(cleaned) < self.settings.min_karar_chars:
            logger.debug("bedesten_doc_too_short", doc_id=doc_id, chars=len(cleaned))
            return

        dedup_hash = self._make_dedup_hash(mahkeme, esas_no, karar_no, tarih_str)

        data_dict = {
            "dedup_hash": dedup_hash,
            "kaynak": "bedesten",
            "source_id": doc_id,
            "mahkeme": mahkeme,
            "daire": birim_adi,
            "esas_no": esas_no or None,
            "karar_no": karar_no or None,
            "tarih": self._parse_date(tarih_str),
            "tarih_str": tarih_str or None,
            "raw_content": decoded[:100_000] if decoded else None,
            "cleaned_text": cleaned[:100_000],
            "content_type": doc_data.get("data", {}).get("mimeType", "text/html"),
            "source_meta": {
                "birim_adi": birim_adi,
                "esas_no": esas_no,
                "karar_no": karar_no,
            },
        }

        status, decision_id = await self._save_decision(db, data_dict)

        if status == "saved":
            self._saved += 1
            await self._log_attempt(
                db,
                kaynak="bedesten",
                source_id=doc_id,
                mahkeme=mahkeme,
                daire=birim_adi,
                page=page,
                status="saved",
                decision_id=decision_id,
            )
        else:
            self._duplicates += 1

    # ── AYM ingestion ────────────────────────────────────────────────────

    async def ingest_aym(
        self,
        pages: int = 50,
        ihlal_only: bool = True,
    ) -> dict[str, Any]:
        """
        Fetch AYM bireysel basvuru decisions page by page.
        For each search result, fetch the full document text.
        """
        self._reset_counters()
        t0 = time.monotonic()
        aym = AymService()

        try:
            async with self.session_factory() as db:
                start_page = await self._get_last_page(db, "aym", "AYM", None)

            page_delay = self.settings.ingestion_page_delay

            for page_num in range(start_page + 1, start_page + 1 + pages):
                try:
                    search_result = await aym.search_bireysel_basvuru(
                        keyword="",
                        page=page_num,
                        page_size=20,
                        ihlal_only=ihlal_only,
                    )
                except Exception as exc:
                    err_type, can_retry = self._classify_error(exc)
                    self._errors += 1
                    async with self.session_factory() as db:
                        await self._log_attempt(
                            db,
                            kaynak="aym",
                            mahkeme="AYM",
                            page=page_num,
                            status="error",
                            error_message=str(exc)[:500],
                            error_type=err_type,
                            can_retry=can_retry,
                        )
                        await db.commit()
                    logger.warning("aym_search_error", page=page_num, error=str(exc)[:200])
                    await asyncio.sleep(page_delay)
                    continue

                results = search_result.get("results", [])
                if not results:
                    logger.info("aym_no_results", page=page_num)
                    break

                for item in results:
                    basvuru_no = item.get("basvuru_no", "")
                    if not basvuru_no:
                        continue

                    try:
                        doc = await aym.get_document(basvuru_no)
                    except Exception as exc:
                        err_type, can_retry = self._classify_error(exc)
                        self._errors += 1
                        async with self.session_factory() as db:
                            await self._log_attempt(
                                db,
                                kaynak="aym",
                                source_id=basvuru_no,
                                mahkeme="AYM",
                                page=page_num,
                                status="error",
                                error_message=str(exc)[:500],
                                error_type=err_type,
                                can_retry=can_retry,
                            )
                            await db.commit()
                        continue

                    self._fetched += 1
                    content = doc.get("content", "")
                    metadata = doc.get("metadata", {})

                    if len(content) < self.settings.min_karar_chars:
                        logger.debug("aym_doc_too_short", basvuru_no=basvuru_no, chars=len(content))
                        continue

                    tarih_str = metadata.get("karar_tarihi", "")
                    dedup_hash = self._make_dedup_hash("AYM", basvuru_no, "", tarih_str)

                    data_dict = {
                        "dedup_hash": dedup_hash,
                        "kaynak": "aym",
                        "source_id": basvuru_no,
                        "mahkeme": "AYM",
                        "daire": None,
                        "esas_no": basvuru_no,
                        "karar_no": None,
                        "tarih": self._parse_date(tarih_str),
                        "tarih_str": tarih_str or None,
                        "raw_content": content[:100_000],
                        "cleaned_text": content[:100_000],
                        "content_type": "text/html",
                        "source_meta": {
                            "konu": metadata.get("konu", ""),
                            "sonuc": metadata.get("sonuc", ""),
                            "ihlal_edilen_hak": metadata.get("ihlal_edilen_hak", ""),
                        },
                    }

                    async with self.session_factory() as db:
                        status, decision_id = await self._save_decision(db, data_dict)
                        if status == "saved":
                            self._saved += 1
                            await self._log_attempt(
                                db,
                                kaynak="aym",
                                source_id=basvuru_no,
                                mahkeme="AYM",
                                page=page_num,
                                status="saved",
                                decision_id=decision_id,
                            )
                        else:
                            self._duplicates += 1
                        await db.commit()

                # Page checkpoint
                async with self.session_factory() as db:
                    await self._log_attempt(
                        db,
                        kaynak="aym",
                        mahkeme="AYM",
                        page=page_num,
                        status="success",
                    )
                    await db.commit()

                logger.info(
                    "aym_page_done",
                    page=page_num,
                    results=len(results),
                    saved=self._saved,
                )
                await asyncio.sleep(page_delay)

        finally:
            await aym.close()

        elapsed = round(time.monotonic() - t0, 1)
        stats = self._build_stats("aym", elapsed)

        await self.telegram.send_ingestion_report(
            {
                "source": "aym",
                "fetched": self._fetched,
                "embedded": self._saved,
                "errors": self._errors,
                "elapsed": f"{elapsed}s",
                "status": "tamamlandi",
            }
        )

        logger.info("aym_ingestion_done", **stats)
        return stats

    # ── AİHM (HUDOC) ingestion ───────────────────────────────────────────

    async def ingest_aihm(
        self,
        max_results: int = 500,
    ) -> dict[str, Any]:
        """
        Fetch HUDOC judgments against Turkey, paginate via start/length,
        fetch full document text for each, and save.
        """
        self._reset_counters()
        t0 = time.monotonic()
        hudoc = HudocService()
        page_size = 50
        page_delay = self.settings.ingestion_page_delay

        try:
            for start in range(0, max_results, page_size):
                length = min(page_size, max_results - start)

                try:
                    search_result = await hudoc.search_judgments(
                        respondent="TUR",
                        start=start,
                        length=length,
                    )
                except Exception as exc:
                    err_type, can_retry = self._classify_error(exc)
                    self._errors += 1
                    async with self.session_factory() as db:
                        await self._log_attempt(
                            db,
                            kaynak="aihm",
                            mahkeme="AİHM",
                            page=start // page_size + 1,
                            status="error",
                            error_message=str(exc)[:500],
                            error_type=err_type,
                            can_retry=can_retry,
                        )
                        await db.commit()
                    logger.warning("hudoc_search_error", start=start, error=str(exc)[:200])
                    await asyncio.sleep(page_delay)
                    continue

                results = search_result.get("results", [])
                if not results:
                    logger.info("hudoc_no_results", start=start)
                    break

                for item in results:
                    itemid = item.get("itemid", "")
                    if not itemid:
                        continue

                    try:
                        full_text = await hudoc.get_document(itemid)
                    except Exception as exc:
                        err_type, can_retry = self._classify_error(exc)
                        self._errors += 1
                        async with self.session_factory() as db:
                            await self._log_attempt(
                                db,
                                kaynak="aihm",
                                source_id=itemid,
                                mahkeme="AİHM",
                                status="error",
                                error_message=str(exc)[:500],
                                error_type=err_type,
                                can_retry=can_retry,
                            )
                            await db.commit()
                        continue

                    self._fetched += 1

                    if len(full_text) < self.settings.min_karar_chars:
                        logger.debug("hudoc_doc_too_short", itemid=itemid, chars=len(full_text))
                        continue

                    basvuru_no = item.get("basvuru_no", "")
                    baslik = item.get("baslik", "")
                    tarih_str = item.get("tarih", "")  # "YYYY-MM-DD" from HUDOC

                    dedup_hash = self._make_dedup_hash("AİHM", basvuru_no, itemid, tarih_str)

                    data_dict = {
                        "dedup_hash": dedup_hash,
                        "kaynak": "aihm",
                        "source_id": itemid,
                        "mahkeme": "AİHM",
                        "daire": item.get("daire_tipi"),
                        "esas_no": basvuru_no or None,
                        "karar_no": None,
                        "tarih": self._parse_date(tarih_str),
                        "tarih_str": tarih_str or None,
                        "raw_content": full_text[:100_000],
                        "cleaned_text": full_text[:100_000],
                        "content_type": "text/html",
                        "source_meta": {
                            "baslik": baslik,
                            "ihlal_maddeleri": item.get("ihlal_maddeleri", []),
                            "ihlal_raw": item.get("ihlal_raw", ""),
                            "sonuc": item.get("sonuc", ""),
                            "onem": item.get("onem", ""),
                            "dil": item.get("dil", ""),
                        },
                    }

                    async with self.session_factory() as db:
                        status, decision_id = await self._save_decision(db, data_dict)
                        if status == "saved":
                            self._saved += 1
                            await self._log_attempt(
                                db,
                                kaynak="aihm",
                                source_id=itemid,
                                mahkeme="AİHM",
                                status="saved",
                                decision_id=decision_id,
                            )
                        else:
                            self._duplicates += 1
                        await db.commit()

                logger.info(
                    "hudoc_batch_done",
                    start=start,
                    results=len(results),
                    saved=self._saved,
                )
                await asyncio.sleep(page_delay)

        finally:
            await hudoc.close()

        elapsed = round(time.monotonic() - t0, 1)
        stats = self._build_stats("aihm", elapsed)

        await self.telegram.send_ingestion_report(
            {
                "source": "aihm",
                "fetched": self._fetched,
                "embedded": self._saved,
                "errors": self._errors,
                "elapsed": f"{elapsed}s",
                "status": "tamamlandi",
            }
        )

        logger.info("aihm_ingestion_done", **stats)
        return stats

    # ── Retry failed ─────────────────────────────────────────────────────

    async def retry_failed(
        self,
        kaynak: str | None = None,
        limit: int = 100,
    ) -> dict[str, Any]:
        """
        Re-attempt previously failed ingestion items.
        Reads from ingestion_logs where status='error' AND can_retry=True,
        grouped by source_id, and retries fetching + saving.
        """
        self._reset_counters()
        t0 = time.monotonic()

        async with self.session_factory() as db:
            q = (
                select(IngestionLog)
                .where(
                    IngestionLog.status == "error",
                    IngestionLog.can_retry.is_(True),
                    IngestionLog.source_id.isnot(None),
                )
                .order_by(IngestionLog.created_at.desc())
                .limit(limit)
            )
            if kaynak:
                q = q.where(IngestionLog.kaynak == kaynak)

            result = await db.execute(q)
            failed_logs = result.scalars().all()

        if not failed_logs:
            logger.info("retry_failed_none_found", kaynak=kaynak)
            return self._build_stats("retry", 0)

        # Deduplicate by source_id — take the most recent failure only
        seen_sources: dict[str, IngestionLog] = {}
        for log_entry in failed_logs:
            sid = log_entry.source_id
            if sid and sid not in seen_sources:
                seen_sources[sid] = log_entry

        yargi = YargiService()
        aym = AymService()
        hudoc = HudocService()

        try:
            for source_id, log_entry in seen_sources.items():
                log_kaynak = log_entry.kaynak
                retry_count = log_entry.retry_count + 1

                try:
                    if log_kaynak == "bedesten":
                        doc_data = await yargi.get_document(source_id, raise_on_circuit=True)
                        decoded = doc_data.get("data", {}).get("decoded_content", "")
                        cleaned = clean_legal_html(decoded) if decoded else ""

                        if len(cleaned) < self.settings.min_karar_chars:
                            continue

                        mahkeme = log_entry.mahkeme or "Yargitay"
                        daire = log_entry.daire or ""
                        dedup_hash = self._make_dedup_hash(mahkeme, "", "", "")

                        data_dict = {
                            "dedup_hash": self._make_dedup_hash(mahkeme, source_id, "", ""),
                            "kaynak": "bedesten",
                            "source_id": source_id,
                            "mahkeme": mahkeme,
                            "daire": daire or None,
                            "esas_no": None,
                            "karar_no": None,
                            "tarih": None,
                            "tarih_str": None,
                            "raw_content": decoded[:100_000] if decoded else None,
                            "cleaned_text": cleaned[:100_000],
                            "content_type": "text/html",
                            "source_meta": {"retry": True, "original_error": log_entry.error_type},
                        }

                    elif log_kaynak == "aym":
                        doc = await aym.get_document(source_id)
                        content = doc.get("content", "")
                        metadata = doc.get("metadata", {})

                        if len(content) < self.settings.min_karar_chars:
                            continue

                        tarih_str = metadata.get("karar_tarihi", "")
                        data_dict = {
                            "dedup_hash": self._make_dedup_hash("AYM", source_id, "", tarih_str),
                            "kaynak": "aym",
                            "source_id": source_id,
                            "mahkeme": "AYM",
                            "daire": None,
                            "esas_no": source_id,
                            "karar_no": None,
                            "tarih": self._parse_date(tarih_str),
                            "tarih_str": tarih_str or None,
                            "raw_content": content[:100_000],
                            "cleaned_text": content[:100_000],
                            "content_type": "text/html",
                            "source_meta": {
                                "konu": metadata.get("konu", ""),
                                "sonuc": metadata.get("sonuc", ""),
                                "retry": True,
                            },
                        }

                    elif log_kaynak == "aihm":
                        full_text = await hudoc.get_document(source_id)

                        if len(full_text) < self.settings.min_karar_chars:
                            continue

                        data_dict = {
                            "dedup_hash": self._make_dedup_hash("AİHM", "", source_id, ""),
                            "kaynak": "aihm",
                            "source_id": source_id,
                            "mahkeme": "AİHM",
                            "daire": None,
                            "esas_no": None,
                            "karar_no": None,
                            "tarih": None,
                            "tarih_str": None,
                            "raw_content": full_text[:100_000],
                            "cleaned_text": full_text[:100_000],
                            "content_type": "text/html",
                            "source_meta": {"retry": True},
                        }
                    else:
                        logger.warning("retry_unknown_kaynak", kaynak=log_kaynak, source_id=source_id)
                        continue

                    self._fetched += 1

                    async with self.session_factory() as db:
                        status, decision_id = await self._save_decision(db, data_dict)
                        if status == "saved":
                            self._saved += 1
                            await self._log_attempt(
                                db,
                                kaynak=log_kaynak,
                                source_id=source_id,
                                mahkeme=log_entry.mahkeme,
                                daire=log_entry.daire,
                                status="saved",
                                retry_count=retry_count,
                                decision_id=decision_id,
                            )
                        else:
                            self._duplicates += 1
                        await db.commit()

                except Exception as exc:
                    err_type, can_retry = self._classify_error(exc)
                    # After 3 retries, mark as non-retryable
                    if retry_count >= 3:
                        can_retry = False
                    self._errors += 1
                    async with self.session_factory() as db:
                        await self._log_attempt(
                            db,
                            kaynak=log_kaynak,
                            source_id=source_id,
                            mahkeme=log_entry.mahkeme,
                            daire=log_entry.daire,
                            status="error",
                            error_message=str(exc)[:500],
                            error_type=err_type,
                            retry_count=retry_count,
                            can_retry=can_retry,
                        )
                        await db.commit()

                await asyncio.sleep(self.settings.ingestion_rate_limit)

        finally:
            await yargi.close()
            await aym.close()
            await hudoc.close()

        elapsed = round(time.monotonic() - t0, 1)
        stats = self._build_stats("retry", elapsed)
        logger.info("retry_failed_done", **stats)
        return stats

    # ── Stats ────────────────────────────────────────────────────────────

    async def get_stats(self) -> dict[str, Any]:
        """
        Return a summary of ingestion state from the database:
        total decisions, per-source counts, pending retries, etc.
        """
        async with self.session_factory() as db:
            # Total decisions
            total_q = select(func.count()).select_from(Decision)
            total = (await db.execute(total_q)).scalar() or 0

            # Per-source counts
            source_q = (
                select(Decision.kaynak, func.count())
                .group_by(Decision.kaynak)
            )
            source_rows = (await db.execute(source_q)).all()
            per_source = {row[0]: row[1] for row in source_rows}

            # Per-mahkeme counts
            mahkeme_q = (
                select(Decision.mahkeme, func.count())
                .group_by(Decision.mahkeme)
            )
            mahkeme_rows = (await db.execute(mahkeme_q)).all()
            per_mahkeme = {row[0]: row[1] for row in mahkeme_rows}

            # Embedded vs not
            embedded_q = (
                select(func.count())
                .select_from(Decision)
                .where(Decision.is_embedded.is_(True))
            )
            embedded_count = (await db.execute(embedded_q)).scalar() or 0

            # Pending retries
            retry_q = (
                select(func.count())
                .select_from(IngestionLog)
                .where(
                    IngestionLog.status == "error",
                    IngestionLog.can_retry.is_(True),
                )
            )
            pending_retries = (await db.execute(retry_q)).scalar() or 0

            # Recent errors (last 24h)
            recent_err_q = (
                select(func.count())
                .select_from(IngestionLog)
                .where(
                    IngestionLog.status == "error",
                    IngestionLog.created_at >= func.now() - text("interval '24 hours'"),
                )
            )
            recent_errors = (await db.execute(recent_err_q)).scalar() or 0

            # Last ingestion time
            last_q = (
                select(func.max(IngestionLog.created_at))
                .where(IngestionLog.status.in_(["success", "saved"]))
            )
            last_ingestion = (await db.execute(last_q)).scalar()

        return {
            "total_decisions": total,
            "embedded": embedded_count,
            "not_embedded": total - embedded_count,
            "per_source": per_source,
            "per_mahkeme": per_mahkeme,
            "pending_retries": pending_retries,
            "recent_errors_24h": recent_errors,
            "last_ingestion": last_ingestion.isoformat() if last_ingestion else None,
        }

    # ── Internal helpers ─────────────────────────────────────────────────

    def _reset_counters(self) -> None:
        self._saved = 0
        self._duplicates = 0
        self._errors = 0
        self._fetched = 0

    def _build_stats(self, source: str, elapsed: float) -> dict[str, Any]:
        return {
            "source": source,
            "saved": self._saved,
            "duplicates": self._duplicates,
            "errors": self._errors,
            "fetched": self._fetched,
            "elapsed_seconds": elapsed,
        }
