from __future__ import annotations

import json
import logging
import re
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable

from detector import DetectionResult, ScrapedItem


LOGGER = logging.getLogger(__name__)
STOPWORDS = {
    "about", "after", "again", "alert", "also", "been", "breach", "could", "data", "from", "have", "into",
    "leak", "more", "news", "only", "over", "public", "records", "reported", "report", "said", "source",
    "that", "their", "there", "these", "they", "this", "through", "under", "users", "with", "would",
}


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class SourceHealth:
    success_count: int = 0
    error_count: int = 0
    consecutive_errors: int = 0
    last_success_at: str = ""
    last_error_at: str = ""
    disabled_until: str = ""
    last_error_message: str = ""


@dataclass
class RuntimeState:
    source_health: dict[str, SourceHealth] = field(default_factory=dict)
    keyword_suggestions: dict[str, int] = field(default_factory=dict)
    last_cycle_at: str = ""


class ImprovementEngine:
    def __init__(self, state_file: Path, disable_minutes: int, error_backoff_limit: int, max_keyword_suggestions: int) -> None:
        self.state_file = Path(state_file)
        self.state_file.parent.mkdir(parents=True, exist_ok=True)
        self.disable_minutes = disable_minutes
        self.error_backoff_limit = error_backoff_limit
        self.max_keyword_suggestions = max_keyword_suggestions
        self.state = RuntimeState()
        self._load()

    def _load(self) -> None:
        if not self.state_file.exists():
            self._save()
            return
        try:
            raw = json.loads(self.state_file.read_text(encoding="utf-8"))
            self.state = RuntimeState(
                source_health={
                    name: SourceHealth(**payload)
                    for name, payload in raw.get("source_health", {}).items()
                    if isinstance(payload, dict)
                },
                keyword_suggestions={
                    str(key): int(value)
                    for key, value in raw.get("keyword_suggestions", {}).items()
                },
                last_cycle_at=str(raw.get("last_cycle_at", "")),
            )
        except (OSError, ValueError, TypeError) as exc:
            LOGGER.warning("Improvement state could not be loaded: %s", exc)
            self.state = RuntimeState()
            self._save()

    def _save(self) -> None:
        payload = {
            "source_health": {
                name: vars(health)
                for name, health in self.state.source_health.items()
            },
            "keyword_suggestions": dict(
                Counter(self.state.keyword_suggestions).most_common(self.max_keyword_suggestions)
            ),
            "last_cycle_at": self.state.last_cycle_at,
        }
        self.state_file.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    def should_scrape_source(self, source_name: str) -> bool:
        health = self.state.source_health.get(source_name)
        if not health or not health.disabled_until:
            return True
        return _parse_datetime(health.disabled_until) <= utc_now()

    def rank_sources(self, sources: Iterable) -> list:
        def score(source) -> tuple[int, int]:
            health = self.state.source_health.get(source.name, SourceHealth())
            return (health.consecutive_errors, -health.success_count)

        return sorted(list(sources), key=score)

    def record_source_success(self, source_name: str) -> None:
        health = self.state.source_health.setdefault(source_name, SourceHealth())
        health.success_count += 1
        health.consecutive_errors = 0
        health.last_success_at = utc_now().isoformat()
        health.disabled_until = ""
        self._save()

    def record_source_error(self, source_name: str, message: str) -> None:
        health = self.state.source_health.setdefault(source_name, SourceHealth())
        health.error_count += 1
        health.consecutive_errors += 1
        health.last_error_at = utc_now().isoformat()
        health.last_error_message = message[:300]
        if health.consecutive_errors >= self.error_backoff_limit:
            health.disabled_until = (utc_now() + timedelta(minutes=self.disable_minutes)).isoformat()
        self._save()

    def learn_from_cycle(self, scraped_items: Iterable[ScrapedItem], detections: Iterable[DetectionResult], configured_keywords: Iterable[str]) -> None:
        configured = {keyword.lower() for keyword in configured_keywords}
        positive_urls = {detection.article_url for detection in detections}
        candidate_counter: Counter[str] = Counter(self.state.keyword_suggestions)

        for item in scraped_items:
            if item.article_url in positive_urls:
                text = f"{item.title} {item.summary} {item.raw_text}".lower()
                for token in re.findall(r"\b[a-z][a-z0-9-]{4,24}\b", text):
                    if token in configured or token in STOPWORDS:
                        continue
                    candidate_counter[token] += 1

        self.state.keyword_suggestions = dict(candidate_counter.most_common(self.max_keyword_suggestions))
        self.state.last_cycle_at = utc_now().isoformat()
        self._save()

    def get_runtime_insights(self) -> dict[str, object]:
        degraded_sources = {
            name: vars(health)
            for name, health in self.state.source_health.items()
            if health.consecutive_errors or health.disabled_until
        }
        return {
            "last_cycle_at": self.state.last_cycle_at,
            "degraded_sources": degraded_sources,
            "keyword_suggestions": self.state.keyword_suggestions,
        }


def _parse_datetime(value: str) -> datetime:
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return utc_now()
