"""
Decision Search Service — PostgreSQL full-text search over the decisions table.

Provides:
- Full-text search with ts_rank_cd scoring and ts_headline snippets
- Esas/karar numara lookup
- Browse mode (no query)
- Faceted filtering (mahkeme, daire, yil)
- Overall statistics
"""

import math
import time
from datetime import date

import structlog
from sqlalchemy import Select, func, select, text, case, literal_column, extract
from sqlalchemy.orm import Session

from app.models.database import Decision

logger = structlog.get_logger(__name__)


class DecisionSearchService:
    """PostgreSQL-backed decision search with full-text, filters, and facets."""

    # ── Public API ────────────────────────────────────────────────────────

    def search(
        self,
        db: Session,
        query: str | None = None,
        mahkeme: str | None = None,
        daire: str | None = None,
        tarih_from: date | None = None,
        tarih_to: date | None = None,
        kaynak: str | None = None,
        esas_no: str | None = None,
        karar_no: str | None = None,
        page: int = 1,
        limit: int = 20,
        sort: str | None = None,
    ) -> dict:
        """
        Main search entry point.

        Three modes:
        1. Full-text search — when ``query`` is provided (and no esas_no/karar_no)
        2. Esas/karar lookup — when ``esas_no`` or ``karar_no`` is provided
        3. Browse all — neither query nor esas/karar numbers
        """
        t0 = time.perf_counter()
        offset = (page - 1) * limit

        # --- Mode selection ---
        if esas_no or karar_no:
            results, total = self._search_by_number(
                db, esas_no=esas_no, karar_no=karar_no,
                mahkeme=mahkeme, daire=daire,
                tarih_from=tarih_from, tarih_to=tarih_to,
                kaynak=kaynak, sort=sort,
                limit=limit, offset=offset,
            )
        elif query and query.strip():
            results, total = self._search_fulltext(
                db, query=query.strip(),
                mahkeme=mahkeme, daire=daire,
                tarih_from=tarih_from, tarih_to=tarih_to,
                kaynak=kaynak, sort=sort,
                limit=limit, offset=offset,
            )
        else:
            results, total = self._browse_all(
                db,
                mahkeme=mahkeme, daire=daire,
                tarih_from=tarih_from, tarih_to=tarih_to,
                kaynak=kaynak, sort=sort,
                limit=limit, offset=offset,
            )

        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        toplam_sayfa = max(1, math.ceil(total / limit))

        # Facets
        facets = self.get_facets(
            db, query=query,
            mahkeme=mahkeme, daire=daire,
            tarih_from=tarih_from, tarih_to=tarih_to,
            kaynak=kaynak,
        )

        return {
            "sonuclar": results,
            "toplam_bulunan": total,
            "sayfa": page,
            "toplam_sayfa": toplam_sayfa,
            "sure_ms": elapsed_ms,
            "facets": facets,
        }

    def get_decision(self, db: Session, source_id: str) -> dict | None:
        """Return a single decision by source_id, with full text."""
        row = db.execute(
            select(Decision).where(Decision.source_id == source_id)
        ).scalar_one_or_none()

        if row is None:
            return None

        return self._row_to_full_dict(row)

    def get_facets(
        self,
        db: Session,
        query: str | None = None,
        mahkeme: str | None = None,
        daire: str | None = None,
        tarih_from: date | None = None,
        tarih_to: date | None = None,
        kaynak: str | None = None,
    ) -> dict:
        """Return facet counts for mahkeme, daire, and yil."""

        # Build a base filter statement (just WHERE, no SELECT yet)
        base = select(Decision.id)
        if query and query.strip():
            tsquery = func.plainto_tsquery(literal_column("'simple'"), query.strip())
            base = base.where(Decision.search_vector.op("@@")(tsquery))
        base = self._apply_filters(base, mahkeme=None, daire=None, tarih_from=tarih_from, tarih_to=tarih_to, kaynak=kaynak)

        # Mahkeme facet (don't filter by mahkeme so user can see all options)
        mahkeme_q = (
            select(Decision.mahkeme, func.count().label("cnt"))
            .where(Decision.id.in_(base.scalar_subquery()) if query else True)
        )
        if not query:
            mahkeme_q = select(Decision.mahkeme, func.count().label("cnt"))
            mahkeme_q = self._apply_filters(mahkeme_q, mahkeme=None, daire=daire, tarih_from=tarih_from, tarih_to=tarih_to, kaynak=kaynak)
        else:
            mahkeme_q = (
                select(Decision.mahkeme, func.count().label("cnt"))
                .where(
                    Decision.search_vector.op("@@")(
                        func.plainto_tsquery(literal_column("'simple'"), query.strip())
                    )
                )
            )
            mahkeme_q = self._apply_filters(mahkeme_q, mahkeme=None, daire=daire, tarih_from=tarih_from, tarih_to=tarih_to, kaynak=kaynak)

        mahkeme_q = mahkeme_q.group_by(Decision.mahkeme).order_by(text("cnt DESC")).limit(20)
        mahkeme_facets = {row[0]: row[1] for row in db.execute(mahkeme_q).all()}

        # Daire facet (don't filter by daire)
        if query and query.strip():
            daire_q = (
                select(Decision.daire, func.count().label("cnt"))
                .where(
                    Decision.search_vector.op("@@")(
                        func.plainto_tsquery(literal_column("'simple'"), query.strip())
                    )
                )
                .where(Decision.daire.is_not(None))
            )
        else:
            daire_q = (
                select(Decision.daire, func.count().label("cnt"))
                .where(Decision.daire.is_not(None))
            )
        daire_q = self._apply_filters(daire_q, mahkeme=mahkeme, daire=None, tarih_from=tarih_from, tarih_to=tarih_to, kaynak=kaynak)
        daire_q = daire_q.group_by(Decision.daire).order_by(text("cnt DESC")).limit(30)
        daire_facets = {row[0]: row[1] for row in db.execute(daire_q).all()}

        # Yil facet (don't filter by tarih)
        if query and query.strip():
            yil_q = (
                select(
                    extract("year", Decision.tarih).label("yil"),
                    func.count().label("cnt"),
                )
                .where(Decision.tarih.is_not(None))
                .where(
                    Decision.search_vector.op("@@")(
                        func.plainto_tsquery(literal_column("'simple'"), query.strip())
                    )
                )
            )
        else:
            yil_q = (
                select(
                    extract("year", Decision.tarih).label("yil"),
                    func.count().label("cnt"),
                )
                .where(Decision.tarih.is_not(None))
            )
        yil_q = self._apply_filters(yil_q, mahkeme=mahkeme, daire=daire, tarih_from=None, tarih_to=None, kaynak=kaynak)
        yil_q = yil_q.group_by(text("yil")).order_by(text("yil DESC")).limit(30)
        yil_facets = {str(int(row[0])): row[1] for row in db.execute(yil_q).all() if row[0]}

        return {
            "mahkeme": mahkeme_facets,
            "daire": daire_facets,
            "yil": yil_facets,
        }

    def get_stats(self, db: Session) -> dict:
        """Return overall statistics about the decisions table."""
        total = db.execute(select(func.count(Decision.id))).scalar() or 0
        embedded = db.execute(
            select(func.count(Decision.id)).where(Decision.is_embedded.is_(True))
        ).scalar() or 0

        kaynak_counts = dict(
            db.execute(
                select(Decision.kaynak, func.count().label("cnt"))
                .group_by(Decision.kaynak)
                .order_by(text("cnt DESC"))
            ).all()
        )

        mahkeme_counts = dict(
            db.execute(
                select(Decision.mahkeme, func.count().label("cnt"))
                .group_by(Decision.mahkeme)
                .order_by(text("cnt DESC"))
                .limit(20)
            ).all()
        )

        tarih_range_row = db.execute(
            select(
                func.min(Decision.tarih).label("min_tarih"),
                func.max(Decision.tarih).label("max_tarih"),
            ).where(Decision.tarih.is_not(None))
        ).one_or_none()

        min_tarih = tarih_range_row[0].isoformat() if tarih_range_row and tarih_range_row[0] else None
        max_tarih = tarih_range_row[1].isoformat() if tarih_range_row and tarih_range_row[1] else None

        return {
            "toplam_karar": total,
            "embedded": embedded,
            "embedded_pct": round(embedded / total * 100, 1) if total > 0 else 0,
            "kaynak": kaynak_counts,
            "mahkeme": mahkeme_counts,
            "tarih_min": min_tarih,
            "tarih_max": max_tarih,
        }

    # ── Private helpers ───────────────────────────────────────────────────

    def _apply_filters(
        self,
        stmt: Select,
        mahkeme: str | None = None,
        daire: str | None = None,
        tarih_from: date | None = None,
        tarih_to: date | None = None,
        kaynak: str | None = None,
    ) -> Select:
        """Apply common WHERE filters to a SELECT statement."""
        if mahkeme:
            stmt = stmt.where(Decision.mahkeme == mahkeme)
        if daire:
            stmt = stmt.where(Decision.daire == daire)
        if tarih_from:
            stmt = stmt.where(Decision.tarih >= tarih_from)
        if tarih_to:
            stmt = stmt.where(Decision.tarih <= tarih_to)
        if kaynak:
            stmt = stmt.where(Decision.kaynak == kaynak)
        return stmt

    def _search_fulltext(
        self,
        db: Session,
        query: str,
        mahkeme: str | None,
        daire: str | None,
        tarih_from: date | None,
        tarih_to: date | None,
        kaynak: str | None,
        sort: str | None,
        limit: int,
        offset: int,
    ) -> tuple[list[dict], int]:
        """Full-text search using plainto_tsquery and ts_rank_cd."""
        tsquery = func.plainto_tsquery(literal_column("'simple'"), query)

        # Headline for snippet
        headline_opts = literal_column("'StartSel=<mark>, StopSel=</mark>, MaxWords=60, MinWords=20, MaxFragments=2'")
        headline = func.ts_headline(
            literal_column("'simple'"),
            func.coalesce(Decision.cleaned_text, Decision.raw_content, literal_column("''")),
            tsquery,
            headline_opts,
        ).label("headline")

        rank = func.ts_rank_cd(Decision.search_vector, tsquery).label("rank")

        # Main query
        stmt = (
            select(Decision, rank, headline)
            .where(Decision.search_vector.op("@@")(tsquery))
        )
        stmt = self._apply_filters(stmt, mahkeme, daire, tarih_from, tarih_to, kaynak)

        # Sort
        if sort == "tarih_desc":
            stmt = stmt.order_by(Decision.tarih.desc().nullslast(), rank.desc())
        elif sort == "tarih_asc":
            stmt = stmt.order_by(Decision.tarih.asc().nullsfirst(), rank.desc())
        else:
            stmt = stmt.order_by(rank.desc(), Decision.tarih.desc().nullslast())

        stmt = stmt.limit(limit).offset(offset)
        rows = db.execute(stmt).all()

        # Count query
        count_stmt = (
            select(func.count(Decision.id))
            .where(Decision.search_vector.op("@@")(tsquery))
        )
        count_stmt = self._apply_filters(count_stmt, mahkeme, daire, tarih_from, tarih_to, kaynak)
        total = db.execute(count_stmt).scalar() or 0

        results = []
        for row in rows:
            decision = row[0]
            score = float(row[1]) if row[1] else 0.0
            snippet = row[2] or ""
            results.append(self._row_to_result_dict(decision, score=score, snippet=snippet))

        return results, total

    def _search_by_number(
        self,
        db: Session,
        esas_no: str | None,
        karar_no: str | None,
        mahkeme: str | None,
        daire: str | None,
        tarih_from: date | None,
        tarih_to: date | None,
        kaynak: str | None,
        sort: str | None,
        limit: int,
        offset: int,
    ) -> tuple[list[dict], int]:
        """Lookup decisions by esas_no and/or karar_no."""
        stmt = select(Decision)
        if esas_no:
            stmt = stmt.where(Decision.esas_no.ilike(f"%{esas_no}%"))
        if karar_no:
            stmt = stmt.where(Decision.karar_no.ilike(f"%{karar_no}%"))
        stmt = self._apply_filters(stmt, mahkeme, daire, tarih_from, tarih_to, kaynak)

        # Count
        count_stmt = select(func.count(Decision.id))
        if esas_no:
            count_stmt = count_stmt.where(Decision.esas_no.ilike(f"%{esas_no}%"))
        if karar_no:
            count_stmt = count_stmt.where(Decision.karar_no.ilike(f"%{karar_no}%"))
        count_stmt = self._apply_filters(count_stmt, mahkeme, daire, tarih_from, tarih_to, kaynak)
        total = db.execute(count_stmt).scalar() or 0

        # Sort
        if sort == "tarih_asc":
            stmt = stmt.order_by(Decision.tarih.asc().nullsfirst())
        else:
            stmt = stmt.order_by(Decision.tarih.desc().nullslast())

        stmt = stmt.limit(limit).offset(offset)
        rows = db.execute(stmt).scalars().all()

        results = [self._row_to_result_dict(d, score=1.0) for d in rows]
        return results, total

    def _browse_all(
        self,
        db: Session,
        mahkeme: str | None,
        daire: str | None,
        tarih_from: date | None,
        tarih_to: date | None,
        kaynak: str | None,
        sort: str | None,
        limit: int,
        offset: int,
    ) -> tuple[list[dict], int]:
        """Browse all decisions (no search query)."""
        stmt = select(Decision)
        stmt = self._apply_filters(stmt, mahkeme, daire, tarih_from, tarih_to, kaynak)

        # Count
        count_stmt = select(func.count(Decision.id))
        count_stmt = self._apply_filters(count_stmt, mahkeme, daire, tarih_from, tarih_to, kaynak)
        total = db.execute(count_stmt).scalar() or 0

        # Sort
        if sort == "tarih_asc":
            stmt = stmt.order_by(Decision.tarih.asc().nullsfirst())
        elif sort == "tarih_desc":
            stmt = stmt.order_by(Decision.tarih.desc().nullslast())
        else:
            stmt = stmt.order_by(Decision.created_at.desc())

        stmt = stmt.limit(limit).offset(offset)
        rows = db.execute(stmt).scalars().all()

        results = [self._row_to_result_dict(d, score=0.0) for d in rows]
        return results, total

    def _row_to_result_dict(
        self,
        d: Decision,
        score: float = 0.0,
        snippet: str | None = None,
    ) -> dict:
        """Convert a Decision row to a search result dict."""
        # Build a short snippet from cleaned_text if no headline provided
        if not snippet:
            text_source = d.cleaned_text or d.raw_content or ""
            snippet = text_source[:300].strip()
            if len(text_source) > 300:
                snippet += "..."

        return {
            "karar_id": d.source_id,
            "mahkeme": d.mahkeme or "",
            "daire": d.daire,
            "esas_no": d.esas_no,
            "karar_no": d.karar_no,
            "tarih": d.tarih.isoformat() if d.tarih else d.tarih_str,
            "ozet": snippet,
            "kaynak": d.kaynak,
            "relevance_score": round(score, 4),
        }

    def _row_to_full_dict(self, d: Decision) -> dict:
        """Convert a Decision row to a full detail dict (including content)."""
        return {
            "id": str(d.id),
            "source_id": d.source_id,
            "kaynak": d.kaynak,
            "mahkeme": d.mahkeme or "",
            "daire": d.daire,
            "esas_no": d.esas_no,
            "karar_no": d.karar_no,
            "tarih": d.tarih.isoformat() if d.tarih else None,
            "tarih_str": d.tarih_str,
            "content": d.cleaned_text or d.raw_content or "",
            "content_type": d.content_type,
            "source_meta": d.source_meta or {},
            "is_embedded": d.is_embedded,
            "created_at": d.created_at.isoformat() if d.created_at else None,
            "updated_at": d.updated_at.isoformat() if d.updated_at else None,
        }
