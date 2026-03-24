"""Add firm_type column to firms table.

Supports two firm types: 'kurumsal' (corporate) and 'bireysel' (individual).

Revision ID: 003_firm_type
Revises: 002_deadline_admin
Create Date: 2026-03-24
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "003_firm_type"
down_revision = "002_deadline_admin"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "firms",
        sa.Column("firm_type", sa.String(20), nullable=False, server_default="kurumsal"),
    )


def downgrade() -> None:
    op.drop_column("firms", "firm_type")
