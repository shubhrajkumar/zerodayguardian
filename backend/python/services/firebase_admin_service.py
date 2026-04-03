from __future__ import annotations

import json
import os
import time
from typing import Any

import firebase_admin
from firebase_admin import auth, credentials, firestore


_APP: firebase_admin.App | None = None
_DB: firestore.Client | None = None


def _normalize_private_key(raw: str) -> str:
    value = str(raw or "").strip()
    if not value:
        return ""
    return value.replace("\\n", "\n")


def _build_credentials_payload() -> dict[str, Any] | None:
    project_id = str(os.getenv("FIREBASE_PROJECT_ID", "")).strip()
    client_email = str(os.getenv("FIREBASE_CLIENT_EMAIL", "")).strip()
    private_key = _normalize_private_key(os.getenv("FIREBASE_PRIVATE_KEY", ""))
    if not project_id or not client_email or not private_key:
        return None
    return {
        "type": "service_account",
        "project_id": project_id,
        "private_key": private_key,
        "client_email": client_email,
        "token_uri": "https://oauth2.googleapis.com/token",
    }


def is_firestore_enabled() -> bool:
    return _build_credentials_payload() is not None


def get_firebase_app() -> firebase_admin.App:
    global _APP
    if _APP is not None:
        return _APP
    if firebase_admin._apps:
        _APP = firebase_admin.get_app()
        return _APP
    payload = _build_credentials_payload()
    if not payload:
        raise RuntimeError("Firebase Admin credentials are not configured")
    cred = credentials.Certificate(payload)
    _APP = firebase_admin.initialize_app(cred, {"projectId": payload["project_id"]})
    return _APP


def get_firestore_client() -> firestore.Client:
    global _DB
    if _DB is not None:
        return _DB
    app = get_firebase_app()
    _DB = firestore.client(app)
    return _DB


def with_retry(task, attempts: int = 3, backoff_ms: int = 150):
    last_error: Exception | None = None
    for attempt in range(1, max(1, attempts) + 1):
        try:
            return task()
        except Exception as error:  # pragma: no cover - defensive runtime guard
            last_error = error
            if attempt >= attempts:
                break
            time.sleep((backoff_ms * attempt) / 1000)
    if last_error:
        raise last_error
    raise RuntimeError("Retry wrapper executed without a result")


def verify_firebase_token(id_token: str) -> dict[str, Any]:
    def _verify():
        get_firebase_app()
        return auth.verify_id_token(id_token, check_revoked=False)

    payload = with_retry(_verify, attempts=3)
    return payload if isinstance(payload, dict) else {}


def _doc_to_dict(snapshot) -> dict[str, Any]:
    data = snapshot.to_dict() or {}
    data["id"] = snapshot.id
    return json.loads(json.dumps(data, default=str))


def list_collection(collection_name: str, filters: list[tuple[str, str, Any]] | None = None, order_by_field: str | None = None, limit_size: int = 50):
    db = get_firestore_client()
    query = db.collection(collection_name)
    for field, op, value in filters or []:
        query = query.where(field, op, value)
    if order_by_field:
        query = query.order_by(order_by_field, direction=firestore.Query.DESCENDING)
    docs = query.limit(max(1, min(100, limit_size))).stream()
    return [_doc_to_dict(doc) for doc in docs]


def get_document(collection_name: str, doc_id: str) -> dict[str, Any] | None:
    db = get_firestore_client()
    snap = db.collection(collection_name).document(str(doc_id)).get()
    if not snap.exists:
        return None
    return _doc_to_dict(snap)


def upsert_document(collection_name: str, doc_id: str, payload: dict[str, Any], merge: bool = True) -> dict[str, Any]:
    db = get_firestore_client()
    ref = db.collection(collection_name).document(str(doc_id))
    with_retry(lambda: ref.set(payload, merge=merge), attempts=3)
    snap = ref.get()
    return _doc_to_dict(snap)


def create_document(collection_name: str, payload: dict[str, Any]) -> dict[str, Any]:
    db = get_firestore_client()
    ref = with_retry(lambda: db.collection(collection_name).document(), attempts=3)
    with_retry(lambda: ref.set(payload, merge=False), attempts=3)
    return _doc_to_dict(ref.get())
