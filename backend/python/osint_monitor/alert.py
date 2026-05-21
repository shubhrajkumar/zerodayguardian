from __future__ import annotations

import html
import logging

import requests

from .models import DetectionResult


LOGGER = logging.getLogger(__name__)


class TelegramAlertClient:
    def __init__(self, bot_token: str, chat_id: str) -> None:
        self.bot_token = bot_token
        self.chat_id = chat_id
        self.session = requests.Session()

    def configured(self) -> bool:
        return bool(self.bot_token and self.chat_id)

    def send_detection(self, detection: DetectionResult) -> bool:
        if not self.configured():
            return False
        payload = {
            "chat_id": self.chat_id,
            "text": self._format_message(detection),
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        }
        try:
            response = self.session.post(
                f"https://api.telegram.org/bot{self.bot_token}/sendMessage",
                json=payload,
                timeout=15,
            )
            response.raise_for_status()
            return bool(response.json().get("ok"))
        except requests.RequestException as exc:
            LOGGER.error("Telegram alert failed: %s", exc)
            return False

    def send_cycle_summary(self, sent_alerts: int, total_detections: int, source_failures: int) -> bool:
        if not self.configured():
            return False
        payload = {
            "chat_id": self.chat_id,
            "text": (
                "<b>OSINT Breach Monitor Cycle</b>\n"
                f"<b>Detections:</b> {total_detections}\n"
                f"<b>Alerts sent:</b> {sent_alerts}\n"
                f"<b>Source failures:</b> {source_failures}"
            ),
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        }
        try:
            response = self.session.post(
                f"https://api.telegram.org/bot{self.bot_token}/sendMessage",
                json=payload,
                timeout=15,
            )
            response.raise_for_status()
            return bool(response.json().get("ok"))
        except requests.RequestException as exc:
            LOGGER.error("Telegram cycle summary failed: %s", exc)
            return False

    def _format_message(self, detection: DetectionResult) -> str:
        return (
            "<b>OSINT Breach Monitor Alert</b>\n"
            f"<b>Title:</b> {html.escape(detection.title)}\n"
            f"<b>Published:</b> {html.escape(detection.published_at or 'Unknown')}\n"
            f"<b>Source:</b> {html.escape(detection.source_name)}\n"
            f"<b>Keywords:</b> {html.escape(', '.join(detection.matched_keywords[:5]) or 'n/a')}\n"
            f"<b>Domains:</b> {html.escape(', '.join(detection.matched_domains[:5]) or 'n/a')}\n"
            f"<b>Score:</b> {detection.confidence_score}/100\n"
            f"<b>URL:</b> <a href=\"{html.escape(detection.article_url)}\">{html.escape(detection.article_url)}</a>\n"
            f"<b>Summary:</b> {html.escape(detection.summary)}"
        )
