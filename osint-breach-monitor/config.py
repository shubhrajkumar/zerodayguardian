from __future__ import annotations

import os
import random
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable


DEFAULT_KEYWORDS = (
    "breach",
    "leak",
    "leaked",
    "dump",
    "database",
    "exposed",
    "compromised",
    "stolen",
    "credentials",
    "passwords",
    "data breach",
    "data leak",
    "credential dump",
)

DEFAULT_DOMAIN_PATTERNS = (
    "gmail.com",
    "yahoo.com",
    "hotmail.com",
    "outlook.com",
    "icloud.com",
    "proton.me",
    "protonmail.com",
)


@dataclass(frozen=True)
class SourceConfig:
    name: str
    url: str
    item_selector: str = "article, .post, .news-item, li"
    title_selector: str = "h1, h2, h3, .entry-title, .post-title, a"
    date_selector: str = "time, .date, .post-date, .entry-date"
    summary_selector: str = "p, .excerpt, .summary"
    link_selector: str = "a"
    max_items: int = 12


@dataclass(frozen=True)
class Settings:
    run_interval_seconds: int = int(os.getenv("OSINT_RUN_INTERVAL_SECONDS", str(6 * 60 * 60)))
    request_timeout_seconds: int = int(os.getenv("OSINT_REQUEST_TIMEOUT_SECONDS", "20"))
    delay_min_seconds: float = float(os.getenv("OSINT_DELAY_MIN_SECONDS", "2.0"))
    delay_max_seconds: float = float(os.getenv("OSINT_DELAY_MAX_SECONDS", "4.5"))
    user_agent: str = os.getenv(
        "OSINT_USER_AGENT",
        "ZeroDayGuardian-OSINTMonitor/2.0 (+https://example.invalid/contact; lawful public monitoring)",
    )
    storage_file: Path = Path(os.getenv("OSINT_STORAGE_FILE", Path(__file__).with_name("storage.json")))
    log_file: Path = Path(os.getenv("OSINT_LOG_FILE", Path(__file__).with_name("monitor.log")))
    log_level: str = os.getenv("OSINT_LOG_LEVEL", "INFO").upper()
    state_file: Path = Path(os.getenv("OSINT_STATE_FILE", Path(__file__).with_name("runtime-state.json")))
    respect_robots_txt: bool = os.getenv("OSINT_RESPECT_ROBOTS", "true").lower() != "false"
    dedup_retention_days: int = int(os.getenv("OSINT_DEDUP_RETENTION_DAYS", "30"))
    confidence_threshold: int = int(os.getenv("OSINT_CONFIDENCE_THRESHOLD", "35"))
    source_error_backoff_limit: int = int(os.getenv("OSINT_SOURCE_ERROR_BACKOFF_LIMIT", "3"))
    source_disable_minutes: int = int(os.getenv("OSINT_SOURCE_DISABLE_MINUTES", "180"))
    max_keyword_suggestions: int = int(os.getenv("OSINT_MAX_KEYWORD_SUGGESTIONS", "20"))
    telegram_bot_token: str = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    telegram_chat_id: str = os.getenv("TELEGRAM_CHAT_ID", "").strip()
    telegram_enabled: bool = os.getenv("OSINT_ENABLE_TELEGRAM", "true").lower() != "false"
    source_limit_per_run: int = int(os.getenv("OSINT_SOURCE_LIMIT_PER_RUN", "50"))
    keywords: tuple[str, ...] = field(default_factory=lambda: tuple(_split_csv("OSINT_KEYWORDS", DEFAULT_KEYWORDS)))
    domain_patterns: tuple[str, ...] = field(
        default_factory=lambda: tuple(_split_csv("OSINT_DOMAIN_PATTERNS", DEFAULT_DOMAIN_PATTERNS))
    )
    sources: tuple[SourceConfig, ...] = field(default_factory=lambda: _load_default_sources())

    def random_delay_seconds(self) -> float:
        return random.uniform(self.delay_min_seconds, self.delay_max_seconds)

    def telegram_configured(self) -> bool:
        return bool(self.telegram_bot_token and self.telegram_chat_id and self.telegram_enabled)


def _split_csv(env_name: str, fallback: Iterable[str]) -> list[str]:
    raw = os.getenv(env_name, "").strip()
    if not raw:
        return [item.strip().lower() for item in fallback if item.strip()]
    return [item.strip().lower() for item in raw.split(",") if item.strip()]


def _load_default_sources() -> tuple[SourceConfig, ...]:
    return (
        SourceConfig(
            name="BleepingComputer Data Breach",
            url="https://www.bleepingcomputer.com/tag/data-breach/",
            item_selector="div.bc_latest_news_text, article, li",
            title_selector="h4, h2, a",
            date_selector="li.bc_news_date, time, .bc_news_date",
            summary_selector="p",
            link_selector="a",
            max_items=10,
        ),
        SourceConfig(
            name="Security Affairs Data Breach",
            url="https://securityaffairs.com/category/data-breach",
            item_selector="article, .post",
            title_selector="h2.entry-title, h3.entry-title, a",
            date_selector="time, .entry-date, .td-post-date time",
            summary_selector=".entry-content p, .td-excerpt, p",
            link_selector="a",
            max_items=10,
        ),
        SourceConfig(
            name="The Record Data Breach",
            url="https://therecord.media/tag/data-breach",
            item_selector="article, li",
            title_selector="h3, h2, a",
            date_selector="time, .post-card__date",
            summary_selector="p, .post-card__description",
            link_selector="a",
            max_items=10,
        ),
    )


def validate_settings(settings: Settings) -> list[str]:
    warnings: list[str] = []
    if settings.delay_min_seconds < 1:
        warnings.append("Minimum request delay is below 1 second; increase it for safer scraping.")
    if settings.delay_max_seconds < settings.delay_min_seconds:
        warnings.append("Maximum request delay is lower than minimum delay.")
    if settings.run_interval_seconds < 3600:
        warnings.append("Run interval is below one hour; this may be too aggressive for public sources.")
    if not settings.telegram_configured():
        warnings.append("Telegram is not fully configured; alerts will be logged locally only.")
    if not settings.sources:
        warnings.append("No sources are configured.")
    return warnings
