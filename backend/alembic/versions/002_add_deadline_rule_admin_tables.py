"""Add admin-configurable deadline rule tables.

event_type_definitions, deadline_rule_definitions, public_holidays, judicial_recesses

Revision ID: 002_deadline_admin
Revises: 001_case_events
Create Date: 2026-03-24
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "002_deadline_admin"
down_revision = "001_case_events"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── event_type_definitions ────────────────────────────────────────────
    op.create_table(
        "event_type_definitions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(100), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_event_type_definitions_slug", "event_type_definitions", ["slug"], unique=True)
    op.create_index("ix_event_type_definitions_category", "event_type_definitions", ["category"])

    # ── deadline_rule_definitions ─────────────────────────────────────────
    op.create_table(
        "deadline_rule_definitions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "event_type_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("event_type_definitions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("law_reference", sa.String(200), nullable=True),
        sa.Column("law_text", sa.Text(), nullable=True),
        sa.Column("duration_value", sa.Integer(), nullable=False),
        sa.Column("duration_unit", sa.String(20), nullable=False),
        sa.Column("duration_display", sa.String(100), nullable=True),
        sa.Column("deadline_type", sa.String(50), nullable=False),
        sa.Column(
            "affected_by_adli_tatil",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "affected_by_holidays",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_deadline_rule_definitions_event_type_id",
        "deadline_rule_definitions",
        ["event_type_id"],
    )

    # ── public_holidays ───────────────────────────────────────────────────
    op.create_table(
        "public_holidays",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("is_half_day", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "holiday_type",
            sa.String(50),
            nullable=False,
            server_default=sa.text("'resmi'"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_public_holidays_date", "public_holidays", ["date"])
    op.create_index("ix_public_holidays_year", "public_holidays", ["year"])
    op.create_index("ix_public_holidays_year_date", "public_holidays", ["year", "date"])

    # ── judicial_recesses ─────────────────────────────────────────────────
    op.create_table(
        "judicial_recesses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column(
            "extension_days_hukuk",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("7"),
        ),
        sa.Column(
            "extension_days_ceza",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("3"),
        ),
        sa.Column(
            "extension_days_idari",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("7"),
        ),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_judicial_recesses_year", "judicial_recesses", ["year"], unique=True)


def downgrade() -> None:
    op.drop_table("judicial_recesses")
    op.drop_table("public_holidays")
    op.drop_table("deadline_rule_definitions")
    op.drop_table("event_type_definitions")
