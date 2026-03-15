from typing import Dict, List


def detect_threat(metrics: Dict[str, float]) -> Dict[str, object]:
    requests_per_min = float(metrics.get("requests_per_min", 0))
    error_rate = float(metrics.get("error_rate", 0))
    failed_logins = float(metrics.get("failed_logins", 0))
    anomaly_score = float(metrics.get("anomaly_score", 0))

    risk = "low"
    reasons: List[str] = []

    if requests_per_min > 1200:
        risk = "high"
        reasons.append("Request volume indicates possible abuse or automation.")
    elif requests_per_min > 600:
        risk = max(risk, "medium", key=lambda v: ["low", "medium", "high"].index(v))
        reasons.append("Traffic spike detected above normal baseline.")

    if error_rate > 0.12:
        risk = "high"
        reasons.append("Error rate exceeds safe operational thresholds.")
    elif error_rate > 0.05:
        risk = max(risk, "medium", key=lambda v: ["low", "medium", "high"].index(v))
        reasons.append("Error rate is trending above normal.")

    if failed_logins > 20:
        risk = "high"
        reasons.append("Excessive failed logins suggest brute-force attempts.")
    elif failed_logins > 8:
        risk = max(risk, "medium", key=lambda v: ["low", "medium", "high"].index(v))
        reasons.append("Repeated failed logins observed.")

    if anomaly_score > 0.75:
        risk = "high"
        reasons.append("Anomaly model flags suspicious behavior.")
    elif anomaly_score > 0.4:
        risk = max(risk, "medium", key=lambda v: ["low", "medium", "high"].index(v))
        reasons.append("Anomaly score elevated above baseline.")

    if not reasons:
        reasons.append("No abnormal signals detected at current thresholds.")

    return {
        "risk_level": risk,
        "reasons": reasons,
        "suspicious": risk in {"medium", "high"},
    }
