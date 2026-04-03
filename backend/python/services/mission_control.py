from __future__ import annotations

from datetime import date, datetime, time, timedelta
import hashlib
from typing import Any

from sqlalchemy.orm import Session

from models import (
    DayLabState,
    GrowthDebugEvent,
    GrowthInsightShare,
    GrowthNotificationPreference,
    GrowthReferral,
    LabMissionState,
    UserEvent,
    UserStreak,
    UserXpEvent,
)
from services.day_labs import PROGRAM_SEEDS
from services.recommendations import build_adaptive_learning_recommendations, build_recommendations
from services.sandbox_labs import build_daily_missions, build_weekly_missions


ACTION_REWARDS = {
    "mentor_open": 12,
    "recommendation_reviewed": 10,
    "learn_track_started": 14,
    "learn_track_completed": 18,
    "mission_hidden_discovered": 0,
    "mission_hidden_completed": 45,
    "command_center_opened": 8,
    "insight_shared": 26,
    "referral_invite_sent": 30,
    "referral_signup_completed": 120,
    "notification_opened": 6,
    "notification_preferences_updated": 0,
}

TASK_REWARD_MAP = {
    "daily-program": 40,
    "daily-lab": 36,
    "daily-recommendation": 18,
    "daily-mentor": 16,
}


def _today_bounds() -> tuple[datetime, datetime]:
    today = date.today()
    start = datetime.combine(today, time.min)
    end = start + timedelta(days=1)
    return start, end


def _today_events(db: Session, user_id: str) -> list[UserEvent]:
    start, end = _today_bounds()
    return (
        db.query(UserEvent)
        .filter(UserEvent.user_id == user_id, UserEvent.created_at >= start, UserEvent.created_at < end)
        .order_by(UserEvent.created_at.desc())
        .all()
    )


def _today_xp(db: Session, user_id: str) -> list[UserXpEvent]:
    start, end = _today_bounds()
    return (
        db.query(UserXpEvent)
        .filter(UserXpEvent.user_id == user_id, UserXpEvent.created_at >= start, UserXpEvent.created_at < end)
        .order_by(UserXpEvent.created_at.desc())
        .all()
    )


def _event_exists_today(db: Session, user_id: str, event_type: str, target: str | None = None) -> bool:
    start, end = _today_bounds()
    query = db.query(UserEvent).filter(
        UserEvent.user_id == user_id,
        UserEvent.event_type == event_type,
        UserEvent.created_at >= start,
        UserEvent.created_at < end,
    )
    if target is not None:
        query = query.filter(UserEvent.target == target)
    return db.query(query.exists()).scalar()


def _get_streak(db: Session, user_id: str) -> UserStreak | None:
    return db.query(UserStreak).filter(UserStreak.user_id == user_id).first()


def _recent_rewards(db: Session, user_id: str) -> list[dict[str, Any]]:
    xp_rows = (
        db.query(UserXpEvent)
        .filter(UserXpEvent.user_id == user_id)
        .order_by(UserXpEvent.created_at.desc())
        .limit(10)
        .all()
    )
    rewards: list[dict[str, Any]] = []
    for row in xp_rows:
        meta = row.meta if isinstance(row.meta, dict) else {}
        source = str(row.source or "xp").replace("_", " ").title()
        label = meta.get("title") or source
        detail = meta.get("detail") or f"+{int(row.points or 0)} XP awarded through {source.lower()}."
        tone = "badge" if "badge" in str(label).lower() else "streak" if "mission" in str(source).lower() else "xp"
        awarded_at = int(row.created_at.timestamp() * 1000) if row.created_at else int(datetime.utcnow().timestamp() * 1000)
        rewards.append(
            {
                "id": row.id,
                "label": str(label),
                "detail": str(detail),
                "xp": int(row.points or 0),
                "tone": tone,
                "awarded_at": awarded_at,
            }
        )
    return rewards


def _debug_log(db: Session, user_id: str | None, request_id: str, stage: str, message: str, level: str = "info", payload: dict[str, Any] | None = None) -> None:
    db.add(
        GrowthDebugEvent(
            user_id=user_id,
            request_id=request_id,
            stage=stage,
            level=level,
            message=message,
            payload=payload or {},
        )
    )


def _recent_debug_events(db: Session, user_id: str | None, limit: int = 8) -> list[dict[str, Any]]:
    if not user_id:
        return []
    rows = (
        db.query(GrowthDebugEvent)
        .filter(GrowthDebugEvent.user_id == user_id)
        .order_by(GrowthDebugEvent.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": row.id,
            "stage": row.stage,
            "level": row.level,
            "message": row.message,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "payload": row.payload if isinstance(row.payload, dict) else {},
        }
        for row in rows
    ]


def _ensure_referral(db: Session, user_id: str) -> GrowthReferral:
    row = db.query(GrowthReferral).filter(GrowthReferral.user_id == user_id).first()
    if row:
        return row
    digest = hashlib.sha1(user_id.encode("utf-8")).hexdigest()[:10].upper()
    row = GrowthReferral(
        user_id=user_id,
        referral_code=f"ZDG-{digest}",
        referral_metadata={"engine": "viral_growth_v1"},
    )
    db.add(row)
    db.flush()
    return row


def _ensure_notification_preferences(db: Session, user_id: str) -> GrowthNotificationPreference:
    row = db.query(GrowthNotificationPreference).filter(GrowthNotificationPreference.user_id == user_id).first()
    if row:
        return row
    row = GrowthNotificationPreference(user_id=user_id)
    db.add(row)
    db.flush()
    return row


def _ensure_share_insights(db: Session, user_id: str, completed_days: int, completed_sandbox_labs: int, streak: int, total_points: int) -> list[GrowthInsightShare]:
    templates = [
        {
            "insight_key": "operator_momentum",
            "share_title": "Operator momentum is compounding",
            "share_description": "A crisp summary of streak, XP velocity, and the next mission unlock.",
            "slug": "operator-momentum",
            "meta": {
                "proof_points": [
                    f"{streak}-day active streak",
                    f"{total_points} total XP earned",
                    f"Day {max(1, completed_days + 1)} ready to validate",
                ]
            },
        },
        {
            "insight_key": "range_performance",
            "share_title": "Sandbox performance is turning into visible skill",
            "share_description": "Shows how many missions were cleared and why that matters.",
            "slug": "range-performance",
            "meta": {
                "proof_points": [
                    f"{completed_sandbox_labs} sandbox clears",
                    "objective-based scoring active",
                    "verified mission rewards tracked server-side",
                ]
            },
        },
        {
            "insight_key": "referral_unlock",
            "share_title": "Invite another operator into the loop",
            "share_description": "Referral CTA paired with a shareable proof summary.",
            "slug": "referral-unlock",
            "meta": {
                "proof_points": [
                    "shareable progress recap",
                    "referral reward ladder enabled",
                    "streak-safe reactivation reminders",
                ]
            },
        },
    ]
    rows: list[GrowthInsightShare] = []
    for template in templates:
        row = (
            db.query(GrowthInsightShare)
            .filter(GrowthInsightShare.user_id == user_id, GrowthInsightShare.insight_key == template["insight_key"])
            .first()
        )
        if not row:
            row = GrowthInsightShare(
                user_id=user_id,
                insight_key=template["insight_key"],
                share_channel="copy",
                share_title=template["share_title"],
                share_description=template["share_description"],
                slug=template["slug"],
                meta=template["meta"],
            )
            db.add(row)
            db.flush()
        rows.append(row)
    return rows


def _computed_badges(completed_days: int, completed_sandbox_labs: int, streak: int, total_points: int) -> list[dict[str, Any]]:
    badges: list[dict[str, Any]] = []
    if total_points >= 1:
        badges.append({"id": "first-spark", "title": "First Spark", "detail": "Earned your first real XP in the platform.", "icon": "spark"})
    if streak >= 3:
        badges.append({"id": "streak-keeper", "title": "Streak Keeper", "detail": "Protected a 3-day learning streak.", "icon": "flame"})
    if completed_days >= 1:
        badges.append({"id": "rookie-operator", "title": "Rookie Operator", "detail": "Validated the first day of the program.", "icon": "shield"})
    if completed_sandbox_labs >= 2:
        badges.append({"id": "range-runner", "title": "Range Runner", "detail": "Closed multiple sandbox missions with real scoring.", "icon": "crown"})
    if total_points >= 240:
        badges.append({"id": "mission-architect", "title": "Mission Architect", "detail": "Built sustained momentum across labs and missions.", "icon": "crown"})
    return badges


def _hidden_challenges(
    db: Session,
    user_id: str,
    completed_days_today: int,
    completed_sandbox_today: int,
    streak: int,
) -> list[dict[str, Any]]:
    mentor_opened = _event_exists_today(db, user_id, "mission_action", "mentor_open")
    shadow_completed = _event_exists_today(db, user_id, "mission_hidden_completed", "shadow-brief")
    operator_completed = _event_exists_today(db, user_id, "mission_hidden_completed", "operator-override")
    shadow_discovered = streak >= 2 or mentor_opened
    shadow_unlocked = shadow_discovered and mentor_opened
    operator_discovered = completed_days_today >= 1 or completed_sandbox_today >= 1
    operator_unlocked = completed_days_today >= 1 and completed_sandbox_today >= 1
    return [
        {
            "id": "shadow-brief",
            "title": "Shadow Brief",
            "detail": "Open the mentor after you build a real streak to reveal a hidden mission path.",
            "reward": 60,
            "discovered": shadow_discovered,
            "unlocked": shadow_unlocked,
            "completed": shadow_completed,
        },
        {
            "id": "operator-override",
            "title": "Operator Override",
            "detail": "Complete both a day lab and a sandbox mission in the same day to unlock an elite reward.",
            "reward": 90,
            "discovered": operator_discovered,
            "unlocked": operator_unlocked,
            "completed": operator_completed,
        },
    ]


def _next_program_day(db: Session, user_id: str) -> int:
    rows = db.query(DayLabState).filter(DayLabState.user_id == user_id).order_by(DayLabState.day_number.asc()).all()
    for seed in PROGRAM_SEEDS:
        row = next((item for item in rows if item.day_number == seed.day), None)
        if not row or not bool(row.completed):
            return seed.day
    return 60


def _rails(completed_days: int, completed_sandbox_labs: int, total_points: int, next_day: int) -> list[dict[str, Any]]:
    return [
        {
            "id": "foundation",
            "level": "Beginner",
            "title": "Foundation Defender",
            "objective": "Lock in operator basics through validated day labs and evidence-driven explanations.",
            "mode": "Guided day labs",
            "payoff": "Build real confidence through execute, validate, score, and unlock loops.",
            "progress_label": f"Day {next_day} next",
            "route": f"/program/day/{next_day}",
        },
        {
            "id": "investigation",
            "level": "Intermediate",
            "title": "Threat Investigator",
            "objective": "Use recommendations and verified intel to pick higher-value next actions.",
            "mode": "Recommendations + live intel",
            "payoff": "Turn signals into judgment instead of browsing disconnected surfaces.",
            "progress_label": f"{max(1, completed_days)} validated days",
            "route": "/learn",
        },
        {
            "id": "range",
            "level": "Advanced",
            "title": "Mission Commander",
            "objective": "Pressure-test decision quality inside scored sandbox missions.",
            "mode": "Execute and validate",
            "payoff": "Train with real objective completion and mission rewards.",
            "progress_label": f"{completed_sandbox_labs} sandbox clears",
            "route": "/lab",
        },
        {
            "id": "pro",
            "level": "Pro",
            "title": "Elite Operator Loop",
            "objective": "Move smoothly between labs, guidance, recommendations, and live workspaces.",
            "mode": "Unified command center",
            "payoff": "Everything points toward one obvious next move.",
            "progress_label": f"{total_points} XP banked",
            "route": "/dashboard",
        },
    ]


def _notification_suggestions(
    streak: int,
    completed_task_count: int,
    challenge: dict[str, Any],
    referral: GrowthReferral,
    preferences: GrowthNotificationPreference,
) -> list[dict[str, Any]]:
    suggestions = [
        {
            "id": "streak-save",
            "channel": "push" if bool(preferences.push_enabled) else "email",
            "title": "Protect the streak before reset",
            "detail": f"Send a reminder while the user still has {max(0, challenge['goal'] - challenge['progress'])} high-value action slots left today.",
            "send_window": str(preferences.preferred_window),
            "enabled": bool(preferences.streak_alerts),
            "priority": "high" if streak >= 2 and completed_task_count < challenge["goal"] else "medium",
            "trigger": "daily_loop_incomplete",
        },
        {
            "id": "referral-nudge",
            "channel": "email" if bool(preferences.email_enabled) else "push",
            "title": "Turn momentum into a referral invite",
            "detail": f"Nudge when progress is visible and only {max(0, 3 - int(referral.invite_count or 0))} invite actions remain before the next reward unlock.",
            "send_window": str(preferences.preferred_window),
            "enabled": bool(preferences.referral_alerts),
            "priority": "medium",
            "trigger": "shareable_progress_detected",
        },
        {
            "id": "weekly-digest",
            "channel": "email",
            "title": "Ship a compact weekly operator digest",
            "detail": "Bundle streak, strongest win, and one obvious next mission into a fast reactivation summary.",
            "send_window": "Sun 18:00",
            "enabled": bool(preferences.digest_enabled),
            "priority": "low",
            "trigger": "weekly_digest_window",
        },
    ]
    return suggestions


def _growth_badges(referral: GrowthReferral, share_rows: list[GrowthInsightShare], streak: int, total_points: int, base_badges: list[dict[str, Any]]) -> list[dict[str, Any]]:
    badges = list(base_badges)
    total_shares = sum(int(row.share_count or 0) for row in share_rows)
    if total_shares >= 1:
        badges.append({"id": "signal-broadcaster", "title": "Signal Broadcaster", "detail": "Published your first shareable operator insight.", "icon": "spark"})
    if int(referral.invite_count or 0) >= 3:
        badges.append({"id": "network-builder", "title": "Network Builder", "detail": "Sent enough referral invites to activate the social loop.", "icon": "crown"})
    if int(referral.conversion_count or 0) >= 1:
        badges.append({"id": "trusted-invite", "title": "Trusted Invite", "detail": "Converted your first referred operator into an active user.", "icon": "shield"})
    if streak >= 7 and total_points >= 300:
        badges.append({"id": "magnetic-operator", "title": "Magnetic Operator", "detail": "Combined visible streak pressure with persistent XP growth.", "icon": "flame"})
    return badges


def _shareable_insights(
    share_rows: list[GrowthInsightShare],
    streak: int,
    total_points: int,
    next_day: int,
    completed_sandbox_labs: int,
) -> list[dict[str, Any]]:
    cards: list[dict[str, Any]] = []
    for row in share_rows:
        proof_points = row.meta.get("proof_points", []) if isinstance(row.meta, dict) else []
        if row.insight_key == "operator_momentum":
            description = f"{streak}-day streak, {total_points} XP earned, and Day {next_day} already queued."
        elif row.insight_key == "range_performance":
            description = f"{completed_sandbox_labs} sandbox clears prove the loop is not just cosmetic."
        else:
            description = "Share a crisp recap and invite another operator into the workflow."
        cards.append(
            {
                "id": row.id,
                "title": row.share_title,
                "description": description,
                "cta": "Copy share card",
                "share_text": f"{row.share_title} | {description} | ZeroDay Guardian keeps the next mission obvious.",
                "seo_title": f"{row.share_title} | ZeroDay Guardian",
                "seo_description": description,
                "slug": row.slug,
                "trend": "up" if int(row.share_count or 0) > 0 else "ready",
                "proof_points": [str(item) for item in proof_points][:3],
            }
        )
    return cards


def _safe_scalar(fn: Any, fallback: Any) -> Any:
    try:
        return fn()
    except Exception:
        return fallback


def build_mission_control_fallback(
    db: Session,
    user_id: str,
    request_id: str = "mission-control-fallback",
    reason: str = "Mission control degraded gracefully due to a backend issue.",
) -> dict[str, Any]:
    streak = int(_safe_scalar(lambda: (_get_streak(db, user_id).current_streak if _get_streak(db, user_id) else 0), 0))
    best_streak = int(_safe_scalar(lambda: (_get_streak(db, user_id).best_streak if _get_streak(db, user_id) else 0), 0))
    total_points = int(_safe_scalar(lambda: sum(int(row.points or 0) for row in db.query(UserXpEvent).filter(UserXpEvent.user_id == user_id).all()), 0))
    completed_days = int(_safe_scalar(lambda: db.query(DayLabState).filter(DayLabState.user_id == user_id, DayLabState.completed == 1).count(), 0))
    completed_sandbox_labs = int(_safe_scalar(lambda: db.query(LabMissionState).filter(LabMissionState.user_id == user_id, LabMissionState.completed == 1).count(), 0))
    next_day = int(_safe_scalar(lambda: _next_program_day(db, user_id), 1))
    preferences = _safe_scalar(lambda: _ensure_notification_preferences(db, user_id), None)
    referral = _safe_scalar(lambda: _ensure_referral(db, user_id), None)

    return {
        "tasks": [
            {
                "id": "recover-program",
                "title": f"Resume Day {next_day}",
                "detail": "Your progress is safe. Re-open the current lab while the advisory systems recover.",
                "reward": 20,
                "action_type": "program_day_complete",
                "completed": False,
                "route": f"/program/day/{next_day}",
                "cta_label": "Open day lab",
            },
            {
                "id": "recover-dashboard",
                "title": "Refresh your workspace",
                "detail": "Try a clean refresh to restore live recommendations and notifications.",
                "reward": 0,
                "action_type": "command_center_opened",
                "completed": False,
                "route": "/dashboard",
                "cta_label": "Refresh dashboard",
            },
        ],
        "challenge": {
            "id": "system-recovery",
            "title": "Recovery mode",
            "detail": "Core progress is available while advanced mission-control insights reload.",
            "reward": 0,
            "goal": 1,
            "progress": 0,
            "completed": False,
        },
        "streak": streak,
        "best_streak": best_streak,
        "total_completed": completed_days + completed_sandbox_labs,
        "total_points": total_points,
        "momentum": min(100, streak * 10 + completed_days * 5 + completed_sandbox_labs * 6),
        "completed_days": completed_days,
        "completed_sandbox_labs": completed_sandbox_labs,
        "recent_rewards": [],
        "badges": _computed_badges(completed_days, completed_sandbox_labs, streak, total_points),
        "unlocked_gates": {
            "advanced_labs": completed_days >= 1 or total_points >= 40,
            "elite_program": total_points >= 220 or completed_days >= 7,
            "intel_tools": completed_days >= 1 or completed_sandbox_labs >= 1,
            "shadow_challenge": False,
        },
        "hidden_challenges": [],
        "streak_reminder": "Your streak and progression are still preserved. You can keep training while the extras recover.",
        "curiosity_trigger": "Core labs are still available. Refresh in a moment for recommendations and viral-growth systems.",
        "next_mission_hook": {
            "title": f"Resume Day {next_day}",
            "detail": "The main training path is still available.",
            "cta_label": "Continue training",
            "target": "return",
            "task_id": "recover-program",
            "route": f"/program/day/{next_day}",
        },
        "recommendations": [
            {
                "title": "Stay in the validated flow",
                "reason": "Mission-control personalization is temporarily degraded.",
                "action": "Continue with your next day lab or refresh the dashboard shortly.",
                "priority": 1,
            }
        ],
        "rails": _rails(completed_days, completed_sandbox_labs, total_points, next_day),
        "quick_actions": [
            {
                "id": "recover-program",
                "title": "Current Day Lab",
                "detail": "Open the next validated day without waiting on the advisory layer.",
                "cta": "Resume training",
                "route": f"/program/day/{next_day}",
                "action_type": "program_day_complete",
                "status": "ready",
            }
        ],
        "referral": {
            "code": getattr(referral, "referral_code", ""),
            "invite_count": int(getattr(referral, "invite_count", 0) or 0),
            "signup_count": int(getattr(referral, "signup_count", 0) or 0),
            "conversion_count": int(getattr(referral, "conversion_count", 0) or 0),
            "reward_points": int(getattr(referral, "reward_points", 0) or 0),
            "share_url": f"/auth?ref={getattr(referral, 'referral_code', '')}" if referral else "/auth",
            "headline": "Referral systems are still available, though live insight cards are temporarily paused.",
            "next_reward": "Referral bonuses return automatically once mission control fully recovers.",
            "conversion_rate": 0,
        },
        "shareable_insights": [],
        "smart_notifications": [],
        "notification_preferences": {
            "email_enabled": bool(getattr(preferences, "email_enabled", True)),
            "push_enabled": bool(getattr(preferences, "push_enabled", True)),
            "streak_alerts": bool(getattr(preferences, "streak_alerts", True)),
            "referral_alerts": bool(getattr(preferences, "referral_alerts", True)),
            "digest_enabled": bool(getattr(preferences, "digest_enabled", True)),
            "preferred_window": getattr(preferences, "preferred_window", "18:00-20:00"),
            "quiet_hours": getattr(preferences, "quiet_hours", "22:00-07:00"),
            "timezone": getattr(preferences, "timezone", "UTC"),
        },
        "debug": {
            "request_id": request_id,
            "generated_at": datetime.utcnow().isoformat(),
            "auto_retry_ready": True,
            "validation_state": "degraded",
            "error_capture": "enabled",
            "recent_events": [],
            "warnings": [reason],
        },
    }


def build_mission_control(db: Session, user_id: str, request_id: str = "mission-control", include_debug: bool = True) -> dict[str, Any]:
    streak_row = _get_streak(db, user_id)
    streak = int(streak_row.current_streak or 0) if streak_row else 0
    best_streak = int(streak_row.best_streak or 0) if streak_row else 0
    xp_events = db.query(UserXpEvent).filter(UserXpEvent.user_id == user_id).all()
    total_points = sum(int(row.points or 0) for row in xp_events)
    completed_days = db.query(DayLabState).filter(DayLabState.user_id == user_id, DayLabState.completed == 1).count()
    completed_sandbox_labs = db.query(LabMissionState).filter(LabMissionState.user_id == user_id, LabMissionState.completed == 1).count()
    next_day = _next_program_day(db, user_id)
    completed_day_today = db.query(DayLabState).filter(DayLabState.user_id == user_id, DayLabState.completed == 1, DayLabState.updated_at >= _today_bounds()[0]).count()
    completed_sandbox_today = db.query(LabMissionState).filter(LabMissionState.user_id == user_id, LabMissionState.completed == 1, LabMissionState.updated_at >= _today_bounds()[0]).count()
    recommendations, _signals = build_recommendations(db, user_id)
    adaptive = build_adaptive_learning_recommendations(db, user_id)
    referral = _ensure_referral(db, user_id)
    preferences = _ensure_notification_preferences(db, user_id)
    share_rows = _ensure_share_insights(db, user_id, completed_days, completed_sandbox_labs, streak, total_points)
    db.commit()

    tasks = [
        {
            "id": "daily-program",
            "title": f"Validate Day {next_day}",
            "detail": "Finish the current guided day and submit every task for real backend validation.",
            "reward": TASK_REWARD_MAP["daily-program"],
            "action_type": "program_day_complete",
            "completed": completed_day_today > 0,
            "route": f"/program/day/{next_day}",
            "cta_label": "Open day lab",
        },
        {
            "id": "daily-lab",
            "title": "Clear one sandbox mission",
            "detail": "Execute commands in the lab, satisfy all objectives, then close the mission to earn a real reward.",
            "reward": TASK_REWARD_MAP["daily-lab"],
            "action_type": "sandbox_mission_complete",
            "completed": completed_sandbox_today > 0,
            "route": "/lab",
            "cta_label": "Launch mission",
        },
        {
            "id": "daily-recommendation",
            "title": "Refresh your recommendations",
            "detail": "Open the adaptive guidance loop so the backend can suggest the highest-value next move.",
            "reward": TASK_REWARD_MAP["daily-recommendation"],
            "action_type": "recommendation_reviewed",
            "completed": _event_exists_today(db, user_id, "mission_action", "recommendation_reviewed"),
            "route": "/learn",
            "cta_label": "Open recommendations",
        },
        {
            "id": "daily-mentor",
            "title": "Consult the mentor",
            "detail": "Trigger mentor guidance once today so the system can refine pacing and difficulty.",
            "reward": TASK_REWARD_MAP["daily-mentor"],
            "action_type": "mentor_open",
            "completed": _event_exists_today(db, user_id, "mission_action", "mentor_open"),
            "route": "/assistant",
            "cta_label": "Open mentor",
        },
    ]
    completed_task_count = sum(1 for task in tasks if task["completed"])
    challenge = {
        "id": "daily-combo",
        "title": "Momentum Combo",
        "detail": "Complete three meaningful system actions today to unlock the combo reward.",
        "reward": 75,
        "goal": 3,
        "progress": min(3, completed_task_count),
        "completed": completed_task_count >= 3,
    }
    hidden_challenges = _hidden_challenges(db, user_id, completed_day_today, completed_sandbox_today, streak)
    badges = _growth_badges(referral, share_rows, streak, total_points, _computed_badges(completed_days, completed_sandbox_labs, streak, total_points))
    unlocked_gates = {
        "advanced_labs": streak >= 2 or total_points >= 40,
        "elite_program": total_points >= 220 or completed_days >= 7,
        "intel_tools": completed_days >= 1 or completed_sandbox_labs >= 2,
        "shadow_challenge": any(item["id"] == "shadow-brief" and item["unlocked"] for item in hidden_challenges),
    }

    momentum = min(100, completed_task_count * 22 + streak * 10 + min(28, completed_sandbox_labs * 8) + min(24, completed_days * 4))
    recent_rewards = _recent_rewards(db, user_id)

    if completed_task_count == len(tasks):
        streak_reminder = f"Perfect loop today. Return tomorrow to protect your {max(1, streak)}-day streak."
    elif streak >= 5:
        streak_reminder = f"You are on a {streak}-day run. One more completed action keeps the premium loop alive."
    elif streak >= 2:
        streak_reminder = f"Your {streak}-day streak is active. Finish one more task now so tomorrow is easier to continue."
    else:
        streak_reminder = "Start with one validated action today. The streak forms after the first real completion."

    unlocked_hidden = next((item for item in hidden_challenges if item["unlocked"] and not item["completed"]), None)
    incomplete_task = next((item for item in tasks if not item["completed"]), None)
    if unlocked_hidden:
        curiosity_trigger = f"{unlocked_hidden['title']} is live. There is extra XP waiting behind a hidden challenge."
    elif not challenge["completed"]:
        remaining = challenge["goal"] - challenge["progress"]
        curiosity_trigger = f"The combo reward unlocks after {remaining} more meaningful action{'s' if remaining != 1 else ''}."
    elif incomplete_task:
        curiosity_trigger = f"Completing {incomplete_task['title'].lower()} will sharpen tomorrow's recommendations."
    else:
        curiosity_trigger = "The daily loop is complete. Come back after reset for a fresh challenge chain."

    if incomplete_task:
        next_hook = {
            "title": incomplete_task["title"],
            "detail": incomplete_task["detail"],
            "cta_label": incomplete_task["cta_label"],
            "target": "task",
            "task_id": incomplete_task["id"],
            "route": incomplete_task["route"],
        }
    elif unlocked_hidden:
        next_hook = {
            "title": unlocked_hidden["title"],
            "detail": unlocked_hidden["detail"],
            "cta_label": f"Claim +{unlocked_hidden['reward']} XP",
            "target": "hidden",
            "task_id": unlocked_hidden["id"],
            "route": "/tools",
        }
    else:
        next_hook = {
            "title": "Return tomorrow",
            "detail": "The next mission loop unlocks after reset with fresh tasks, combo progress, and recommendations.",
            "cta_label": "Protect your streak",
            "target": "return",
            "task_id": None,
            "route": "/dashboard",
        }

    quick_actions = [
        {
            "id": "mentor",
            "title": "Adaptive Mentor",
            "detail": adaptive["recommendations"][0]["action"] if adaptive.get("recommendations") else "Open coaching tuned to your current weak skill.",
            "cta": "Open mentor",
            "route": "/assistant",
            "action_type": "mentor_open",
            "status": "completed" if _event_exists_today(db, user_id, "mission_action", "mentor_open") else "ready",
        },
        {
            "id": "program",
            "title": "Current Day Lab",
            "detail": f"Resume Day {next_day} and complete the execute to reward flow.",
            "cta": "Open day lab",
            "route": f"/program/day/{next_day}",
            "action_type": "program_day_complete",
            "status": "completed" if completed_day_today > 0 else "ready",
        },
        {
            "id": "lab",
            "title": "Sandbox Mission",
            "detail": "Run a scored sandbox mission with objective tracking and mission rewards.",
            "cta": "Launch mission",
            "route": "/lab",
            "action_type": "sandbox_mission_complete",
            "status": "completed" if completed_sandbox_today > 0 else "ready",
        },
        {
            "id": "recommendations",
            "title": "Recommendations",
            "detail": recommendations[0]["action"] if recommendations else "Refresh your recommended next move.",
            "cta": "Open guidance",
            "route": "/learn",
            "action_type": "recommendation_reviewed",
            "status": "completed" if _event_exists_today(db, user_id, "mission_action", "recommendation_reviewed") else "ready",
        },
    ]
    smart_notifications = _notification_suggestions(streak, completed_task_count, challenge, referral, preferences)
    shareable_insights = _shareable_insights(share_rows, streak, total_points, next_day, completed_sandbox_labs)
    if include_debug:
        _debug_log(
            db,
            user_id,
            request_id,
            "snapshot",
            "Mission control growth snapshot generated",
            payload={"streak": streak, "total_points": total_points, "completed_task_count": completed_task_count},
        )
        db.commit()
    referral_payload = {
        "code": referral.referral_code,
        "invite_count": int(referral.invite_count or 0),
        "signup_count": int(referral.signup_count or 0),
        "conversion_count": int(referral.conversion_count or 0),
        "reward_points": int(referral.reward_points or 0),
        "share_url": f"/auth?ref={referral.referral_code}",
        "headline": "Your momentum is portable. Turn it into invited growth.",
        "next_reward": "Next referral unlock at 3 invites or 1 conversion.",
        "conversion_rate": int(round(((int(referral.conversion_count or 0) / max(1, int(referral.invite_count or 0))) * 100))),
    }
    debug_warnings = []
    if completed_task_count == 0:
        debug_warnings.append("No growth loop actions have been completed today.")
    if not any(item["enabled"] for item in smart_notifications):
        debug_warnings.append("All notification suggestions are disabled; reactivation risk is higher.")
    debug_state = {
        "request_id": request_id,
        "generated_at": datetime.utcnow().isoformat(),
        "auto_retry_ready": True,
        "validation_state": "strict",
        "error_capture": "enabled",
        "recent_events": _recent_debug_events(db, user_id) if include_debug else [],
        "warnings": debug_warnings,
    }

    return {
        "tasks": tasks,
        "challenge": challenge,
        "streak": streak,
        "best_streak": best_streak,
        "total_completed": completed_days + completed_sandbox_labs + completed_task_count,
        "total_points": total_points,
        "momentum": momentum,
        "completed_days": completed_days,
        "completed_sandbox_labs": completed_sandbox_labs,
        "recent_rewards": recent_rewards,
        "badges": badges,
        "unlocked_gates": unlocked_gates,
        "hidden_challenges": hidden_challenges,
        "streak_reminder": streak_reminder,
        "curiosity_trigger": curiosity_trigger,
        "next_mission_hook": next_hook,
        "recommendations": recommendations,
        "rails": _rails(completed_days, completed_sandbox_labs, total_points, next_day),
        "quick_actions": quick_actions,
        "referral": referral_payload,
        "shareable_insights": shareable_insights,
        "smart_notifications": smart_notifications,
        "notification_preferences": {
            "email_enabled": bool(preferences.email_enabled),
            "push_enabled": bool(preferences.push_enabled),
            "streak_alerts": bool(preferences.streak_alerts),
            "referral_alerts": bool(preferences.referral_alerts),
            "digest_enabled": bool(preferences.digest_enabled),
            "preferred_window": preferences.preferred_window,
            "quiet_hours": preferences.quiet_hours,
            "timezone": preferences.timezone,
        },
        "debug": debug_state,
    }


def update_notification_preferences(db: Session, user_id: str, payload: dict[str, Any], request_id: str = "preferences-update") -> dict[str, Any]:
    preferences = _ensure_notification_preferences(db, user_id)
    for field in (
        "email_enabled",
        "push_enabled",
        "streak_alerts",
        "referral_alerts",
        "digest_enabled",
        "preferred_window",
        "quiet_hours",
        "timezone",
    ):
        if field in payload and payload[field] is not None:
            setattr(preferences, field, payload[field])
    _debug_log(db, user_id, request_id, "preferences", "Notification preferences updated", payload=payload)
    db.commit()
    return build_mission_control(db, user_id, request_id=request_id)


def record_mission_action(
    db: Session,
    user_id: str,
    action_type: str,
    target: str | None = None,
    metadata: dict[str, Any] | None = None,
    request_id: str = "mission-action",
) -> dict[str, Any]:
    points = int(ACTION_REWARDS.get(action_type, 0))
    target = target or action_type
    metadata = metadata or {}
    reward = None
    referral = _ensure_referral(db, user_id)
    _ensure_notification_preferences(db, user_id)

    if action_type == "mission_hidden_completed":
        points = int(metadata.get("reward", points))

    duplicate = _event_exists_today(db, user_id, "mission_action", target) if action_type in {"mentor_open", "recommendation_reviewed", "learn_track_started", "learn_track_completed", "command_center_opened"} else False

    if action_type == "mission_hidden_completed":
        duplicate = _event_exists_today(db, user_id, action_type, target)
    if action_type == "mission_hidden_discovered":
        duplicate = _event_exists_today(db, user_id, action_type, target)
    if action_type in {"insight_shared", "referral_invite_sent", "referral_signup_completed", "notification_opened", "notification_preferences_updated"}:
        duplicate = False

    _debug_log(
        db,
        user_id,
        request_id,
        "validation",
        "Mission action accepted for processing",
        payload={"action_type": action_type, "target": target, "duplicate": duplicate},
    )

    if not duplicate:
        db.add(
            UserEvent(
                user_id=user_id,
                event_type="mission_action" if not action_type.startswith("mission_hidden_") else action_type,
                surface="mission_control",
                target=target,
                event_metadata=metadata,
            )
        )
        if action_type == "insight_shared":
            share_key = str(metadata.get("insight_key") or target or "").strip()
            share = (
                db.query(GrowthInsightShare)
                .filter(GrowthInsightShare.user_id == user_id, GrowthInsightShare.insight_key == share_key)
                .first()
            ) or (
                db.query(GrowthInsightShare)
                .filter(GrowthInsightShare.user_id == user_id, GrowthInsightShare.slug == share_key)
                .first()
            )
            if share:
                share.share_count = int(share.share_count or 0) + 1
                share.updated_at = datetime.utcnow()
        if action_type == "referral_invite_sent":
            referral.invite_count = int(referral.invite_count or 0) + max(1, int(metadata.get("count", 1) or 1))
            referral.last_invite_at = datetime.utcnow()
        if action_type == "referral_signup_completed":
            referral.signup_count = int(referral.signup_count or 0) + 1
            referral.conversion_count = int(referral.conversion_count or 0) + 1
            referral.reward_points = int(referral.reward_points or 0) + points
            referral.last_conversion_at = datetime.utcnow()
        if points > 0:
            title = str(metadata.get("title") or target.replace("-", " ").title())
            detail = str(metadata.get("detail") or f"+{points} XP awarded for {title.lower()}.")
            xp = UserXpEvent(
                user_id=user_id,
                source="mission_control",
                points=max(0, points + (12 if action_type == "referral_signup_completed" else 0)),
                meta={"title": title, "detail": detail, "action_type": action_type, **metadata},
            )
            db.add(xp)
            db.flush()
            reward = {
                "id": xp.id,
                "label": title,
                "detail": detail,
                "xp": int(xp.points or points),
                "tone": "badge" if "hidden" in action_type else "xp",
                "awarded_at": int(datetime.utcnow().timestamp() * 1000),
            }
        _debug_log(
            db,
            user_id,
            request_id,
            "capture",
            "Mission action persisted successfully",
            payload={"action_type": action_type, "target": target, "points": points},
        )
        db.commit()
    else:
        _debug_log(
            db,
            user_id,
            request_id,
            "dedupe",
            "Mission action skipped because an identical event was already recorded",
            level="warning",
            payload={"action_type": action_type, "target": target},
        )
        db.commit()

    return {
        "points_awarded": 0 if duplicate else (reward["xp"] if reward else points),
        "reward": reward,
        "mission_control": build_mission_control(db, user_id, request_id=request_id),
    }
