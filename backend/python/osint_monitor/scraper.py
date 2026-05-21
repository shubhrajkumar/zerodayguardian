from __future__ import annotations

import logging
import time
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser
import xml.etree.ElementTree as ET

import requests
from bs4 import BeautifulSoup
from bs4 import XMLParsedAsHTMLWarning
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import warnings

from .config import MonitorSettings, SourceConfig
from .models import ScrapedArticle, SourceFetchResult


LOGGER = logging.getLogger(__name__)


class PublicSourceScraper:
    def __init__(self, settings: MonitorSettings) -> None:
        self.settings = settings
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": settings.user_agent,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            }
        )
        retry = Retry(
            total=2,
            connect=2,
            read=2,
            backoff_factor=1.0,
            allowed_methods=frozenset({"GET", "HEAD"}),
            status_forcelist=(429, 500, 502, 503, 504),
            raise_on_status=False,
        )
        adapter = HTTPAdapter(max_retries=retry, pool_connections=10, pool_maxsize=10)
        self.session.mount("https://", adapter)
        self.session.mount("http://", adapter)
        self._robots_cache: dict[str, RobotFileParser] = {}

    def scrape_source(self, source: SourceConfig) -> SourceFetchResult:
        if not source.is_valid():
            return SourceFetchResult(
                source_name=source.name,
                source_url=source.url,
                success=False,
                error_message="invalid_source_url",
            )
        if not self.settings.allow_http_sources and urlparse(source.url).scheme != "https":
            return SourceFetchResult(
                source_name=source.name,
                source_url=source.url,
                success=False,
                skipped=True,
                error_message="http_source_disabled",
            )
        if self.settings.respect_robots and not self._allowed(source.url):
            return SourceFetchResult(
                source_name=source.name,
                source_url=source.url,
                success=False,
                skipped=True,
                error_message="robots_txt_blocked",
            )

        html = self._fetch_html(source.url)
        if not html:
            return SourceFetchResult(source_name=source.name, source_url=source.url, success=False, error_message="fetch_failed")

        if source.parser_mode.lower() == "xml":
            return self._scrape_xml_source(source, html)

        soup = BeautifulSoup(html, self._parser_for(source))
        items: list[ScrapedArticle] = []
        seen_links: set[str] = set()

        for node in soup.select(source.item_selector):
            link_node = node.select_one(source.link_selector)
            title_node = node.select_one(source.title_selector)
            if not link_node or not title_node:
                continue

            href = str(link_node.get("href") or "").strip()
            if not href and link_node.name == "link":
                href = str(link_node.get_text(" ", strip=True))
            if not href:
                continue
            article_url = urljoin(source.url, href)
            if not self._is_safe_article_url(article_url):
                continue
            if article_url in seen_links:
                continue
            seen_links.add(article_url)

            title = " ".join(title_node.get_text(" ", strip=True).split())
            if not title:
                continue

            date_node = node.select_one(source.date_selector)
            summary_node = node.select_one(source.summary_selector)

            items.append(
                ScrapedArticle(
                    source_name=source.name,
                    source_url=source.url,
                    article_url=article_url,
                    title=title,
                    published_at=self._extract_date(date_node),
                    summary=self._extract_text(summary_node, self.settings.max_summary_chars),
                    raw_text=self._extract_text(node, self.settings.max_raw_text_chars),
                )
            )
            if len(items) >= source.max_items:
                break

        return SourceFetchResult(source_name=source.name, source_url=source.url, success=True, items=items)

    def _scrape_xml_source(self, source: SourceConfig, xml_text: str) -> SourceFetchResult:
        try:
            root = ET.fromstring(xml_text)
        except ET.ParseError as exc:
            LOGGER.error("OSINT XML parse failed for %s: %s", source.url, exc)
            return SourceFetchResult(source_name=source.name, source_url=source.url, success=False, error_message="xml_parse_failed")

        items: list[ScrapedArticle] = []
        seen_links: set[str] = set()
        item_tags = self._selector_names(source.item_selector)
        title_tags = self._selector_names(source.title_selector)
        date_tags = self._selector_names(source.date_selector)
        summary_tags = self._selector_names(source.summary_selector)
        link_tags = self._selector_names(source.link_selector)

        for node in root.iter():
            if self._local_name(node.tag) not in item_tags:
                continue

            article_url = self._extract_xml_link(node, link_tags, source.url)
            if not article_url or not self._is_safe_article_url(article_url) or article_url in seen_links:
                continue
            seen_links.add(article_url)

            title = self._extract_xml_text(node, title_tags)
            if not title:
                continue

            items.append(
                ScrapedArticle(
                    source_name=source.name,
                    source_url=source.url,
                    article_url=article_url,
                    title=title,
                    published_at=self._extract_xml_text(node, date_tags),
                    summary=self._extract_xml_text(node, summary_tags)[: self.settings.max_summary_chars],
                    raw_text=self._extract_xml_text(node, summary_tags)[: self.settings.max_raw_text_chars],
                )
            )
            if len(items) >= source.max_items:
                break

        return SourceFetchResult(source_name=source.name, source_url=source.url, success=True, items=items)

    def close(self) -> None:
        self.session.close()

    def _fetch_html(self, url: str) -> str | None:
        time.sleep(self.settings.random_delay_seconds())
        try:
            response = self.session.get(url, timeout=self.settings.request_timeout_seconds)
            response.raise_for_status()
            content_type = response.headers.get("Content-Type", "").lower()
            if not any(
                allowed in content_type
                for allowed in ("text/html", "application/xhtml+xml", "application/rss+xml", "application/atom+xml", "text/xml", "application/xml")
            ):
                return None
            return response.text
        except requests.RequestException as exc:
            LOGGER.error("OSINT fetch failed for %s: %s", url, exc)
            return None

    @staticmethod
    def _is_safe_article_url(url: str) -> bool:
        parsed = urlparse(url)
        return parsed.scheme in {"https", "http"} and bool(parsed.netloc)

    @staticmethod
    def _parser_for(source: SourceConfig) -> str:
        warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)
        return "html.parser"

    @staticmethod
    def _selector_names(selector: str) -> set[str]:
        return {part.strip().lower() for part in selector.split(",") if part.strip()}

    @staticmethod
    def _local_name(tag: str) -> str:
        return tag.split("}", 1)[-1].lower()

    def _extract_xml_text(self, node: ET.Element, candidate_tags: set[str]) -> str:
        for child in node.iter():
            if self._local_name(child.tag) in candidate_tags:
                text = " ".join("".join(child.itertext()).split())
                if text:
                    return text
        return ""

    def _extract_xml_link(self, node: ET.Element, candidate_tags: set[str], source_url: str) -> str:
        for child in node.iter():
            if self._local_name(child.tag) not in candidate_tags:
                continue
            href = (child.attrib.get("href") or "").strip()
            text_value = " ".join("".join(child.itertext()).split())
            link = href or text_value
            if link:
                return urljoin(source_url, link)
        return ""

    def _allowed(self, url: str) -> bool:
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
    def _extract_text(node, limit: int) -> str:
        if node is None:
            return ""
        for removable in node.select("script, style, noscript"):
            removable.decompose()
        return " ".join(node.get_text(" ", strip=True).split())[:limit]

    @staticmethod
    def _extract_date(node) -> str:
        if node is None:
            return ""
        return node.get("datetime") or node.get("content") or " ".join(node.get_text(" ", strip=True).split())
