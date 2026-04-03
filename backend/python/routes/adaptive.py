from datetime import datetime
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session

from db import SessionLocal
from schemas import AdaptiveRecommendationResponse
from services.recommendations import build_adaptive_learning_recommendations
from services.security import build_rate_limit_key, require_jwt_user, InMemoryRateLimiter
from models import User


router = APIRouter()
rate_limiter = InMemoryRateLimiter(limit=30, window_seconds=300)


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


@router.get("/recommendations", response_model=AdaptiveRecommendationResponse)
def adaptive_recommendations(request: Request, db: Session = Depends(get_db), user: dict = Depends(require_jwt_user)):
    rate_limiter.check(build_rate_limit_key(request, user))
    user_id = resolve_user_id(db, user)
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    payload = build_adaptive_learning_recommendations(db, user_id)
    return AdaptiveRecommendationResponse(
        user_id=user_id,
        generated_at=datetime.utcnow().isoformat(),
        behavior=payload["behavior"],
        learning=payload["learning"],
        recommendations=payload["recommendations"],
    )

