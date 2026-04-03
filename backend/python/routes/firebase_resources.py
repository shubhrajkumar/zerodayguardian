from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from services.firebase_admin_service import (
    create_document,
    get_document,
    is_firestore_enabled,
    list_collection,
    upsert_document,
)
from services.security import InMemoryRateLimiter, build_rate_limit_key, require_jwt_user


router = APIRouter()
rate_limiter = InMemoryRateLimiter(limit=90, window_seconds=300)


class FirestoreWritePayload(BaseModel):
    title: str | None = None
    name: str | None = None
    description: str | None = None
    status: str | None = None
    metadata: dict = Field(default_factory=dict)


class NotificationWritePayload(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    message: str = Field(min_length=1, max_length=500)
    type: str = Field(default="info", min_length=1, max_length=40)
    read: bool = False
    action_url: str = Field(default="/dashboard", min_length=1, max_length=240)


def _require_firestore():
    if not is_firestore_enabled():
        raise HTTPException(status_code=503, detail="Firestore is not configured")


def _safe_collection_payload(
    collection_name: str,
    *,
    filters: list[tuple[str, str, Any]] | None = None,
    order_by_field: str | None = None,
    limit_size: int = 50,
) -> list[dict]:
    if not is_firestore_enabled():
        return []
    try:
        return list_collection(
            collection_name,
            filters=filters,
            order_by_field=order_by_field,
            limit_size=limit_size,
        )
    except Exception:
        return []


def _now():
    return datetime.utcnow().isoformat()


def _user_id(user: dict) -> str:
    return str(user.get("sub") or user.get("uid") or "").strip()


@router.get("/auth/me")
def auth_me(request: Request, user: dict = Depends(require_jwt_user)):
    rate_limiter.check(build_rate_limit_key(request, user))
    return {
        "user": {
            "id": _user_id(user),
            "email": str(user.get("email") or ""),
            "name": str(user.get("name") or user.get("preferred_username") or ""),
            "email_verified": bool(user.get("email_verified")),
            "provider": "firebase" if user.get("firebase") else "jwt",
        }
    }


@router.get("/courses")
def list_courses(request: Request, limit: int = Query(default=20, ge=1, le=100), user: dict = Depends(require_jwt_user)):
    rate_limiter.check(build_rate_limit_key(request, user))
    return {
        "courses": _safe_collection_payload("courses", order_by_field="updatedAt", limit_size=limit),
        "degraded": not is_firestore_enabled(),
    }


@router.get("/labs")
def list_labs(request: Request, limit: int = Query(default=20, ge=1, le=100), user: dict = Depends(require_jwt_user)):
    rate_limiter.check(build_rate_limit_key(request, user))
    return {
        "labs": _safe_collection_payload("labs", order_by_field="updatedAt", limit_size=limit),
        "degraded": not is_firestore_enabled(),
    }


@router.get("/progress")
def list_progress(request: Request, user: dict = Depends(require_jwt_user)):
    rate_limiter.check(build_rate_limit_key(request, user))
    user_id = _user_id(user)
    return {
        "progress": _safe_collection_payload("progress", filters=[("userId", "==", user_id)], order_by_field="updatedAt", limit_size=100),
        "degraded": not is_firestore_enabled(),
    }


@router.post("/progress")
def upsert_progress(payload: FirestoreWritePayload, request: Request, user: dict = Depends(require_jwt_user)):
    rate_limiter.check(build_rate_limit_key(request, user))
    if not is_firestore_enabled():
        return {"progress": None, "degraded": True}
    user_id = _user_id(user)
    doc_id = f"{user_id}:{payload.metadata.get('scope') or payload.metadata.get('lessonId') or 'default'}"
    saved = upsert_document(
        "progress",
        doc_id,
        {
            "userId": user_id,
            "title": payload.title or payload.name or "Progress",
            "description": payload.description or "",
            "status": payload.status or "active",
            "metadata": payload.metadata,
            "updatedAt": _now(),
        },
    )
    return {"progress": saved, "degraded": False}


@router.get("/missions")
def list_firestore_missions(request: Request, limit: int = Query(default=40, ge=1, le=100), user: dict = Depends(require_jwt_user)):
    rate_limiter.check(build_rate_limit_key(request, user))
    return {
        "missions": _safe_collection_payload("missions", order_by_field="updatedAt", limit_size=limit),
        "degraded": not is_firestore_enabled(),
    }


@router.get("/leaderboard")
def get_leaderboard(request: Request, limit: int = Query(default=20, ge=1, le=100), user: dict = Depends(require_jwt_user)):
    rate_limiter.check(build_rate_limit_key(request, user))
    return {
        "leaderboard": _safe_collection_payload("leaderboard", order_by_field="score", limit_size=limit),
        "degraded": not is_firestore_enabled(),
    }


@router.get("/notifications")
def list_notifications(request: Request, user: dict = Depends(require_jwt_user)):
    rate_limiter.check(build_rate_limit_key(request, user))
    user_id = _user_id(user)
    return {
        "notifications": _safe_collection_payload("notifications", filters=[("userId", "==", user_id)], order_by_field="createdAt", limit_size=100),
        "degraded": not is_firestore_enabled(),
    }


@router.post("/notifications")
def create_notification(payload: NotificationWritePayload, request: Request, user: dict = Depends(require_jwt_user)):
    rate_limiter.check(build_rate_limit_key(request, user))
    if not is_firestore_enabled():
        return {"notification": None, "degraded": True}
    saved = create_document(
        "notifications",
        {
            "userId": _user_id(user),
            "title": payload.title,
            "message": payload.message,
            "type": payload.type,
            "read": payload.read,
            "actionUrl": payload.action_url,
            "createdAt": _now(),
            "updatedAt": _now(),
        },
    )
    return {"notification": saved, "degraded": False}


@router.get("/notifications/{notification_id}")
def get_notification(notification_id: str, request: Request, user: dict = Depends(require_jwt_user)):
    rate_limiter.check(build_rate_limit_key(request, user))
    if not is_firestore_enabled():
        raise HTTPException(status_code=404, detail="Notification not found")
    row = get_document("notifications", notification_id)
    if not row or str(row.get("userId") or "") != _user_id(user):
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"notification": row}


@router.get("/osint")
def list_osint_runs(request: Request, limit: int = Query(default=30, ge=1, le=100), user: dict = Depends(require_jwt_user)):
    rate_limiter.check(build_rate_limit_key(request, user))
    return {
        "osint": _safe_collection_payload("osint_runs", filters=[("userId", "==", _user_id(user))], order_by_field="createdAt", limit_size=limit),
        "degraded": not is_firestore_enabled(),
    }
