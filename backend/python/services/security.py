from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
from pathlib import Path
import threading
import time
from dataclasses import dataclass

from fastapi import Header, HTTPException, Request, status
from dotenv import load_dotenv
from services.firebase_admin_service import verify_firebase_token, is_firestore_enabled, with_retry


_ENV_LOADED = False


def _load_env_once() -> None:
    global _ENV_LOADED
    if _ENV_LOADED:
        return
    current = Path(__file__).resolve()
    candidates = [
        current.parents[3] / ".env",
        current.parents[2] / ".env",
        current.parents[3] / ".env.local",
        current.parents[2] / ".env.local",
    ]
    for env_path in candidates:
        if env_path.exists():
            load_dotenv(env_path, override=False)
    _ENV_LOADED = True


def resolve_jwt_secret() -> str:
    _load_env_once()
    secret = os.getenv("JWT_SECRET", "").strip()
    if secret:
        return secret
    # Development-safe fallback so Python routes can share the same auth secret source as the Node app.
    return os.getenv("SESSION_SECRET", "").strip()


def _b64url_decode(value: str) -> bytes:
    padding = "=" * ((4 - len(value) % 4) % 4)
    return base64.urlsafe_b64decode((value + padding).encode("utf-8"))


def _decode_segment(value: str) -> dict[str, object]:
    raw = _b64url_decode(value)
    payload = json.loads(raw.decode("utf-8"))
    return payload if isinstance(payload, dict) else {}


def verify_hs256_jwt(token: str, secret: str) -> dict[str, object]:
    parts = str(token or "").split(".")
    if len(parts) != 3:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    header_b64, payload_b64, signature_b64 = parts
    header = _decode_segment(header_b64)
    if header.get("alg") != "HS256":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unsupported token algorithm")

    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    expected = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    supplied = _b64url_decode(signature_b64)
    if not hmac.compare_digest(expected, supplied):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token signature")

    payload = _decode_segment(payload_b64)
    now = int(time.time())
    exp = int(payload.get("exp", 0) or 0)
    if exp and exp <= now:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    nbf = int(payload.get("nbf", 0) or 0)
    if nbf and nbf > now:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token not active yet")
    if not payload.get("sub"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token subject missing")
    return payload


def require_jwt_user(request: Request, authorization: str | None = Header(default=None)) -> dict[str, object]:
    secret = resolve_jwt_secret()
    raw = str(authorization or "")
    token = ""
    if raw.lower().startswith("bearer "):
        token = raw.split(" ", 1)[1].strip()
    if not token:
        token = str(request.query_params.get("access_token") or "").strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer token required")

    errors: list[str] = []
    if secret:
        try:
            return verify_hs256_jwt(token, secret)
        except HTTPException as exc:
            errors.append(str(exc.detail))
    if is_firestore_enabled():
        try:
            payload = with_retry(lambda: verify_firebase_token(token), attempts=3)
            if payload.get("uid") and not payload.get("sub"):
                payload["sub"] = str(payload.get("uid"))
            return payload
        except Exception as exc:  # pragma: no cover - runtime auth fallback
            errors.append(str(exc))
    if not secret and not is_firestore_enabled():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="JWT secret and Firebase Admin are not configured")
    detail = errors[0] if errors else "Authentication failed"
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


@dataclass
class RateLimitWindow:
    count: int
    reset_at: float


class InMemoryRateLimiter:
    def __init__(self, limit: int = 30, window_seconds: int = 300) -> None:
        self.limit = max(1, limit)
        self.window_seconds = max(10, window_seconds)
        self._lock = threading.Lock()
        self._windows: dict[str, RateLimitWindow] = {}

    def check(self, key: str) -> None:
        now = time.time()
        with self._lock:
            window = self._windows.get(key)
            if not window or window.reset_at <= now:
                self._windows[key] = RateLimitWindow(count=1, reset_at=now + self.window_seconds)
                return
            if window.count >= self.limit:
                retry_after = max(1, int(window.reset_at - now))
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Rate limit exceeded. Retry in {retry_after}s.",
                    headers={"Retry-After": str(retry_after)},
                )
            window.count += 1


def build_rate_limit_key(request: Request, user: dict[str, object]) -> str:
    subject = str(user.get("sub") or "anonymous")
    client = request.client.host if request.client else "unknown"
    return f"{subject}:{client}:{request.url.path}"
