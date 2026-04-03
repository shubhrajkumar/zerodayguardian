import uuid
from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import JSON
from sqlalchemy.sql import func
from db import Base

JSON_TYPE = JSONB().with_variant(JSON, "sqlite")


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    external_id = Column(String(128), unique=True, nullable=True)
    email = Column(String(255), unique=True, nullable=False)
    name = Column(String(120), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class UserProfile(Base):
    __tablename__ = "user_profiles"

    user_id = Column(String(36), ForeignKey("users.id"), primary_key=True)
    timezone = Column(String(64), nullable=True)
    locale = Column(String(16), nullable=True)
    avatar_url = Column(Text, nullable=True)
    bio = Column(Text, nullable=True)
    preferences = Column(JSON_TYPE, nullable=False, default=dict)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    refresh_token_hash = Column(String(255), nullable=False)
    ip = Column(String(64), nullable=True)
    user_agent = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)


class ScanReport(Base):
    __tablename__ = "scan_reports"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    target_url = Column(Text, nullable=False)
    final_url = Column(Text, nullable=True)
    status_code = Column(String(12), nullable=True)
    score = Column(Float, nullable=False, default=0.0)
    summary = Column(Text, nullable=True)
    findings = Column(JSON_TYPE, nullable=False, default=list)
    headers = Column(JSON_TYPE, nullable=True)
    latency_ms = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ThreatEvent(Base):
    __tablename__ = "threat_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    input_metrics = Column(JSON_TYPE, nullable=False, default=dict)
    risk_level = Column(String(16), nullable=False, default="low")
    reasons = Column(JSON_TYPE, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class UserEvent(Base):
    __tablename__ = "user_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    event_type = Column(String(64), nullable=False, index=True)
    surface = Column(String(64), nullable=False, index=True)
    target = Column(Text, nullable=True)
    legacy_metadata = Column("metadata", JSON_TYPE, nullable=False, default=dict)
    event_metadata = Column(JSON_TYPE, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class GrowthReferral(Base):
    __tablename__ = "growth_referrals"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    referral_code = Column(String(64), nullable=False, unique=True, index=True)
    invite_count = Column(Integer, nullable=False, default=0)
    signup_count = Column(Integer, nullable=False, default=0)
    conversion_count = Column(Integer, nullable=False, default=0)
    reward_points = Column(Integer, nullable=False, default=0)
    last_invite_at = Column(DateTime(timezone=True), nullable=True)
    last_conversion_at = Column(DateTime(timezone=True), nullable=True)
    referral_metadata = Column(JSON_TYPE, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), index=True)


class GrowthInsightShare(Base):
    __tablename__ = "growth_insight_shares"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    insight_key = Column(String(120), nullable=False, index=True)
    share_channel = Column(String(64), nullable=False, default="copy")
    share_title = Column(String(200), nullable=False)
    share_description = Column(Text, nullable=True)
    slug = Column(String(180), nullable=False, index=True)
    share_count = Column(Integer, nullable=False, default=0)
    click_count = Column(Integer, nullable=False, default=0)
    conversion_count = Column(Integer, nullable=False, default=0)
    meta = Column(JSON_TYPE, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (UniqueConstraint("user_id", "insight_key", name="uq_growth_insight_user_key"),)


class GrowthNotificationPreference(Base):
    __tablename__ = "growth_notification_preferences"

    user_id = Column(String(36), ForeignKey("users.id"), primary_key=True)
    email_enabled = Column(Integer, nullable=False, default=1)
    push_enabled = Column(Integer, nullable=False, default=1)
    streak_alerts = Column(Integer, nullable=False, default=1)
    referral_alerts = Column(Integer, nullable=False, default=1)
    digest_enabled = Column(Integer, nullable=False, default=1)
    preferred_window = Column(String(32), nullable=False, default="18:00-20:00")
    quiet_hours = Column(String(32), nullable=False, default="22:00-07:00")
    timezone = Column(String(64), nullable=False, default="UTC")
    preference_metadata = Column(JSON_TYPE, nullable=False, default=dict)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class GrowthDebugEvent(Base):
    __tablename__ = "growth_debug_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    request_id = Column(String(96), nullable=False, index=True)
    stage = Column(String(64), nullable=False, index=True)
    level = Column(String(16), nullable=False, default="info")
    message = Column(Text, nullable=False)
    payload = Column(JSON_TYPE, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    __table_args__ = (Index("ix_growth_debug_user_created", "user_id", "created_at"),)


class LearningPath(Base):
    __tablename__ = "learning_paths"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    slug = Column(String(160), unique=True, nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    difficulty = Column(String(32), nullable=True)
    track = Column(String(64), nullable=True)
    version = Column(Integer, nullable=False, default=1)
    is_active = Column(Integer, nullable=False, default=1, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PathModule(Base):
    __tablename__ = "path_modules"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    path_id = Column(String(36), ForeignKey("learning_paths.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    summary = Column(Text, nullable=True)
    order_index = Column(Integer, nullable=False, default=0)
    estimated_minutes = Column(Integer, nullable=True)
    is_active = Column(Integer, nullable=False, default=1, index=True)

    __table_args__ = (Index("ix_path_modules_path_order", "path_id", "order_index"),)


class ModuleLesson(Base):
    __tablename__ = "module_lessons"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    module_id = Column(String(36), ForeignKey("path_modules.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    content_ref = Column(Text, nullable=True)
    lesson_type = Column(String(64), nullable=True)
    order_index = Column(Integer, nullable=False, default=0)
    estimated_minutes = Column(Integer, nullable=True)
    is_active = Column(Integer, nullable=False, default=1, index=True)

    __table_args__ = (Index("ix_module_lessons_module_order", "module_id", "order_index"),)


class UserPathEnrollment(Base):
    __tablename__ = "user_path_enrollments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    path_id = Column(String(36), ForeignKey("learning_paths.id"), nullable=False, index=True)
    status = Column(String(24), nullable=False, default="active")
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    last_activity_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (UniqueConstraint("user_id", "path_id", name="uq_user_path"),)


class UserModuleProgress(Base):
    __tablename__ = "user_module_progress"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    module_id = Column(String(36), ForeignKey("path_modules.id"), nullable=False, index=True)
    progress_pct = Column(Float, nullable=False, default=0.0)
    status = Column(String(24), nullable=False, default="in_progress")
    last_activity_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (UniqueConstraint("user_id", "module_id", name="uq_user_module"),)


class UserLessonProgress(Base):
    __tablename__ = "user_lesson_progress"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    lesson_id = Column(String(36), ForeignKey("module_lessons.id"), nullable=False, index=True)
    status = Column(String(24), nullable=False, default="started")
    score = Column(Float, nullable=True)
    attempts = Column(Integer, nullable=False, default=0)
    last_activity_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (UniqueConstraint("user_id", "lesson_id", name="uq_user_lesson"),)


class SkillGraphNode(Base):
    __tablename__ = "skill_graph_nodes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    key = Column(String(120), unique=True, nullable=False)
    label = Column(String(200), nullable=False)
    category = Column(String(120), nullable=True)
    version = Column(Integer, nullable=False, default=1)


class UserSkillScore(Base):
    __tablename__ = "user_skill_scores"

    user_id = Column(String(36), ForeignKey("users.id"), primary_key=True)
    skill_id = Column(String(36), ForeignKey("skill_graph_nodes.id"), primary_key=True)
    score = Column(Float, nullable=False, default=0.0)
    confidence = Column(Float, nullable=False, default=0.5)
    last_assessed_at = Column(DateTime(timezone=True), nullable=True, index=True)

    __table_args__ = (Index("ix_user_skill_last", "user_id", "last_assessed_at"),)


class RewardsCatalog(Base):
    __tablename__ = "rewards_catalog"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    reward_type = Column(String(32), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    icon = Column(String(200), nullable=True)
    points = Column(Integer, nullable=False, default=0)
    is_active = Column(Integer, nullable=False, default=1, index=True)


class UserReward(Base):
    __tablename__ = "user_rewards"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    reward_id = Column(String(36), ForeignKey("rewards_catalog.id"), nullable=False)
    source = Column(String(64), nullable=True)
    awarded_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    __table_args__ = (Index("ix_user_rewards_user_awarded", "user_id", "awarded_at"),)


class UserXpEvent(Base):
    __tablename__ = "user_xp_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    source = Column(String(64), nullable=True)
    points = Column(Integer, nullable=False, default=0)
    meta = Column(JSON_TYPE, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    __table_args__ = (Index("ix_user_xp_user_created", "user_id", "created_at"),)


class UserStreak(Base):
    __tablename__ = "user_streaks"

    user_id = Column(String(36), ForeignKey("users.id"), primary_key=True)
    current_streak = Column(Integer, nullable=False, default=0)
    best_streak = Column(Integer, nullable=False, default=0)
    last_activity_date = Column(Date, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class DailyProgress(Base):
    __tablename__ = "daily_progress"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    day = Column(Date, nullable=False, index=True)
    missions_completed = Column(Integer, nullable=False, default=0)
    xp_earned = Column(Integer, nullable=False, default=0)
    streak_day = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (UniqueConstraint("user_id", "day", name="uq_daily_progress"),)


class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    reason = Column(Text, nullable=False)
    action = Column(Text, nullable=False)
    priority = Column(Integer, nullable=False, default=1)
    generated_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    source = Column(String(64), nullable=True)


class DayLabState(Base):
    __tablename__ = "day_lab_states"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    day_number = Column(Integer, nullable=False, index=True)
    current_task_index = Column(Integer, nullable=False, default=0)
    unlocked = Column(Integer, nullable=False, default=0, index=True)
    completed = Column(Integer, nullable=False, default=0, index=True)
    score = Column(Integer, nullable=False, default=0)
    xp_earned = Column(Integer, nullable=False, default=0)
    attempts = Column(Integer, nullable=False, default=0)
    completed_task_ids = Column(JSON_TYPE, nullable=False, default=list)
    terminal_log = Column(JSON_TYPE, nullable=False, default=list)
    last_feedback = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), index=True)

    __table_args__ = (
        UniqueConstraint("user_id", "day_number", name="uq_day_lab_state_user_day"),
        Index("ix_day_lab_user_day", "user_id", "day_number"),
    )


class LabMissionState(Base):
    __tablename__ = "lab_mission_states"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    lab_id = Column(String(80), nullable=False, index=True)
    score = Column(Integer, nullable=False, default=0)
    xp_earned = Column(Integer, nullable=False, default=0)
    attempts = Column(Integer, nullable=False, default=0)
    completed = Column(Integer, nullable=False, default=0)
    completed_objectives = Column(JSON_TYPE, nullable=False, default=list)
    terminal_log = Column(JSON_TYPE, nullable=False, default=list)
    last_feedback = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), index=True)

    __table_args__ = (
        UniqueConstraint("user_id", "lab_id", name="uq_lab_state_user_lab"),
        Index("ix_lab_state_user_lab", "user_id", "lab_id"),
    )
