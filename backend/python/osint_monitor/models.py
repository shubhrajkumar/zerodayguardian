from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass(frozen=True)
class ScrapedArticle:
    source_name: str
    source_url: str
    article_url: str
    title: str
    published_at: str
    summary: str
    raw_text: str


@dataclass(frozen=True)
class DetectionResult:
    source_name: str
    source_url: str
    article_url: str
    title: str
    published_at: str
    summary: str
    matched_keywords: tuple[str, ...] = field(default_factory=tuple)
    matched_domains: tuple[str, ...] = field(default_factory=tuple)
    confidence_score: int = 0
    detected_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@dataclass(frozen=True)
class SourceFetchResult:
    source_name: str
    source_url: str
    success: bool
    items: list[ScrapedArticle] = field(default_factory=list)
    error_message: str = ""
    skipped: bool = False


@dataclass(frozen=True)
class SourceCycleResult:
    source_name: str
    source_url: str
    success: bool
    skipped: bool = False
    fetched_items: int = 0
    detections: int = 0
    new_alerts: int = 0
    error_message: str = ""


@dataclass(frozen=True)
class MonitorCycleResult:
    sources_checked: int
    scraped_items: int
    detections: int
    new_alerts: int
    source_failures: int
    skipped_sources: int
    started_at: str
    finished_at: str
    source_results: list[SourceCycleResult] = field(default_factory=list)
