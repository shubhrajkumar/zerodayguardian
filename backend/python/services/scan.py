import time
from typing import Dict, List
import httpx


REQUIRED_HEADERS: Dict[str, str] = {
    "Strict-Transport-Security": "Enable HSTS to force HTTPS usage.",
    "Content-Security-Policy": "Add CSP to reduce XSS and injection risk.",
    "X-Frame-Options": "Deny framing to prevent clickjacking.",
    "X-Content-Type-Options": "Set nosniff to harden MIME handling.",
    "Referrer-Policy": "Limit referrer leakage to third parties.",
    "Permissions-Policy": "Restrict browser feature access.",
}


def normalize_url(raw: str) -> str:
    if raw.startswith("http://") or raw.startswith("https://"):
        return raw
    return f"https://{raw}"


def run_scan(raw_url: str) -> Dict[str, object]:
    url = normalize_url(raw_url.strip())
    start = time.perf_counter()

    response = None
    error = None
    for attempt in range(2):
        try:
            response = httpx.get(url, follow_redirects=True, timeout=8.0)
            error = None
            break
        except Exception as exc:
            error = exc
            if attempt == 0 and url.startswith("https://"):
                url = url.replace("https://", "http://", 1)
            else:
                break

    latency_ms = round((time.perf_counter() - start) * 1000, 2)

    if response is None:
        return {
            "target_url": raw_url,
            "final_url": None,
            "status_code": None,
            "score": 10.0,
            "summary": f"Unable to reach target. Last error: {error}",
            "findings": [
                {
                    "id": "unreachable",
                    "severity": "high",
                    "title": "Target unreachable",
                    "description": "The scanner could not establish a successful HTTP connection.",
                    "recommendation": "Verify DNS, firewall rules, and ensure the host is reachable from the scanner.",
                }
            ],
            "headers": {},
            "latency_ms": latency_ms,
        }

    headers = {k: v for k, v in response.headers.items()}
    missing = [name for name in REQUIRED_HEADERS if name not in headers]

    score = 100.0
    if not str(response.url).startswith("https://"):
        score -= 25
    score -= len(missing) * 8
    if "Server" in headers:
        score -= 5
    if response.status_code >= 400:
        score -= 10
    score = max(0.0, min(100.0, score))

    findings: List[Dict[str, str]] = []
    for header in missing:
        findings.append(
            {
                "id": header.lower().replace("-", "_"),
                "severity": "medium",
                "title": f"Missing {header}",
                "description": f"The {header} header was not detected in the response.",
                "recommendation": REQUIRED_HEADERS[header],
            }
        )

    if "Server" in headers:
        findings.append(
            {
                "id": "server_header",
                "severity": "low",
                "title": "Server banner exposed",
                "description": "The Server header discloses platform details.",
                "recommendation": "Disable or minimize server signature exposure.",
            }
        )

    if str(response.url).startswith("http://"):
        findings.append(
            {
                "id": "https_enforcement",
                "severity": "high",
                "title": "HTTPS not enforced",
                "description": "Target is reachable over HTTP without strict HTTPS enforcement.",
                "recommendation": "Redirect HTTP to HTTPS and enable HSTS.",
            }
        )

    summary = f"Status {response.status_code} · {len(findings)} findings · score {round(score)}"

    return {
        "target_url": raw_url,
        "final_url": str(response.url),
        "status_code": str(response.status_code),
        "score": score,
        "summary": summary,
        "findings": findings,
        "headers": headers,
        "latency_ms": latency_ms,
    }
