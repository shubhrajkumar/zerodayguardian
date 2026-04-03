from __future__ import annotations

import ipaddress
import re
import socket
from datetime import datetime, timezone
from typing import Any

import httpx


EMAIL_REGEX = re.compile(r"^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+$", re.IGNORECASE)
DOMAIN_REGEX = re.compile(
    r"^(?=.{1,253}$)(?!-)(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,63}$",
    re.IGNORECASE,
)
COMPLEX_QUERY_REGEX = re.compile(r"\b(compare|campaign|relationship|timeline|correlate|actor|cluster)\b", re.IGNORECASE)
WHOIS_SERVER_REGEX = re.compile(r"^(?:refer|whois):\s*(\S+)", re.IGNORECASE)
WHOIS_FIELD_PATTERNS = {
    "registrar": [
        re.compile(r"^Registrar:\s*(.+)$", re.IGNORECASE | re.MULTILINE),
        re.compile(r"^Sponsoring Registrar:\s*(.+)$", re.IGNORECASE | re.MULTILINE),
    ],
    "created": [
        re.compile(r"^Creation Date:\s*(.+)$", re.IGNORECASE | re.MULTILINE),
        re.compile(r"^Created On:\s*(.+)$", re.IGNORECASE | re.MULTILINE),
        re.compile(r"^Registered On:\s*(.+)$", re.IGNORECASE | re.MULTILINE),
    ],
    "updated": [
        re.compile(r"^Updated Date:\s*(.+)$", re.IGNORECASE | re.MULTILINE),
        re.compile(r"^Last Updated On:\s*(.+)$", re.IGNORECASE | re.MULTILINE),
    ],
    "expires": [
        re.compile(r"^Registry Expiry Date:\s*(.+)$", re.IGNORECASE | re.MULTILINE),
        re.compile(r"^Expiration Date:\s*(.+)$", re.IGNORECASE | re.MULTILINE),
        re.compile(r"^Expiry Date:\s*(.+)$", re.IGNORECASE | re.MULTILINE),
    ],
}
SHORT_TIMEOUT = 8.0
WHOIS_TIMEOUT = 8.0
NO_VERIFIED_DATA = "No verified data."
MAX_REASON_LINES = 3
MAX_BULLET_LINES = 3


class OsintIntelService:
    def __init__(self) -> None:
        self.client = httpx.Client(
            timeout=SHORT_TIMEOUT,
            headers={
                "User-Agent": "ZeroDayGuardian-Intel/2.0",
                "Accept": "application/json,text/plain,*/*",
            },
            follow_redirects=True,
        )

    def analyze(self, query: str, notes: str | None = None) -> dict[str, Any]:
        normalized = self._normalize(query)
        target_type = self._detect_type(normalized)
        ai_candidate = self._should_use_ai(normalized, notes)

        if target_type == "email":
            report = self._scan_email(normalized)
        elif target_type == "ip":
            report = self._scan_ip(normalized)
        else:
            report = self._scan_domain(normalized)

        report["query"] = query
        report["normalized_query"] = normalized
        report["target_type"] = target_type
        report["ai_used"] = False
        report["analysis_mode"] = "verified_multi_signal"
        report["minimal_ai_eligible"] = ai_candidate
        return report

    @staticmethod
    def _normalize(query: str) -> str:
        value = str(query or "").strip()
        if value.startswith(("http://", "https://")):
            try:
                value = httpx.URL(value).host or value
            except Exception:
                value = value.split("://", 1)[1]
        return value.strip().strip("/").lower()

    @staticmethod
    def _detect_type(value: str) -> str:
        if EMAIL_REGEX.match(value):
            return "email"
        try:
            ipaddress.ip_address(value)
            return "ip"
        except ValueError:
            return "domain"

    @staticmethod
    def _should_use_ai(query: str, notes: str | None) -> bool:
        combined = " ".join(part for part in [query, str(notes or "").strip()] if part)
        return len(combined) > 120 or bool(COMPLEX_QUERY_REGEX.search(combined))

    def _scan_email(self, email: str) -> dict[str, Any]:
        local_part, _, domain = email.partition("@")
        format_valid = bool(EMAIL_REGEX.match(email))
        domain_valid = bool(DOMAIN_REGEX.match(domain))
        a_records = self._resolve_dns(domain, "A") if domain_valid else []
        mx_records = self._resolve_dns(domain, "MX") if domain_valid else []
        ns_records = self._resolve_dns(domain, "NS") if domain_valid else []
        registration = self._lookup_registration_data(domain) if domain_valid else self._empty_registration()
        age_days = self._estimate_domain_age_days(registration.get("created"))

        verified_signals: list[str] = []
        reasons: list[str] = []
        bullets: list[str] = []

        if format_valid:
            verified_signals.append("email_format")
            reasons.append("Email format passed strict syntax validation.")
        else:
            reasons.append("Email format failed strict syntax validation.")

        if domain_valid:
            verified_signals.append("domain_syntax")
            reasons.append("Email domain passed hostname validation.")
        else:
            reasons.append("Email domain failed hostname validation.")

        if mx_records:
            verified_signals.append("mx")
            reasons.append("MX records were verified for the domain.")
            bullets.append(f"MX: {', '.join(mx_records[:2])}.")
        else:
            reasons.append("No MX records were verified.")

        if ns_records:
            verified_signals.append("ns")
            reasons.append("NS delegation records were verified.")

        if a_records:
            verified_signals.append("a")
            reasons.append("The mail domain resolves to at least one A record.")

        if registration.get("registrar"):
            verified_signals.append("registrar")
            reasons.append(f"Registration data was verified via {registration.get('source', 'registration lookup')}.")
            bullets.append(f"Registrar: {registration['registrar']}.")
        else:
            reasons.append("No registrar data could be verified.")

        if age_days is not None:
            verified_signals.append("domain_age")
            bullets.append(f"Domain age: about {age_days} day(s).")

        verified = self._enough_verified_data(verified_signals, {"mx", "ns", "registrar", "a"})
        risk_level, risk_score, risk_reasons = self._score_email(
            format_valid=format_valid,
            domain_valid=domain_valid,
            mx_records=mx_records,
            ns_records=ns_records,
            a_records=a_records,
            registration=registration,
            age_days=age_days,
        )
        reasons = self._limit_lines(risk_reasons + reasons, MAX_REASON_LINES)
        bullets = self._finalize_bullets(bullets, verified)

        return {
            "verified": verified,
            "risk_level": risk_level,
            "risk_score": risk_score,
            "reasons": reasons,
            "bullets": bullets,
            "checked_signals": ["format", "domain_syntax", "mx", "ns", "a", "registration"],
            "verified_signals": verified_signals,
            "data": {
                "email": email,
                "local_part_length": len(local_part),
                "domain": domain,
                "format_valid": format_valid,
                "domain_valid": domain_valid,
                "a_records": a_records,
                "mx_records": mx_records,
                "ns_records": ns_records,
                "registration": registration,
                "estimated_age_days": age_days,
            },
        }

    def _scan_domain(self, domain: str) -> dict[str, Any]:
        valid = bool(DOMAIN_REGEX.match(domain))
        a_records = self._resolve_dns(domain, "A") if valid else []
        mx_records = self._resolve_dns(domain, "MX") if valid else []
        ns_records = self._resolve_dns(domain, "NS") if valid else []
        registration = self._lookup_registration_data(domain) if valid else self._empty_registration()
        age_days = self._estimate_domain_age_days(registration.get("created"))

        verified_signals: list[str] = []
        reasons: list[str] = []
        bullets: list[str] = []

        if valid:
            verified_signals.append("domain_syntax")
            reasons.append("Domain syntax passed validation.")
        else:
            reasons.append("Domain syntax failed validation.")

        if a_records:
            verified_signals.append("a")
            reasons.append("A records resolved successfully.")
            bullets.append(f"A: {', '.join(a_records[:3])}.")
        else:
            reasons.append("No A records were verified.")

        if mx_records:
            verified_signals.append("mx")
            reasons.append("MX records resolved successfully.")
            bullets.append(f"MX: {', '.join(mx_records[:2])}.")

        if ns_records:
            verified_signals.append("ns")
            reasons.append("NS records resolved successfully.")
            bullets.append(f"NS: {', '.join(ns_records[:2])}.")
        else:
            reasons.append("No NS records were verified.")

        if registration.get("registrar"):
            verified_signals.append("registrar")
            reasons.append(f"Registration data was verified via {registration.get('source', 'registration lookup')}.")
            bullets.append(f"Registrar: {registration['registrar']}.")
        else:
            reasons.append("No registrar data could be verified.")

        if age_days is not None:
            verified_signals.append("domain_age")
            bullets.append(f"Domain age: about {age_days} day(s).")

        verified = self._enough_verified_data(verified_signals, {"a", "mx", "ns", "registrar"})
        risk_level, risk_score, risk_reasons = self._score_domain(
            valid=valid,
            a_records=a_records,
            mx_records=mx_records,
            ns_records=ns_records,
            registration=registration,
            age_days=age_days,
        )
        reasons = self._limit_lines(risk_reasons + reasons, MAX_REASON_LINES)
        bullets = self._finalize_bullets(bullets, verified)

        return {
            "verified": verified,
            "risk_level": risk_level,
            "risk_score": risk_score,
            "reasons": reasons,
            "bullets": bullets,
            "checked_signals": ["domain_syntax", "a", "mx", "ns", "registration"],
            "verified_signals": verified_signals,
            "data": {
                "domain": domain,
                "syntax_valid": valid,
                "a_records": a_records,
                "mx_records": mx_records,
                "ns_records": ns_records,
                "registration": registration,
                "estimated_age_days": age_days,
            },
        }

    def _scan_ip(self, ip_value: str) -> dict[str, Any]:
        reasons: list[str] = []
        bullets: list[str] = []
        verified_signals: list[str] = []

        try:
            ip_obj = ipaddress.ip_address(ip_value)
        except ValueError:
            return {
                "verified": False,
                "risk_level": "high",
                "risk_score": 90,
                "reasons": ["IP validation failed.", NO_VERIFIED_DATA],
                "bullets": [NO_VERIFIED_DATA],
                "checked_signals": ["ip_validation", "reverse_dns"],
                "verified_signals": [],
                "data": {"ip": ip_value, "valid": False, "reverse_dns": ""},
            }

        verified_signals.append("ip_validation")
        reasons.append("IP address format passed validation.")

        if ip_obj.is_private:
            reasons.append("Address is private and not internet-routable.")
        elif ip_obj.is_loopback:
            reasons.append("Address is loopback and not externally routable.")
        elif ip_obj.is_reserved:
            reasons.append("Address is reserved and may not represent a public asset.")
        else:
            reasons.append("Address is publicly routable.")

        rdns = self._reverse_dns(ip_value)
        if rdns:
            verified_signals.append("reverse_dns")
            reasons.append("Reverse DNS resolved successfully.")
            bullets.append(f"Reverse DNS: {rdns}.")
        else:
            reasons.append("Reverse DNS did not return a hostname.")

        verified = self._enough_verified_data(verified_signals, {"reverse_dns"})
        risk_level, risk_score, risk_reasons = self._score_ip(ip_obj=ip_obj, rdns=rdns)
        reasons = self._limit_lines(risk_reasons + reasons, MAX_REASON_LINES)
        bullets = self._finalize_bullets(bullets, verified)

        return {
            "verified": verified,
            "risk_level": risk_level,
            "risk_score": risk_score,
            "reasons": reasons,
            "bullets": bullets,
            "checked_signals": ["ip_validation", "reverse_dns"],
            "verified_signals": verified_signals,
            "data": {
                "ip": ip_value,
                "valid": True,
                "version": ip_obj.version,
                "is_private": ip_obj.is_private,
                "is_loopback": ip_obj.is_loopback,
                "is_reserved": ip_obj.is_reserved,
                "reverse_dns": rdns,
            },
        }

    def _resolve_dns(self, name: str, record_type: str) -> list[str]:
        try:
            response = self.client.get("https://dns.google/resolve", params={"name": name, "type": record_type})
            response.raise_for_status()
            payload = response.json()
        except Exception:
            return []

        answers = payload.get("Answer", [])
        if not isinstance(answers, list):
            return []

        values: list[str] = []
        for answer in answers:
            if not isinstance(answer, dict):
                continue
            data = str(answer.get("data") or "").strip()
            if not data:
                continue
            if record_type == "MX":
                data = " ".join(data.split()[1:]) or data
            normalized = data.rstrip(".").strip()
            if normalized:
                values.append(normalized)
        return values[:10]

    def _lookup_registration_data(self, domain: str) -> dict[str, Any]:
        rdap = self._lookup_rdap_domain(domain)
        if rdap.get("registrar") or rdap.get("created"):
            return rdap

        whois = self._lookup_whois_domain(domain)
        if whois.get("registrar") or whois.get("created"):
            return whois

        return self._empty_registration()

    def _lookup_rdap_domain(self, domain: str) -> dict[str, Any]:
        try:
            response = self.client.get(f"https://rdap.org/domain/{domain}")
            if response.status_code >= 400:
                return self._empty_registration()
            payload = response.json()
        except Exception:
            return self._empty_registration()

        registrar = ""
        entities = payload.get("entities", [])
        if isinstance(entities, list):
            for entity in entities:
                if not isinstance(entity, dict):
                    continue
                roles = entity.get("roles", [])
                if isinstance(roles, list) and "registrar" in roles:
                    registrar = str(entity.get("handle") or "").strip()
                    break

        created = ""
        updated = ""
        expires = ""
        events = payload.get("events", [])
        if isinstance(events, list):
            for event in events:
                if not isinstance(event, dict):
                    continue
                action = str(event.get("eventAction") or "").lower()
                event_date = str(event.get("eventDate") or "").strip()
                if action == "registration" and not created:
                    created = event_date
                elif action in {"last changed", "last update of rdap database"} and not updated:
                    updated = event_date
                elif action == "expiration" and not expires:
                    expires = event_date

        return {
            "source": "rdap",
            "registrar": registrar,
            "created": created,
            "updated": updated,
            "expires": expires,
            "statuses": payload.get("status", []) if isinstance(payload.get("status"), list) else [],
            "handle": str(payload.get("handle") or "").strip(),
        }

    def _lookup_whois_domain(self, domain: str) -> dict[str, Any]:
        server = self._discover_whois_server(domain)
        if not server:
            return self._empty_registration()

        raw = self._query_whois_server(server, domain)
        if not raw:
            return self._empty_registration()

        parsed = {"source": "whois", "registrar": "", "created": "", "updated": "", "expires": "", "statuses": [], "handle": ""}
        for field, patterns in WHOIS_FIELD_PATTERNS.items():
            for pattern in patterns:
                match = pattern.search(raw)
                if match:
                    parsed[field] = match.group(1).strip()
                    break

        statuses = []
        for line in raw.splitlines():
            line = line.strip()
            if line.lower().startswith("status:"):
                status = line.split(":", 1)[1].strip()
                if status:
                    statuses.append(status)
        parsed["statuses"] = statuses[:10]
        return parsed

    def _discover_whois_server(self, domain: str) -> str:
        tld = domain.rsplit(".", 1)[-1].strip().lower()
        if not tld:
            return ""

        response = self._query_whois_server("whois.iana.org", tld)
        if response:
            for line in response.splitlines():
                match = WHOIS_SERVER_REGEX.match(line.strip())
                if match:
                    return match.group(1).strip()

        fallback_map = {
            "com": "whois.verisign-grs.com",
            "net": "whois.verisign-grs.com",
            "org": "whois.pir.org",
            "info": "whois.afilias.net",
            "io": "whois.nic.io",
        }
        return fallback_map.get(tld, "")

    @staticmethod
    def _query_whois_server(server: str, query: str) -> str:
        if not server or not query:
            return ""
        chunks: list[str] = []
        try:
            with socket.create_connection((server, 43), timeout=WHOIS_TIMEOUT) as sock:
                sock.settimeout(WHOIS_TIMEOUT)
                sock.sendall(f"{query}\r\n".encode("utf-8"))
                while True:
                    data = sock.recv(4096)
                    if not data:
                        break
                    chunks.append(data.decode("utf-8", errors="replace"))
        except Exception:
            return ""
        return "".join(chunks).strip()

    @staticmethod
    def _reverse_dns(ip_value: str) -> str:
        try:
            hostname, _, _ = socket.gethostbyaddr(ip_value)
            return str(hostname).strip()
        except Exception:
            return ""

    @staticmethod
    def _estimate_domain_age_days(created: str | None) -> int | None:
        value = str(created or "").strip()
        if not value:
            return None
        candidates = [
            value.replace("Z", "+00:00"),
            value.split("T", 1)[0],
            value,
        ]
        for candidate in candidates:
            try:
                parsed = datetime.fromisoformat(candidate)
                if parsed.tzinfo is None:
                    parsed = parsed.replace(tzinfo=timezone.utc)
                return max(0, (datetime.now(timezone.utc) - parsed).days)
            except ValueError:
                continue
        return None

    @staticmethod
    def _empty_registration() -> dict[str, Any]:
        return {"source": "", "registrar": "", "created": "", "updated": "", "expires": "", "statuses": [], "handle": ""}

    @staticmethod
    def _enough_verified_data(verified_signals: list[str], strong_signals: set[str]) -> bool:
        signal_set = set(verified_signals)
        return bool(signal_set & strong_signals) and len(signal_set) >= 2

    @staticmethod
    def _limit_lines(lines: list[str], limit: int) -> list[str]:
        deduped: list[str] = []
        for line in lines:
            cleaned = str(line or "").strip()
            if cleaned and cleaned not in deduped:
                deduped.append(cleaned)
            if len(deduped) >= limit:
                break
        return deduped

    @staticmethod
    def _finalize_bullets(lines: list[str], verified: bool) -> list[str]:
        bullets = OsintIntelService._limit_lines(lines, MAX_BULLET_LINES)
        if not verified:
            return [NO_VERIFIED_DATA]
        return bullets or [NO_VERIFIED_DATA]

    @staticmethod
    def _score_email(
        format_valid: bool,
        domain_valid: bool,
        mx_records: list[str],
        ns_records: list[str],
        a_records: list[str],
        registration: dict[str, Any],
        age_days: int | None,
    ) -> tuple[str, int, list[str]]:
        score = 10
        reasons: list[str] = []
        if not format_valid:
            score += 45
            reasons.append("High risk because the email format is invalid.")
        if not domain_valid:
            score += 30
            reasons.append("High risk because the domain syntax is invalid.")
        if not mx_records:
            score += 25
            reasons.append("Risk increased because no mail exchangers were verified.")
        if not ns_records:
            score += 12
            reasons.append("Risk increased because no authoritative name servers were verified.")
        if not a_records:
            score += 8
            reasons.append("Risk increased because the domain does not resolve to an A record.")
        if not registration.get("registrar"):
            score += 10
            reasons.append("Risk increased because registration ownership could not be verified.")
        if age_days is not None and age_days < 30:
            score += 18
            reasons.append("Risk increased because the domain appears newly registered.")
        elif age_days is not None and age_days < 180:
            score += 8
            reasons.append("Risk increased because the domain is relatively new.")
        if mx_records and ns_records and registration.get("registrar"):
            score -= 15
            reasons.append("Risk reduced because DNS and registration signals align.")
        risk_level, risk_score = OsintIntelService._risk_band(score)
        return risk_level, risk_score, reasons

    @staticmethod
    def _score_domain(
        valid: bool,
        a_records: list[str],
        mx_records: list[str],
        ns_records: list[str],
        registration: dict[str, Any],
        age_days: int | None,
    ) -> tuple[str, int, list[str]]:
        score = 12
        reasons: list[str] = []
        if not valid:
            score += 50
            reasons.append("High risk because the domain syntax is invalid.")
        if not a_records:
            score += 18
            reasons.append("Risk increased because no A records were verified.")
        if not mx_records:
            score += 8
            reasons.append("Risk increased because no MX records were verified.")
        if not ns_records:
            score += 18
            reasons.append("Risk increased because no NS records were verified.")
        if not registration.get("registrar"):
            score += 12
            reasons.append("Risk increased because registrar data could not be verified.")
        if age_days is not None and age_days < 30:
            score += 22
            reasons.append("Risk increased because the domain appears newly registered.")
        elif age_days is not None and age_days < 180:
            score += 10
            reasons.append("Risk increased because the domain is relatively new.")
        if a_records and ns_records and registration.get("registrar"):
            score -= 18
            reasons.append("Risk reduced because DNS and registration signals align.")
        risk_level, risk_score = OsintIntelService._risk_band(score)
        return risk_level, risk_score, reasons

    @staticmethod
    def _score_ip(ip_obj: ipaddress._BaseAddress, rdns: str) -> tuple[str, int, list[str]]:
        score = 15
        reasons: list[str] = []
        if ip_obj.is_private:
            score += 28
            reasons.append("Risk increased because the address is private and not externally attributable.")
        if ip_obj.is_loopback:
            score += 35
            reasons.append("Risk increased because the address is loopback.")
        if ip_obj.is_reserved:
            score += 18
            reasons.append("Risk increased because the address is reserved.")
        if not rdns:
            score += 15
            reasons.append("Risk increased because reverse DNS could not be verified.")
        else:
            score -= 10
            reasons.append("Risk reduced because reverse DNS was verified.")
        risk_level, risk_score = OsintIntelService._risk_band(score)
        return risk_level, risk_score, reasons

    @staticmethod
    def _risk_band(score: int) -> tuple[str, int]:
        safe_score = max(0, min(100, score))
        if safe_score >= 70:
            return "high", safe_score
        if safe_score >= 35:
            return "medium", safe_score
        return "low", safe_score
