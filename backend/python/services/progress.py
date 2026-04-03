from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from models import (
    LearningPath,
    ModuleLesson,
    PathModule,
    RewardsCatalog,
    UserLessonProgress,
    UserModuleProgress,
    UserPathEnrollment,
    UserReward,
    UserSkillScore,
    UserStreak,
    UserXpEvent,
)


def get_progress_summary(db: Session, user_id: str) -> dict:
    enrolled = db.query(UserPathEnrollment).filter(UserPathEnrollment.user_id == user_id).count()
    lessons_completed = (
        db.query(UserLessonProgress)
        .filter(UserLessonProgress.user_id == user_id, UserLessonProgress.status == "completed")
        .count()
    )
    modules_completed = (
        db.query(UserModuleProgress)
        .filter(UserModuleProgress.user_id == user_id, UserModuleProgress.status == "completed")
        .count()
    )
    rewards = db.query(UserReward).filter(UserReward.user_id == user_id).count()
    xp = db.query(UserXpEvent).filter(UserXpEvent.user_id == user_id).with_entities(UserXpEvent.points).all()
    xp_total = sum(row[0] for row in xp) if xp else 0
    streak = db.query(UserStreak).filter(UserStreak.user_id == user_id).first()

    return {
        "enrolled_paths": enrolled,
        "lessons_completed": lessons_completed,
        "modules_completed": modules_completed,
        "rewards_count": rewards,
        "xp_total": xp_total,
        "streak": {
            "current": streak.current_streak if streak else 0,
            "best": streak.best_streak if streak else 0,
            "last_activity_date": str(streak.last_activity_date) if streak and streak.last_activity_date else None,
        },
    }


def upsert_lesson_progress(db: Session, user_id: str, lesson_id: str, status: str, score: float | None, attempts: int | None):
    lesson = db.query(ModuleLesson).filter(ModuleLesson.id == lesson_id).first()
    if not lesson:
        return None, None

    progress = (
        db.query(UserLessonProgress)
        .filter(UserLessonProgress.user_id == user_id, UserLessonProgress.lesson_id == lesson_id)
        .first()
    )
    if not progress:
        progress = UserLessonProgress(user_id=user_id, lesson_id=lesson_id)
        db.add(progress)

    progress.status = status
    if score is not None:
        progress.score = score
    if attempts is not None:
        progress.attempts = attempts
    progress.last_activity_at = datetime.utcnow()
    if status == "completed":
        progress.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(progress)

    module_id = lesson.module_id
    lesson_id_rows = db.query(ModuleLesson.id).filter(ModuleLesson.module_id == module_id, ModuleLesson.is_active == 1).all()
    lesson_ids = [row[0] for row in lesson_id_rows]
    total_lessons = len(lesson_ids)
    completed_lessons = (
        db.query(UserLessonProgress)
        .filter(UserLessonProgress.user_id == user_id, UserLessonProgress.lesson_id.in_(lesson_ids))
        .filter(UserLessonProgress.status == "completed")
        .count()
    ) if lesson_ids else 0

    progress_pct = 0.0 if total_lessons == 0 else round((completed_lessons / total_lessons) * 100, 2)
    module_progress = (
        db.query(UserModuleProgress)
        .filter(UserModuleProgress.user_id == user_id, UserModuleProgress.module_id == module_id)
        .first()
    )
    if not module_progress:
        module_progress = UserModuleProgress(user_id=user_id, module_id=module_id)
        db.add(module_progress)
    module_progress.progress_pct = progress_pct
    module_progress.status = "completed" if progress_pct >= 100 else "in_progress"
    module_progress.last_activity_at = datetime.utcnow()
    if module_progress.status == "completed":
        module_progress.completed_at = datetime.utcnow()
    db.commit()

    return progress, module_progress

