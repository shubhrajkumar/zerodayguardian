from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from db import SessionLocal
from datetime import date
from schemas import DailyProgressResponse, DailyProgressUpdate, ProgressSummaryResponse, ProgramStartRequest, ProgramStartResponse
from services.progress import get_progress_summary
from services.security import build_rate_limit_key, require_jwt_user, InMemoryRateLimiter
from models import DailyProgress, User, UserEvent


router = APIRouter()
rate_limiter = InMemoryRateLimiter(limit=40, window_seconds=300)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def resolve_user_id(db: Session, user: dict) -> str | None:
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


@router.get("/summary", response_model=ProgressSummaryResponse)
def progress_summary(request: Request, db: Session = Depends(get_db), user: dict = Depends(require_jwt_user)):
    rate_limiter.check(build_rate_limit_key(request, user))
    user_id = resolve_user_id(db, user)
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    return get_progress_summary(db, user_id)


@router.get("/daily", response_model=DailyProgressResponse)
def get_daily_progress(day: str, request: Request, db: Session = Depends(get_db), user: dict = Depends(require_jwt_user)):
    rate_limiter.check(build_rate_limit_key(request, user))
    user_id = resolve_user_id(db, user)
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    target_day = date.fromisoformat(day)
    row = db.query(DailyProgress).filter(DailyProgress.user_id == user_id, DailyProgress.day == target_day).first()
    if not row:
        raise HTTPException(status_code=404, detail="Daily progress not found")
    return DailyProgressResponse(
        id=row.id,
        user_id=row.user_id,
        day=str(row.day),
        missions_completed=row.missions_completed,
        xp_earned=row.xp_earned,
        streak_day=row.streak_day,
        updated_at=str(row.updated_at) if row.updated_at else None,
    )


@router.post("/daily", response_model=DailyProgressResponse)
def upsert_daily_progress(payload: DailyProgressUpdate, request: Request, db: Session = Depends(get_db), user: dict = Depends(require_jwt_user)):
    rate_limiter.check(build_rate_limit_key(request, user))
    user_id = resolve_user_id(db, user)
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    target_day = date.fromisoformat(payload.day)
    row = db.query(DailyProgress).filter(DailyProgress.user_id == user_id, DailyProgress.day == target_day).first()
    if not row:
        row = DailyProgress(user_id=user_id, day=target_day)
        db.add(row)
    row.missions_completed = max(0, int(payload.missions_completed))
    row.xp_earned = max(0, int(payload.xp_earned))
    row.streak_day = max(0, int(payload.streak_day))
    db.commit()
    db.refresh(row)
    return DailyProgressResponse(
        id=row.id,
        user_id=row.user_id,
        day=str(row.day),
        missions_completed=row.missions_completed,
        xp_earned=row.xp_earned,
        streak_day=row.streak_day,
        updated_at=str(row.updated_at) if row.updated_at else None,
    )


@router.get("/program-start", response_model=ProgramStartResponse)
def get_program_start(request: Request, db: Session = Depends(get_db), user: dict = Depends(require_jwt_user)):
    rate_limiter.check(build_rate_limit_key(request, user))
    user_id = resolve_user_id(db, user)
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    row = (
        db.query(UserEvent)
        .filter(UserEvent.user_id == user_id, UserEvent.event_type == "program_start_day")
        .order_by(UserEvent.created_at.desc())
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Program start not set")
    day = int(row.event_metadata.get("day", 1)) if isinstance(row.event_metadata, dict) else 1
    return ProgramStartResponse(day=day, updated_at=str(row.created_at) if row.created_at else None)


@router.post("/program-start", response_model=ProgramStartResponse)
def set_program_start(payload: ProgramStartRequest, request: Request, db: Session = Depends(get_db), user: dict = Depends(require_jwt_user)):
    rate_limiter.check(build_rate_limit_key(request, user))
    user_id = resolve_user_id(db, user)
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    event = UserEvent(
        user_id=user_id,
        event_type="program_start_day",
        surface="learning_program",
        target=f"day:{payload.day}",
        event_metadata={"day": payload.day},
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return ProgramStartResponse(day=payload.day, updated_at=str(event.created_at) if event.created_at else None)
