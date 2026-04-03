from typing import Dict, List


def detect_threat(metrics: Dict[str, float]) -> Dict[str, object]:
    requests_per_min = float(metrics.get("requests_per_min", 0))
    error_rate = float(metrics.get("error_rate", 0))
    failed_logins = float(metrics.get("failed_logins", 0))
    anomaly_score = float(metrics.get("anomaly_score", 0))

    risk = "low"
    reasons: List[str] = []
    checked_signals = ["requests_per_min", "error_rate", "failed_logins", "anomaly_score"]
    triggered_signals: List[str] = []
    score = 0

    if requests_per_min > 1200:
        risk = "high"
        score += 30
        reasons.append("Request volume indicates possible abuse or automation.")
        triggered_signals.append("requests_per_min")
    elif requests_per_min > 600:
        risk = max(risk, "medium", key=lambda v: ["low", "medium", "high"].index(v))
        score += 18
        reasons.append("Traffic spike detected above normal baseline.")
        triggered_signals.append("requests_per_min")

    if error_rate > 0.12:
        risk = "high"
        score += 30
        reasons.append("Error rate exceeds safe operational thresholds.")
        triggered_signals.append("error_rate")
    elif error_rate > 0.05:
        risk = max(risk, "medium", key=lambda v: ["low", "medium", "high"].index(v))
        score += 18
        reasons.append("Error rate is trending above normal.")
        triggered_signals.append("error_rate")

    if failed_logins > 20:
        risk = "high"
        score += 25
        reasons.append("Excessive failed logins suggest brute-force attempts.")
        triggered_signals.append("failed_logins")
    elif failed_logins > 8:
        risk = max(risk, "medium", key=lambda v: ["low", "medium", "high"].index(v))
        score += 15
        reasons.append("Repeated failed logins observed.")
        triggered_signals.append("failed_logins")

    if anomaly_score > 0.75:
        risk = "high"
        score += 35
        reasons.append("Anomaly model flags suspicious behavior.")
        triggered_signals.append("anomaly_score")
    elif anomaly_score > 0.4:
        risk = max(risk, "medium", key=lambda v: ["low", "medium", "high"].index(v))
        score += 18
        reasons.append("Anomaly score elevated above baseline.")
        triggered_signals.append("anomaly_score")

    if not reasons:
        reasons.append("No abnormal signals detected at current thresholds.")

    score = max(0, min(100, score))
    advice = (
        [
            "Throttle or block abusive sources immediately.",
            "Review authentication logs and enforce MFA or lockout controls.",
            "Validate findings against edge, WAF, and IAM telemetry.",
        ]
        if risk == "high"
        else [
            "Review service logs for burst traffic and repeated auth failures.",
            "Confirm whether error spikes align with deployments or client issues.",
            "Increase monitoring on login and edge telemetry.",
        ]
        if risk == "medium"
        else [
            "Keep monitoring baselines current.",
            "Review thresholds if traffic patterns have changed.",
        ]
    )

    return {
        "risk_level": risk,
        "reasons": reasons,
        "suspicious": risk in {"medium", "high"},
        "verified": True,
        "checked_signals": checked_signals,
        "triggered_signals": triggered_signals,
        "advice": advice,
        "ai_used": False,
        "analysis_mode": "verified_signal_only",
        "provider": "python",
        "confidence": 0.72,
        "risk_score": score,
        "cache_hit": False,
    }
