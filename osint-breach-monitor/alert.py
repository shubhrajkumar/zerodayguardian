from __future__ import annotations

import html
import logging
from dataclasses import dataclass

import requests

from detector import DetectionResult


LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True)
class TelegramConfig:
    bot_token: str
    chat_id: str
    enabled: bool = True

    def configured(self) -> bool:
        return bool(self.enabled and self.bot_token and self.chat_id)


class TelegramAlert:
    API_BASE_URL = "https://api.telegram.org/bot"

    def __init__(self, config: TelegramConfig, timeout_seconds: int = 15) -> None:
        self.config = config
        self.timeout_seconds = timeout_seconds
        self.session = requests.Session()

    def send_detection(self, detection: DetectionResult) -> bool:
        if not self.config.configured():
            LOGGER.info("Telegram alert skipped because configuration is incomplete.")
            return False

        payload = {
            "chat_id": self.config.chat_id,
            "text": self._format_detection(detection),
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        }

        try:
            response = self.session.post(
                f"{self.API_BASE_URL}{self.config.bot_token}/sendMessage",
                json=payload,
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
            data = response.json()
            if not data.get("ok"):
                LOGGER.error("Telegram API returned a non-ok response: %s", data)
                return False
            return True
        except requests.RequestException as exc:
            LOGGER.error("Telegram delivery failed: %s", exc)
            return False

    def _format_detection(self, detection: DetectionResult) -> str:
        title = html.escape(detection.title)
        summary = html.escape(detection.summary)
        article_url = html.escape(detection.article_url)
        source_name = html.escape(detection.source_name)
        published_at = html.escape(detection.published_at or "Unknown")
        keywords = ", ".join(detection.matched_keywords[:5]) or "n/a"
        domains = ", ".join(detection.matched_domains[:5]) or "n/a"
        return (
            "<b>OSINT Breach Monitor Alert</b>\n"
            f"<b>Title:</b> {title}\n"
            f"<b>Source:</b> {source_name}\n"
            f"<b>Published:</b> {published_at}\n"
            f"<b>Score:</b> {detection.confidence_score}/100\n"
            f"<b>Keywords:</b> {html.escape(keywords)}\n"
            f"<b>Domain patterns:</b> {html.escape(domains)}\n"
            f"<b>URL:</b> <a href=\"{article_url}\">{article_url}</a>\n"
            f"<b>Summary:</b> {summary}"
        )
