"""daily progress table

Revision ID: 20260328_0835
Revises: 20260328_0800
Create Date: 2026-03-28 08:35:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260328_0835"
down_revision = "20260328_0800"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "daily_progress",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("missions_completed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("xp_earned", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("streak_day", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("user_id", "day", name="uq_daily_progress"),
    )
    op.create_index("ix_daily_progress_user_id", "daily_progress", ["user_id"])
    op.create_index("ix_daily_progress_day", "daily_progress", ["day"])


def downgrade():
    op.drop_index("ix_daily_progress_day", table_name="daily_progress")
    op.drop_index("ix_daily_progress_user_id", table_name="daily_progress")
    op.drop_table("daily_progress")

