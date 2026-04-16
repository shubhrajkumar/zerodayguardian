from __future__ import annotations

import os
import random
from dataclasses import asdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable
import json
from urllib.parse import urlparse


DEFAULT_KEYWORDS = (
    "breach",
    "leak",
    "leaked",
    "dump",
    "database",
    "exposed",
    "compromised",
    "credentials",
    "passwords",
    "stolen",
    "data breach",
    "data leak",
)

DEFAULT_DOMAIN_PATTERNS = (
    "gmail.com",
    "yahoo.com",
    "hotmail.com",
    "outlook.com",
    "icloud.com",
    "protonmail.com",
)

IS_VERCEL = os.getenv("VERCEL", "").strip().lower() in {"1", "true"}
SERVERLESS_STORAGE_ROOT = Path("/tmp/zeroday-guardian-osint") if IS_VERCEL else Path(__file__).resolve().parent.parent


@dataclass(frozen=True)
class SourceConfig:
    name: str
    url: str
    parser_mode: str = "html"
    item_selector: str = "article, .post, .news-item, li"
    title_selector: str = "h1, h2, h3, .entry-title, .post-title, a"
    date_selector: str = "time, .date, .post-date, .entry-date"
    summary_selector: str = "p, .excerpt, .summary"
    link_selector: str = "a"
    max_items: int = 10

    def is_valid(self) -> bool:
        parsed = urlparse(self.url)
        return bool(self.name.strip() and parsed.scheme in {"https", "http"} and parsed.netloc)


@dataclass(frozen=True)
class MonitorSettings:
    enabled: bool = os.getenv("PY_OSINT_MONITOR_ENABLED", "true").lower() != "false"
    run_interval_seconds: int = int(os.getenv("PY_OSINT_RUN_INTERVAL_SECONDS", str(6 * 60 * 60)))
    request_timeout_seconds: int = int(os.getenv("PY_OSINT_REQUEST_TIMEOUT_SECONDS", "20"))
    delay_min_seconds: float = float(os.getenv("PY_OSINT_DELAY_MIN_SECONDS", "2.0"))
    delay_max_seconds: float = float(os.getenv("PY_OSINT_DELAY_MAX_SECONDS", "4.0"))
    source_limit_per_run: int = int(os.getenv("PY_OSINT_SOURCE_LIMIT_PER_RUN", "40"))
    max_sources_per_cycle: int = int(os.getenv("PY_OSINT_MAX_SOURCES_PER_CYCLE", "10"))
    confidence_threshold: int = int(os.getenv("PY_OSINT_CONFIDENCE_THRESHOLD", "35"))
    dedupe_retention_days: int = int(os.getenv("PY_OSINT_DEDUPE_RETENTION_DAYS", "30"))
    max_summary_chars: int = int(os.getenv("PY_OSINT_MAX_SUMMARY_CHARS", "400"))
    max_raw_text_chars: int = int(os.getenv("PY_OSINT_MAX_RAW_TEXT_CHARS", "1200"))
    max_alerts_per_cycle: int = int(os.getenv("PY_OSINT_MAX_ALERTS_PER_CYCLE", "20"))
    allow_http_sources: bool = os.getenv("PY_OSINT_ALLOW_HTTP_SOURCES", "false").lower() == "true"
    log_file: Path = Path(os.getenv("PY_OSINT_LOG_FILE", SERVERLESS_STORAGE_ROOT / "osint-monitor.log"))
    storage_file: Path = Path("osint-storage.json")
    sources_file: Path | None = (
        Path(os.getenv("PY_OSINT_SOURCES_FILE")).expanduser()
        if os.getenv("PY_OSINT_SOURCES_FILE", "").strip()
        else None
    )
    user_agent: str = os.getenv(
        "PY_OSINT_USER_AGENT",
        "ZeroDayGuardian-OSINTMonitor/1.0 (+https://example.invalid/contact; public lawful monitoring)",
    )
    respect_robots: bool = os.getenv("PY_OSINT_RESPECT_ROBOTS", "true").lower() != "false"
    telegram_bot_token: str = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    telegram_chat_id: str = os.getenv("TELEGRAM_CHAT_ID", "").strip()
    keywords: tuple[str, ...] = field(default_factory=lambda: tuple(_split_csv("PY_OSINT_KEYWORDS", DEFAULT_KEYWORDS)))
    domain_patterns: tuple[str, ...] = field(
        default_factory=lambda: tuple(_split_csv("PY_OSINT_DOMAIN_PATTERNS", DEFAULT_DOMAIN_PATTERNS))
    )
    sources: tuple[SourceConfig, ...] = field(default_factory=lambda: _load_sources())

    def random_delay_seconds(self) -> float:
        return random.uniform(self.delay_min_seconds, self.delay_max_seconds)

    def telegram_configured(self) -> bool:
        return bool(self.telegram_bot_token and self.telegram_chat_id)


def _split_csv(env_name: str, fallback: Iterable[str]) -> list[str]:
    raw = os.getenv(env_name, "").strip()
    if not raw:
        return [item.strip().lower() for item in fallback if item.strip()]
    return [item.strip().lower() for item in raw.split(",") if item.strip()]


def _default_sources() -> tuple[SourceConfig, ...]:
    return (
        SourceConfig(
            name="Krebs on Security Feed",
            url="https://krebsonsecurity.com/feed/",
            parser_mode="xml",
            item_selector="item",
            title_selector="title",
            date_selector="pubDate",
            summary_selector="description",
            link_selector="link",
            max_items=10,
        ),
        SourceConfig(
            name="The Hacker News Feed",
            url="https://feeds.feedburner.com/TheHackersNews",
            parser_mode="xml",
            item_selector="item",
            title_selector="title",
            date_selector="pubDate",
            summary_selector="description",
            link_selector="link",
            max_items=10,
        ),
        SourceConfig(
            name="Schneier on Security Atom Feed",
            url="https://www.schneier.com/feed/atom/",
            parser_mode="xml",
            item_selector="entry",
            title_selector="title",
            date_selector="updated, published",
            summary_selector="summary, content",
            link_selector="link",
            max_items=10,
        ),
    )


def _load_sources() -> tuple[SourceConfig, ...]:
    file_path = os.getenv("PY_OSINT_SOURCES_FILE", "").strip()
    if not file_path:
        return _default_sources()

    candidate = Path(file_path).expanduser()
    try:
        payload = json.loads(candidate.read_text(encoding="utf-8"))
    except (OSError, ValueError, TypeError):
        return _default_sources()

    source_rows = payload.get("sources", payload) if isinstance(payload, dict) else payload
    sources: list[SourceConfig] = []
    if isinstance(source_rows, list):
        for row in source_rows:
            if not isinstance(row, dict):
                continue
            try:
                source = SourceConfig(**row)
            except TypeError:
                continue
            if source.is_valid():
                sources.append(source)
    return tuple(sources) if sources else _default_sources()


def serialize_sources(sources: Iterable[SourceConfig]) -> list[dict[str, object]]:
    return [asdict(source) for source in sources]


def validate_monitor_settings(settings: MonitorSettings) -> list[str]:
    warnings: list[str] = []
    if settings.delay_max_seconds < settings.delay_min_seconds:
        warnings.append("OSINT delay max is lower than delay min.")
    if settings.run_interval_seconds < 3600:
        warnings.append("OSINT run interval is below one hour and may be too aggressive.")
    if settings.max_sources_per_cycle < 1:
        warnings.append("OSINT max sources per cycle must be at least 1.")
    if settings.source_limit_per_run < 1:
        warnings.append("OSINT source item limit per run must be at least 1.")
    if settings.max_alerts_per_cycle < 1:
        warnings.append("OSINT max alerts per cycle must be at least 1.")
    if not settings.sources:
        warnings.append("OSINT monitor has no configured sources.")
    invalid_sources = [source.name for source in settings.sources if not source.is_valid()]
    if invalid_sources:
        warnings.append(f"Invalid OSINT sources configured: {', '.join(invalid_sources[:5])}.")
    if not settings.allow_http_sources and any(urlparse(source.url).scheme == "http" for source in settings.sources):
        warnings.append("HTTP OSINT sources are configured but insecure sources are disabled.")
    if not settings.telegram_configured():
        warnings.append("Telegram is not configured; OSINT alerts will be logged only.")
    return warnings
