"""Add case_events table and event-based deadline fields.

Revision ID: 001_case_events
Revises:
Create Date: 2026-03-24
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "001_case_events"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create case_events table
    op.create_table(
        "case_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "case_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("cases.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("event_date", sa.Date(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_case_events_case_id", "case_events", ["case_id"])

    # Add new columns to deadlines table
    op.add_column(
        "deadlines",
        sa.Column(
            "event_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("case_events.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "deadlines",
        sa.Column("original_date", sa.Date(), nullable=True),
    )
    op.add_column(
        "deadlines",
        sa.Column(
            "is_manual_override", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
    )
    op.add_column(
        "deadlines",
        sa.Column("override_reason", sa.String(500), nullable=True),
    )
    op.add_column(
        "deadlines",
        sa.Column(
            "override_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "deadlines",
        sa.Column("override_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "deadlines",
        sa.Column("law_reference", sa.String(200), nullable=True),
    )
    op.add_column(
        "deadlines",
        sa.Column("duration_text", sa.String(100), nullable=True),
    )
    op.add_column(
        "deadlines",
        sa.Column("calculation_detail", sa.Text(), nullable=True),
    )
    op.create_index("ix_deadlines_event_id", "deadlines", ["event_id"])


def downgrade() -> None:
    op.drop_index("ix_deadlines_event_id", table_name="deadlines")
    op.drop_column("deadlines", "calculation_detail")
    op.drop_column("deadlines", "duration_text")
    op.drop_column("deadlines", "law_reference")
    op.drop_column("deadlines", "override_at")
    op.drop_column("deadlines", "override_by")
    op.drop_column("deadlines", "override_reason")
    op.drop_column("deadlines", "is_manual_override")
    op.drop_column("deadlines", "original_date")
    op.drop_column("deadlines", "event_id")
    op.drop_index("ix_case_events_case_id", table_name="case_events")
    op.drop_table("case_events")
