"""initial schema

Revision ID: 20260328_0800
Revises:
Create Date: 2026-03-28 08:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260328_0800"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("external_id", sa.String(length=128), nullable=True, unique=True),
        sa.Column("email", sa.String(length=255), nullable=False, unique=True),
        sa.Column("name", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_table(
        "user_profiles",
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("timezone", sa.String(length=64), nullable=True),
        sa.Column("locale", sa.String(length=16), nullable=True),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("preferences", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("refresh_token_hash", sa.String(length=255), nullable=False),
        sa.Column("ip", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_auth_sessions_user_id", "auth_sessions", ["user_id"])
    op.create_index("ix_auth_sessions_created_at", "auth_sessions", ["created_at"])
    op.create_index("ix_auth_sessions_expires_at", "auth_sessions", ["expires_at"])

    op.create_table(
        "scan_reports",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("target_url", sa.Text(), nullable=False),
        sa.Column("final_url", sa.Text(), nullable=True),
        sa.Column("status_code", sa.String(length=12), nullable=True),
        sa.Column("score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("findings", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("headers", sa.JSON(), nullable=True),
        sa.Column("latency_ms", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_table(
        "threat_events",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("input_metrics", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("risk_level", sa.String(length=16), nullable=False, server_default="low"),
        sa.Column("reasons", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_table(
        "user_events",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("surface", sa.String(length=64), nullable=False),
        sa.Column("target", sa.Text(), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_user_events_created_at", "user_events", ["created_at"])
    op.create_index("ix_user_events_event_type", "user_events", ["event_type"])
    op.create_index("ix_user_events_surface", "user_events", ["surface"])

    op.create_table(
        "learning_paths",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("slug", sa.String(length=160), nullable=False, unique=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("difficulty", sa.String(length=32), nullable=True),
        sa.Column("track", sa.String(length=64), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("is_active", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
    )

    op.create_table(
        "path_modules",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("path_id", sa.String(length=36), sa.ForeignKey("learning_paths.id"), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("estimated_minutes", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Integer(), nullable=False, server_default="1"),
    )
    op.create_index("ix_path_modules_path_id", "path_modules", ["path_id"])
    op.create_index("ix_path_modules_path_order", "path_modules", ["path_id", "order_index"])

    op.create_table(
        "module_lessons",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("module_id", sa.String(length=36), sa.ForeignKey("path_modules.id"), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("content_ref", sa.Text(), nullable=True),
        sa.Column("lesson_type", sa.String(length=64), nullable=True),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("estimated_minutes", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Integer(), nullable=False, server_default="1"),
    )
    op.create_index("ix_module_lessons_module_id", "module_lessons", ["module_id"])
    op.create_index("ix_module_lessons_module_order", "module_lessons", ["module_id", "order_index"])

    op.create_table(
        "user_path_enrollments",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("path_id", sa.String(length=36), sa.ForeignKey("learning_paths.id"), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="active"),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_activity_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("user_id", "path_id", name="uq_user_path"),
    )
    op.create_index("ix_user_path_enrollments_user_id", "user_path_enrollments", ["user_id"])
    op.create_index("ix_user_path_enrollments_path_id", "user_path_enrollments", ["path_id"])

    op.create_table(
        "user_module_progress",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("module_id", sa.String(length=36), sa.ForeignKey("path_modules.id"), nullable=False),
        sa.Column("progress_pct", sa.Float(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="in_progress"),
        sa.Column("last_activity_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("user_id", "module_id", name="uq_user_module"),
    )
    op.create_index("ix_user_module_progress_user_id", "user_module_progress", ["user_id"])
    op.create_index("ix_user_module_progress_module_id", "user_module_progress", ["module_id"])

    op.create_table(
        "user_lesson_progress",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("lesson_id", sa.String(length=36), sa.ForeignKey("module_lessons.id"), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="started"),
        sa.Column("score", sa.Float(), nullable=True),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_activity_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("user_id", "lesson_id", name="uq_user_lesson"),
    )
    op.create_index("ix_user_lesson_progress_user_id", "user_lesson_progress", ["user_id"])
    op.create_index("ix_user_lesson_progress_lesson_id", "user_lesson_progress", ["lesson_id"])

    op.create_table(
        "skill_graph_nodes",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("key", sa.String(length=120), nullable=False, unique=True),
        sa.Column("label", sa.String(length=200), nullable=False),
        sa.Column("category", sa.String(length=120), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    )

    op.create_table(
        "user_skill_scores",
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("skill_id", sa.String(length=36), sa.ForeignKey("skill_graph_nodes.id"), primary_key=True),
        sa.Column("score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0.5"),
        sa.Column("last_assessed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_user_skill_last", "user_skill_scores", ["user_id", "last_assessed_at"])

    op.create_table(
        "rewards_catalog",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("reward_type", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("icon", sa.String(length=200), nullable=True),
        sa.Column("points", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Integer(), nullable=False, server_default="1"),
    )
    op.create_index("ix_rewards_catalog_is_active", "rewards_catalog", ["is_active"])

    op.create_table(
        "user_rewards",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("reward_id", sa.String(length=36), sa.ForeignKey("rewards_catalog.id"), nullable=False),
        sa.Column("source", sa.String(length=64), nullable=True),
        sa.Column("awarded_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_user_rewards_user_id", "user_rewards", ["user_id"])
    op.create_index("ix_user_rewards_user_awarded", "user_rewards", ["user_id", "awarded_at"])

    op.create_table(
        "user_xp_events",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("source", sa.String(length=64), nullable=True),
        sa.Column("points", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("meta", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_user_xp_user_created", "user_xp_events", ["user_id", "created_at"])

    op.create_table(
        "user_streaks",
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("current_streak", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("best_streak", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_activity_date", sa.Date(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
    )

    op.create_table(
        "recommendations",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source", sa.String(length=64), nullable=True),
    )
    op.create_index("ix_recommendations_user_id", "recommendations", ["user_id"])
    op.create_index("ix_recommendations_generated_at", "recommendations", ["generated_at"])


def downgrade():
    op.drop_index("ix_recommendations_generated_at", table_name="recommendations")
    op.drop_index("ix_recommendations_user_id", table_name="recommendations")
    op.drop_table("recommendations")
    op.drop_table("user_streaks")
    op.drop_index("ix_user_xp_user_created", table_name="user_xp_events")
    op.drop_table("user_xp_events")
    op.drop_index("ix_user_rewards_user_awarded", table_name="user_rewards")
    op.drop_index("ix_user_rewards_user_id", table_name="user_rewards")
    op.drop_table("user_rewards")
    op.drop_index("ix_rewards_catalog_is_active", table_name="rewards_catalog")
    op.drop_table("rewards_catalog")
    op.drop_index("ix_user_skill_last", table_name="user_skill_scores")
    op.drop_table("user_skill_scores")
    op.drop_table("skill_graph_nodes")
    op.drop_index("ix_user_lesson_progress_lesson_id", table_name="user_lesson_progress")
    op.drop_index("ix_user_lesson_progress_user_id", table_name="user_lesson_progress")
    op.drop_table("user_lesson_progress")
    op.drop_index("ix_user_module_progress_module_id", table_name="user_module_progress")
    op.drop_index("ix_user_module_progress_user_id", table_name="user_module_progress")
    op.drop_table("user_module_progress")
    op.drop_index("ix_user_path_enrollments_path_id", table_name="user_path_enrollments")
    op.drop_index("ix_user_path_enrollments_user_id", table_name="user_path_enrollments")
    op.drop_table("user_path_enrollments")
    op.drop_index("ix_module_lessons_module_order", table_name="module_lessons")
    op.drop_index("ix_module_lessons_module_id", table_name="module_lessons")
    op.drop_table("module_lessons")
    op.drop_index("ix_path_modules_path_order", table_name="path_modules")
    op.drop_index("ix_path_modules_path_id", table_name="path_modules")
    op.drop_table("path_modules")
    op.drop_table("learning_paths")
    op.drop_index("ix_user_events_surface", table_name="user_events")
    op.drop_index("ix_user_events_event_type", table_name="user_events")
    op.drop_index("ix_user_events_created_at", table_name="user_events")
    op.drop_table("user_events")
    op.drop_table("threat_events")
    op.drop_table("scan_reports")
    op.drop_index("ix_auth_sessions_expires_at", table_name="auth_sessions")
    op.drop_index("ix_auth_sessions_created_at", table_name="auth_sessions")
    op.drop_index("ix_auth_sessions_user_id", table_name="auth_sessions")
    op.drop_table("auth_sessions")
    op.drop_table("user_profiles")
    op.drop_table("users")
