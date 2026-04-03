from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from db import SessionLocal
from schemas import AiProcessRequest, AiProcessResponse
from services.ai_processing import process_ai_task
from services.security import build_rate_limit_key, require_jwt_user, InMemoryRateLimiter


router = APIRouter()
rate_limiter = InMemoryRateLimiter(limit=25, window_seconds=300)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/process", response_model=AiProcessResponse)
def process_ai(payload: AiProcessRequest, request: Request, _db: Session = Depends(get_db), user: dict = Depends(require_jwt_user)):
    rate_limiter.check(build_rate_limit_key(request, user))
    result = process_ai_task(payload.task_type, payload.input, payload.context, payload.max_bullets)
    return AiProcessResponse(**result)

