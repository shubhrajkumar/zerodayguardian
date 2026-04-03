from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from db import SessionLocal
from models import LearningPath, ModuleLesson, PathModule, User
from schemas import MissionCompleteRequest, MissionListItem, LessonProgressResponse
from services.progress import upsert_lesson_progress
from services.security import build_rate_limit_key, require_jwt_user, InMemoryRateLimiter


router = APIRouter()
rate_limiter = InMemoryRateLimiter(limit=40, window_seconds=300)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def resolve_user_id(db: Session, user: dict, requested: str | None) -> str | None:
    if requested:
        return requested
    external_id = str(user.get("sub") or "").strip()
    email = str(user.get("email") or "").strip().lower()
    if external_id:
        match = db.query(User).filter(User.external_id == external_id).first()
        if match:
            return match.id
    if email:
        match = db.query(User).filter(User.email == email).first()
        if match:
            return match.id
    return None


@router.get("", response_model=list[MissionListItem])
def list_missions(
    request: Request,
    path_id: str | None = None,
    module_id: str | None = None,
    limit: int = 40,
    db: Session = Depends(get_db),
    user: dict = Depends(require_jwt_user),
):
    rate_limiter.check(build_rate_limit_key(request, user))
    query = db.query(ModuleLesson, PathModule, LearningPath).join(PathModule, ModuleLesson.module_id == PathModule.id).join(LearningPath, PathModule.path_id == LearningPath.id)
    if path_id:
        query = query.filter(LearningPath.id == path_id)
    if module_id:
        query = query.filter(PathModule.id == module_id)
    rows = query.order_by(PathModule.order_index.asc(), ModuleLesson.order_index.asc()).limit(max(1, min(100, limit))).all()
    return [
        MissionListItem(
            id=lesson.id,
            title=lesson.title,
            module_id=module.id,
            module_title=module.title,
            path_id=path.id,
            path_title=path.title,
            lesson_type=lesson.lesson_type,
            estimated_minutes=lesson.estimated_minutes,
        )
        for (lesson, module, path) in rows
    ]


@router.post("/complete", response_model=LessonProgressResponse)
def complete_mission(payload: MissionCompleteRequest, request: Request, db: Session = Depends(get_db), user: dict = Depends(require_jwt_user)):
    rate_limiter.check(build_rate_limit_key(request, user))
    user_id = resolve_user_id(db, user, payload.user_id)
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    progress, _module_progress = upsert_lesson_progress(
        db,
        user_id=user_id,
        lesson_id=payload.lesson_id,
        status=payload.status,
        score=payload.score,
        attempts=payload.attempts,
    )
    if not progress:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return LessonProgressResponse(
        id=progress.id,
        user_id=progress.user_id,
        lesson_id=progress.lesson_id,
        status=progress.status,
        score=progress.score,
        attempts=progress.attempts,
        last_activity_at=str(progress.last_activity_at) if progress.last_activity_at else None,
        completed_at=str(progress.completed_at) if progress.completed_at else None,
    )

