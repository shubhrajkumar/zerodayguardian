from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from db import SessionLocal
from models import User
from schemas import UserResponse
from services.security import build_rate_limit_key, require_jwt_user, InMemoryRateLimiter


router = APIRouter()
rate_limiter = InMemoryRateLimiter(limit=40, window_seconds=300)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/me", response_model=UserResponse)
def get_me(request: Request, db: Session = Depends(get_db), user: dict = Depends(require_jwt_user)):
    rate_limiter.check(build_rate_limit_key(request, user))
    external_id = str(user.get("sub") or "").strip()
    email = str(user.get("email") or "").strip().lower()
    db_user = None
    if external_id:
        db_user = db.query(User).filter(User.external_id == external_id).first()
    if not db_user and email:
        db_user = db.query(User).filter(User.email == email).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user

