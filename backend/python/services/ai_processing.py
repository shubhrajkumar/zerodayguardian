from __future__ import annotations

import hashlib
from typing import Any

from services.cache import TTLCache


ai_cache = TTLCache(ttl_seconds=120, max_entries=512)


def _hash_payload(task_type: str, user_input: str, context: str | None) -> str:
    raw = f"{task_type}|{user_input}|{context or ''}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def process_ai_task(task_type: str, user_input: str, context: str | None, max_bullets: int = 4) -> dict[str, Any]:
    key = _hash_payload(task_type, user_input, context)
    cached = ai_cache.get(key)
    if cached:
        return {**cached, "cache_hit": True}

    normalized = user_input.strip()
    lowered = normalized.lower()
    bullets: list[str] = []
    signals: list[str] = []

    if task_type == "threat_summary":
        if any(word in lowered for word in ["breach", "leak", "exfil", "ransom", "malware"]):
            signals.append("malicious_signal")
            bullets.append("Potential malicious indicators detected in the input. Verify source and scope.")
        if "failed login" in lowered or "brute" in lowered:
            signals.append("auth_anomaly")
            bullets.append("Authentication anomalies mentioned. Correlate with access logs.")
        if not bullets:
            bullets.append("No high-confidence threat indicators found in the provided text.")
    elif task_type == "incident_summary":
        bullets.append("Summarize scope, impact, and containment status in one pass.")
        if "user" in lowered:
            bullets.append("Assess affected user accounts and reset credentials if needed.")
        signals.append("incident_context")
    else:
        bullets.append("Provide a concise verified summary and list next actions.")
        signals.append("generic_analysis")

    summary = bullets[0] if bullets else "No verified analysis available."
    output = {
        "task_type": task_type,
        "summary": summary,
        "bullets": bullets[:max(1, min(6, max_bullets))],
        "signals": signals,
        "ai_used": False,
    }
    ai_cache.set(key, output)
    return {**output, "cache_hit": False}

