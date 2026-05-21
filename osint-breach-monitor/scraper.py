from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Iterable
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import requests
from bs4 import BeautifulSoup

from config import Settings, SourceConfig
from detector import ScrapedItem


LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True)
class SourceFetchResult:
    source: SourceConfig
    items: list[ScrapedItem]
    success: bool
    error_message: str = ""


class WebScraper:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": settings.user_agent,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            }
        )
        self._robots_cache: dict[str, RobotFileParser] = {}

    def scrape_sources(self, sources: Iterable[SourceConfig]) -> list[SourceFetchResult]:
        collected: list[SourceFetchResult] = []
        for source in sources:
            collected.append(self.scrape_source(source))
        return collected

    def scrape_source(self, source: SourceConfig) -> SourceFetchResult:
        if self.settings.respect_robots_txt and not self._is_allowed_by_robots(source.url):
            LOGGER.warning("Skipping %s because robots.txt disallows scraping.", source.url)
            return SourceFetchResult(source=source, items=[], success=False, error_message="robots_txt_blocked")

        html = self._fetch_html(source.url)
        if not html:
            return SourceFetchResult(source=source, items=[], success=False, error_message="fetch_failed")

        soup = BeautifulSoup(html, "html.parser")
        items: list[ScrapedItem] = []
        seen_links: set[str] = set()

        for node in soup.select(source.item_selector):
            link = self._extract_link(node, source)
            title = self._extract_text(node, source.title_selector)
            if not link or not title:
                continue
            absolute_link = urljoin(source.url, link)
            if absolute_link in seen_links:
                continue
            seen_links.add(absolute_link)

            if self.settings.respect_robots_txt and not self._is_allowed_by_robots(absolute_link):
                continue

            published_at = self._extract_date(node, source)
            summary = self._extract_summary(node, source)
            raw_text = self._extract_node_text(node)

            items.append(
                ScrapedItem(
                    source_name=source.name,
                    source_url=source.url,
                    article_url=absolute_link,
                    title=title,
                    published_at=published_at,
                    summary=summary,
                    raw_text=raw_text,
                )
            )
            if len(items) >= source.max_items:
                break

        LOGGER.info("Scraped %s candidate items from %s", len(items), source.name)
        return SourceFetchResult(source=source, items=items, success=True)

    def close(self) -> None:
        self.session.close()

    def _fetch_html(self, url: str) -> str | None:
        delay = self.settings.random_delay_seconds()
        time.sleep(delay)
        try:
            response = self.session.get(url, timeout=self.settings.request_timeout_seconds)
            response.raise_for_status()
            if "text/html" not in response.headers.get("Content-Type", ""):
                LOGGER.debug("Skipping non-HTML response from %s", url)
                return None
            return response.text
        except requests.RequestException as exc:
            LOGGER.error("Failed to fetch %s: %s", url, exc)
            return None

    def _is_allowed_by_robots(self, url: str) -> bool:
        parsed = urlparse(url)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
        parser = self._robots_cache.get(base_url)
        if parser is None:
            parser = RobotFileParser()
            parser.set_url(urljoin(base_url, "/robots.txt"))
            try:
                parser.read()
            except Exception as exc:
                LOGGER.warning("Could not read robots.txt for %s: %s", base_url, exc)
                return True
            self._robots_cache[base_url] = parser
        return parser.can_fetch(self.settings.user_agent, url)

    @staticmethod
    def _extract_text(node, selector: str) -> str:
        target = node.select_one(selector)
        if not target:
            return ""
        return " ".join(target.get_text(" ", strip=True).split())

    @staticmethod
    def _extract_summary(node, source: SourceConfig) -> str:
        summary = WebScraper._extract_text(node, source.summary_selector)
        return summary[:400]

    @staticmethod
    def _extract_date(node, source: SourceConfig) -> str:
        target = node.select_one(source.date_selector)
        if not target:
            return ""
        return (
            target.get("datetime")
            or target.get("content")
            or " ".join(target.get_text(" ", strip=True).split())
        )

    @staticmethod
    def _extract_link(node, source: SourceConfig) -> str:
        target = node.select_one(source.link_selector)
        if not target:
            return ""
        return str(target.get("href") or "").strip()

    @staticmethod
    def _extract_node_text(node) -> str:
        for removable in node.select("script, style, noscript"):
            removable.decompose()
        return " ".join(node.get_text(" ", strip=True).split())[:1200]
