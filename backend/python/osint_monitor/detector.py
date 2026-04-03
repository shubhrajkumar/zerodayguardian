from __future__ import annotations

import re
from typing import Iterable

from .models import DetectionResult, ScrapedArticle


class BreachDetector:
    def __init__(self, keywords: Iterable[str], domain_patterns: Iterable[str], confidence_threshold: int) -> None:
        self.confidence_threshold = confidence_threshold
        self.keywords = tuple(dict.fromkeys(keyword.strip().lower() for keyword in keywords if keyword.strip()))
        self.domain_patterns = tuple(dict.fromkeys(domain.strip().lower() for domain in domain_patterns if domain.strip()))
        self._keyword_patterns = {
            keyword: re.compile(rf"\b{re.escape(keyword)}\b", re.IGNORECASE)
            for keyword in self.keywords
        }
        self._domain_patterns = {
            domain: re.compile(rf"(?:@|\b){re.escape(domain)}\b", re.IGNORECASE)
            for domain in self.domain_patterns
        }

    def analyze_batch(self, articles: Iterable[ScrapedArticle]) -> list[DetectionResult]:
        return [result for article in articles if (result := self.analyze(article)) is not None]

    def analyze(self, article: ScrapedArticle) -> DetectionResult | None:
        text = " ".join(part for part in [article.title, article.summary, article.raw_text] if part).strip()
        if not text:
            return None

        matched_keywords = tuple(keyword for keyword, pattern in self._keyword_patterns.items() if pattern.search(text))
        matched_domains = tuple(domain for domain, pattern in self._domain_patterns.items() if pattern.search(text))
        if not matched_keywords and not matched_domains:
            return None

        confidence = self._score(matched_keywords, matched_domains, text)
        if confidence < self.confidence_threshold:
            return None

        return DetectionResult(
            source_name=article.source_name,
            source_url=article.source_url,
            article_url=article.article_url,
            title=article.title,
            published_at=article.published_at,
            summary=self._sanitize_summary(article.summary or text),
            matched_keywords=matched_keywords,
            matched_domains=matched_domains,
            confidence_score=confidence,
        )

    def _score(self, matched_keywords: tuple[str, ...], matched_domains: tuple[str, ...], text: str) -> int:
        score = min(len(matched_keywords) * 18, 60) + min(len(matched_domains) * 20, 40)
        if re.search(r"\b(credentials?|accounts?|emails?|users?)\b", text, re.IGNORECASE):
            score += 10
        if re.search(r"\b(records?|million|thousand)\b", text, re.IGNORECASE):
            score += 10
        return min(score, 100)

    def _sanitize_summary(self, text: str, max_length: int = 280) -> str:
        collapsed = re.sub(r"\s+", " ", text).strip()
        collapsed = re.sub(
            r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b",
            "[redacted-email]",
            collapsed,
            flags=re.IGNORECASE,
        )
        return collapsed[: max_length - 3].rstrip() + ("..." if len(collapsed) > max_length else "")

