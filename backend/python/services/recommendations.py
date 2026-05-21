from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from models import (
    DailyProgress,
    LearningPath,
    ModuleLesson,
    PathModule,
    ScanReport,
    SkillGraphNode,
    ThreatEvent,
    UserEvent,
    UserLessonProgress,
    UserSkillScore,
)


def _recent_cutoff(hours: int = 72) -> datetime:
    return datetime.utcnow() - timedelta(hours=hours)


def record_user_event(db: Session, user_id: str | None, event_type: str, surface: str, target: str | None, metadata: dict[str, Any]):
    normalized_metadata = metadata or {}
    event = UserEvent(
        user_id=user_id,
        event_type=event_type,
        surface=surface,
        target=target,
        legacy_metadata=normalized_metadata,
        event_metadata=normalized_metadata,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def _apply_user_filter(query, user_id: str | None):
    if user_id:
        return query.filter(UserEvent.user_id == user_id)
    return query


def _apply_user_filter_scan(query, user_id: str | None):
    if user_id:
        return query.filter(ScanReport.user_id == user_id)
    return query


def _apply_user_filter_threat(query, user_id: str | None):
    if user_id:
        return query.filter(ThreatEvent.user_id == user_id)
    return query


def build_recommendations(db: Session, user_id: str | None):
    cutoff = _recent_cutoff()
    events = _apply_user_filter(
        db.query(UserEvent)
        .filter(UserEvent.created_at >= cutoff)
        .order_by(UserEvent.created_at.desc()),
        user_id,
    ).limit(40).all()
    scans = _apply_user_filter_scan(
        db.query(ScanReport)
        .filter(ScanReport.created_at >= cutoff)
        .order_by(ScanReport.created_at.desc()),
        user_id,
    ).limit(12).all()
    threats = _apply_user_filter_threat(
        db.query(ThreatEvent)
        .filter(ThreatEvent.created_at >= cutoff)
        .order_by(ThreatEvent.created_at.desc()),
        user_id,
    ).limit(12).all()

    high_risk = [t for t in threats if str(t.risk_level or "").lower() == "high"]
    last_scan = scans[0] if scans else None
    last_event = events[0] if events else None

    recommendations = []
    if high_risk:
        recommendations.append(
            {
                "title": "Prioritize high-risk telemetry",
                "reason": f"{len(high_risk)} high-risk threat signals detected in the last 72 hours.",
                "action": "Review the latest threat event and confirm containment or remediation steps.",
                "priority": 1,
            }
        )
    if last_scan:
        recommendations.append(
            {
                "title": "Verify the latest scan fix",
                "reason": "A recent web scan exists but no follow-up validation is recorded.",
                "action": f"Re-scan {last_scan.target_url} after applying any remediation.",
                "priority": 2,
            }
        )
    if last_event and last_event.surface == "osint":
        recommendations.append(
            {
                "title": "Correlate OSINT with live checks",
                "reason": "Recent OSINT activity benefits from confirmation via a live header or web scan.",
                "action": "Run a web scan on the latest OSINT target and compare findings.",
                "priority": 2,
            }
        )
    if not recommendations:
        recommendations.append(
            {
                "title": "Start a verified security loop",
                "reason": "No recent high-confidence activity is available to personalize recommendations.",
                "action": "Run one real scan or threat detection to unlock tailored guidance.",
                "priority": 3,
            }
        )

    signals = {
        "recent_events": len(events),
        "recent_scans": len(scans),
        "recent_threats": len(threats),
        "high_risk_threats": len(high_risk),
        "last_event_surface": last_event.surface if last_event else None,
    }
    return recommendations[:3], signals


def build_adaptive_learning_recommendations(db: Session, user_id: str | None):
    cutoff = _recent_cutoff()
    events = _apply_user_filter(
        db.query(UserEvent)
        .filter(UserEvent.created_at >= cutoff)
        .order_by(UserEvent.created_at.desc()),
        user_id,
    ).limit(60).all()

    daily = None
    if user_id:
        daily = db.query(DailyProgress).filter(DailyProgress.user_id == user_id).order_by(DailyProgress.day.desc()).first()

    skill_rows = (
        db.query(UserSkillScore, SkillGraphNode)
        .join(SkillGraphNode, SkillGraphNode.id == UserSkillScore.skill_id)
        .filter(UserSkillScore.user_id == user_id) if user_id else []
    )
    weakest_skills = []
    if user_id:
        weakest = (
            db.query(UserSkillScore, SkillGraphNode)
            .join(SkillGraphNode, SkillGraphNode.id == UserSkillScore.skill_id)
            .filter(UserSkillScore.user_id == user_id)
            .order_by(UserSkillScore.score.asc())
            .limit(2)
            .all()
        )
        weakest_skills = [{"key": row.SkillGraphNode.key if hasattr(row, "SkillGraphNode") else row[1].key,
                           "label": row.SkillGraphNode.label if hasattr(row, "SkillGraphNode") else row[1].label,
                           "score": float(row.UserSkillScore.score if hasattr(row, "UserSkillScore") else row[0].score)} for row in weakest]

    suggested_paths = []
    if weakest_skills:
        tracks = []
        for skill in weakest_skills:
            key = skill["key"]
            if "osint" in key or "intel" in key:
                tracks.append("defense")
            elif "web" in key or "attack" in key:
                tracks.append("offense")
            elif "threat" in key or "detect" in key:
                tracks.append("defense")
        if not tracks:
            tracks = ["defense", "offense"]
        path_rows = db.query(LearningPath).filter(LearningPath.is_active == 1, LearningPath.track.in_(tracks)).limit(3).all()
        suggested_paths = [{"id": row.id, "title": row.title, "track": row.track, "difficulty": row.difficulty} for row in path_rows]

    next_missions = []
    if user_id:
        lessons = (
            db.query(ModuleLesson, PathModule, LearningPath)
            .join(PathModule, ModuleLesson.module_id == PathModule.id)
            .join(LearningPath, PathModule.path_id == LearningPath.id)
            .filter(LearningPath.is_active == 1)
            .order_by(PathModule.order_index.asc(), ModuleLesson.order_index.asc())
            .limit(12)
            .all()
        )
        completed_ids = {
            row.lesson_id
            for row in db.query(UserLessonProgress.lesson_id)
            .filter(UserLessonProgress.user_id == user_id, UserLessonProgress.status == "completed")
            .all()
        }
        for lesson, module, path in lessons:
            if lesson.id in completed_ids:
                continue
            next_missions.append(
                {
                    "lesson_id": lesson.id,
                    "lesson_title": lesson.title,
                    "module_title": module.title,
                    "path_title": path.title,
                    "estimated_minutes": lesson.estimated_minutes,
                }
            )
            if len(next_missions) >= 3:
                break

    recent_surfaces = [event.surface for event in events[:8]]
    recommendations = []
    if daily and daily.missions_completed >= 1:
        recommendations.append(
            {
                "title": "Keep the daily streak alive",
                "reason": f"{daily.missions_completed} missions completed today with {daily.xp_earned} XP earned.",
                "action": "Finish one more mission or review a completed lesson to lock streak momentum.",
                "priority": 1,
            }
        )
    if weakest_skills:
        recommendations.append(
            {
                "title": "Close the next skill gap",
                "reason": f"Lowest skill: {weakest_skills[0]['label']} ({weakest_skills[0]['score']:.0f})",
                "action": "Start the suggested learning path or run the next mission in that track.",
                "priority": 2,
            }
        )
    if not recommendations:
        recommendations.append(
            {
                "title": "Start an adaptive learning loop",
                "reason": "Behavior signals are still warming up.",
                "action": "Run one mission or OSINT scan to unlock personalized guidance.",
                "priority": 3,
            }
        )

    return {
        "behavior": {
            "recent_events": len(events),
            "recent_surfaces": recent_surfaces,
        },
        "learning": {
            "weak_skills": weakest_skills,
            "suggested_paths": suggested_paths,
            "next_missions": next_missions,
        },
        "recommendations": recommendations[:3],
    }
