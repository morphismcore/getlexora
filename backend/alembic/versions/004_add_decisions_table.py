"""Add decisions and ingestion_logs tables.

Stores court decisions with full-text search and ingestion tracking.

Revision ID: 004_decisions
Revises: 003_firm_type
Create Date: 2026-03-27
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

# revision identifiers, used by Alembic.
revision = "004_decisions"
down_revision = "003_firm_type"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── decisions table ────────────────────────────────────────────────
    op.create_table(
        "decisions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("dedup_hash", sa.String(32), nullable=False),
        sa.Column("kaynak", sa.String(20), nullable=False),
        sa.Column("source_id", sa.String(200), nullable=False),
        sa.Column("mahkeme", sa.String(100), nullable=False),
        sa.Column("daire", sa.String(200), nullable=True),
        sa.Column("esas_no", sa.String(50), nullable=True),
        sa.Column("karar_no", sa.String(50), nullable=True),
        sa.Column("tarih", sa.Date, nullable=True),
        sa.Column("tarih_str", sa.String(20), nullable=True),
        sa.Column("raw_content", sa.Text, nullable=True),
        sa.Column("cleaned_text", sa.Text, nullable=True),
        sa.Column("content_type", sa.String(20), nullable=False, server_default="text/html"),
        sa.Column("pdf_data", sa.LargeBinary, nullable=True),
        sa.Column("source_meta", JSONB, nullable=False, server_default=sa.text("'{}'")),
        sa.Column("is_embedded", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("embedded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # Add tsvector column via raw SQL (not supported by sa.Column directly)
    op.execute("ALTER TABLE decisions ADD COLUMN search_vector tsvector")

    # Unique & single-column indexes
    op.create_index("ix_decisions_dedup_hash", "decisions", ["dedup_hash"], unique=True)
    op.create_index("ix_decisions_kaynak", "decisions", ["kaynak"])
    op.create_index("ix_decisions_mahkeme", "decisions", ["mahkeme"])
    op.create_index("ix_decisions_esas_no", "decisions", ["esas_no"])
    op.create_index("ix_decisions_karar_no", "decisions", ["karar_no"])
    op.create_index("ix_decisions_tarih", "decisions", ["tarih"])
    op.create_index("ix_decisions_source_id", "decisions", ["source_id"])

    # Composite indexes
    op.create_index("ix_decisions_mahkeme_tarih", "decisions", ["mahkeme", "tarih"])
    op.create_index("ix_decisions_kaynak_mahkeme", "decisions", ["kaynak", "mahkeme"])

    # GIN index on tsvector
    op.execute("CREATE INDEX ix_decisions_search_vector ON decisions USING gin(search_vector)")

    # Partial index for not-yet-embedded rows
    op.execute(
        "CREATE INDEX ix_decisions_not_embedded ON decisions (is_embedded) WHERE is_embedded = false"
    )

    # ── ingestion_logs table ───────────────────────────────────────────
    op.create_table(
        "ingestion_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("kaynak", sa.String(20), nullable=False),
        sa.Column("source_id", sa.String(200), nullable=True),
        sa.Column("mahkeme", sa.String(100), nullable=True),
        sa.Column("daire", sa.String(200), nullable=True),
        sa.Column("page", sa.Integer, nullable=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("error_type", sa.String(50), nullable=True),
        sa.Column("retry_count", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("can_retry", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("decision_id", UUID(as_uuid=True), sa.ForeignKey("decisions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_index("ix_ingestion_logs_kaynak", "ingestion_logs", ["kaynak"])
    op.create_index("ix_ingestion_logs_status", "ingestion_logs", ["status"])

    # ── tsvector auto-update trigger ───────────────────────────────────
    op.execute("""
        CREATE OR REPLACE FUNCTION decisions_search_vector_update() RETURNS trigger AS $$
        BEGIN
            NEW.search_vector :=
                setweight(to_tsvector('simple', coalesce(NEW.mahkeme, '')), 'A') ||
                setweight(to_tsvector('simple', coalesce(NEW.daire, '')), 'A') ||
                setweight(to_tsvector('simple', coalesce(NEW.esas_no, '')), 'A') ||
                setweight(to_tsvector('simple', coalesce(NEW.karar_no, '')), 'A') ||
                setweight(to_tsvector('simple', coalesce(NEW.cleaned_text, NEW.raw_content, '')), 'B');
            RETURN NEW;
        END
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        CREATE TRIGGER trig_decisions_search_vector
        BEFORE INSERT OR UPDATE OF mahkeme, daire, esas_no, karar_no, raw_content, cleaned_text
        ON decisions
        FOR EACH ROW
        EXECUTE FUNCTION decisions_search_vector_update();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trig_decisions_search_vector ON decisions")
    op.execute("DROP FUNCTION IF EXISTS decisions_search_vector_update()")
    op.drop_table("ingestion_logs")
    op.drop_table("decisions")
