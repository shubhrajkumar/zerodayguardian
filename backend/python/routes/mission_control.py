from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
import logging

from db import SessionLocal
from models import User
from schemas import MissionActionRequest, MissionActionResponse, MissionControlPreferencesUpdate, MissionControlResponse
from services.mission_control import build_mission_control, build_mission_control_fallback, record_mission_action, update_notification_preferences
from services.security import InMemoryRateLimiter, build_rate_limit_key, require_jwt_user


router = APIRouter()
rate_limiter = InMemoryRateLimiter(limit=60, window_seconds=300)
mission_logger = logging.getLogger("zdg.pyapi.mission_control")


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


def ensure_user_id(db: Session, user: dict) -> str | None:
    existing = resolve_user_id(db, user)
    if existing:
        return existing
    email = str(user.get("email") or "").strip().lower()
    if not email:
        return None
    created = User(
        email=email,
        name=str(user.get("name") or user.get("preferred_username") or email).strip() or email,
        external_id=str(user.get("sub") or "").strip() or None,
    )
    db.add(created)
    db.commit()
    db.refresh(created)
    return created.id


def _build_mission_control_response(request: Request, db: Session, user: dict, include_debug: bool = True):
    rate_limiter.check(build_rate_limit_key(request, user))
    user_id = ensure_user_id(db, user)
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    request_id = getattr(request.state, "request_id", "mission-control")
    try:
        return MissionControlResponse(**build_mission_control(db, user_id, request_id=request_id, include_debug=include_debug))
    except Exception as exc:
        mission_logger.exception("Mission control snapshot failed request_id=%s user_id=%s", request_id, user_id)
        db.rollback()
        fallback = build_mission_control_fallback(
            db,
            user_id,
            request_id=request_id,
            reason="Some dashboard systems are temporarily unavailable, but your training progress is still intact.",
        )
        return MissionControlResponse(**fallback)


@router.get("", response_model=MissionControlResponse)
@router.get("/", response_model=MissionControlResponse)
def get_mission_control(request: Request, include_debug: bool = True, db: Session = Depends(get_db), user: dict = Depends(require_jwt_user)):
    return _build_mission_control_response(request, db, user, include_debug=include_debug)


@router.post("/actions", response_model=MissionActionResponse)
def post_mission_action(payload: MissionActionRequest, request: Request, db: Session = Depends(get_db), user: dict = Depends(require_jwt_user)):
    rate_limiter.check(build_rate_limit_key(request, user))
    user_id = ensure_user_id(db, user)
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    request_id = getattr(request.state, "request_id", "mission-action")
    try:
        result = record_mission_action(db, user_id, payload.action_type, payload.target, payload.metadata, request_id=request_id)
        return MissionActionResponse(
            ok=True,
            action_type=payload.action_type,
            points_awarded=int(result["points_awarded"]),
            reward=result["reward"],
            mission_control=MissionControlResponse(**result["mission_control"]),
        )
    except Exception:
        mission_logger.exception("Mission action failed request_id=%s user_id=%s action=%s", request_id, user_id, payload.action_type)
        db.rollback()
        fallback = build_mission_control_fallback(
            db,
            user_id,
            request_id=request_id,
            reason="We could not save that action cleanly. Your dashboard is still available and you can retry in a moment.",
        )
        return MissionActionResponse(
            ok=False,
            action_type=payload.action_type,
            points_awarded=0,
            reward=None,
            mission_control=MissionControlResponse(**fallback),
        )


@router.post("/preferences", response_model=MissionControlResponse)
def post_mission_preferences(payload: MissionControlPreferencesUpdate, request: Request, db: Session = Depends(get_db), user: dict = Depends(require_jwt_user)):
    rate_limiter.check(build_rate_limit_key(request, user))
    user_id = ensure_user_id(db, user)
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    request_id = getattr(request.state, "request_id", "mission-preferences")
    try:
        return MissionControlResponse(**update_notification_preferences(db, user_id, payload.dict(exclude_none=True), request_id=request_id))
    except Exception:
        mission_logger.exception("Mission preferences update failed request_id=%s user_id=%s", request_id, user_id)
        db.rollback()
        fallback = build_mission_control_fallback(
            db,
            user_id,
            request_id=request_id,
            reason="Your notification settings could not be updated just now. Existing preferences are still preserved.",
        )
        return MissionControlResponse(**fallback)
