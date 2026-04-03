from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Iterable


LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True)
class ScrapedItem:
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


class BreachDetector:
    def __init__(self, keywords: Iterable[str], domain_patterns: Iterable[str], confidence_threshold: int = 35) -> None:
        self.keywords = tuple(dict.fromkeys(keyword.strip().lower() for keyword in keywords if keyword.strip()))
        self.domain_patterns = tuple(dict.fromkeys(domain.strip().lower() for domain in domain_patterns if domain.strip()))
        self.confidence_threshold = confidence_threshold
        self._keyword_patterns = {
            keyword: re.compile(rf"\b{re.escape(keyword)}\b", re.IGNORECASE)
            for keyword in self.keywords
        }
        self._domain_patterns = {
            domain: re.compile(rf"(?:@|\b){re.escape(domain)}\b", re.IGNORECASE)
            for domain in self.domain_patterns
        }

    def analyze(self, item: ScrapedItem) -> DetectionResult | None:
        text = " ".join(part for part in [item.title, item.summary, item.raw_text] if part).strip()
        if not text:
            return None

        matched_keywords = tuple(keyword for keyword, pattern in self._keyword_patterns.items() if pattern.search(text))
        matched_domains = tuple(domain for domain, pattern in self._domain_patterns.items() if pattern.search(text))
        if not matched_keywords and not matched_domains:
            return None

        confidence = self._score(matched_keywords, matched_domains, text)
        if confidence < self.confidence_threshold:
            LOGGER.debug("Skipping low-confidence match for %s with score %s", item.article_url, confidence)
            return None

        sanitized_summary = self._sanitize_summary(item.summary or text)
        return DetectionResult(
            source_name=item.source_name,
            source_url=item.source_url,
            article_url=item.article_url,
            title=item.title,
            published_at=item.published_at,
            summary=sanitized_summary,
            matched_keywords=matched_keywords,
            matched_domains=matched_domains,
            confidence_score=confidence,
        )

    def analyze_batch(self, items: Iterable[ScrapedItem]) -> list[DetectionResult]:
        results: list[DetectionResult] = []
        for item in items:
            result = self.analyze(item)
            if result:
                results.append(result)
        return results

    def _score(self, matched_keywords: tuple[str, ...], matched_domains: tuple[str, ...], text: str) -> int:
        score = 0
        score += min(len(matched_keywords) * 18, 60)
        score += min(len(matched_domains) * 20, 40)
        if re.search(r"\b(credentials?|accounts?|emails?|users?)\b", text, re.IGNORECASE):
            score += 10
        if re.search(r"\b(million|thousand|records?)\b", text, re.IGNORECASE):
            score += 10
        return min(score, 100)

    def _sanitize_summary(self, text: str, max_length: int = 280) -> str:
        collapsed = re.sub(r"\s+", " ", text).strip()
        # Drop full email addresses or similar identifiers to avoid storing personal data.
        collapsed = re.sub(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", "[redacted-email]", collapsed, flags=re.IGNORECASE)
        return collapsed[: max_length - 1].rstrip() + ("..." if len(collapsed) > max_length else "")
