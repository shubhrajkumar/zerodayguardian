from __future__ import annotations

import logging
import threading
import time
from datetime import datetime, timezone

from .alert import TelegramAlertClient
from .config import MonitorSettings
from .detector import BreachDetector
from .models import MonitorCycleResult, SourceCycleResult
from .scraper import PublicSourceScraper
from .storage import JsonDedupStore


LOGGER = logging.getLogger(__name__)


class OsintMonitorService:
    def __init__(self, settings: MonitorSettings) -> None:
        self.settings = settings
        self.scraper = PublicSourceScraper(settings)
        self.detector = BreachDetector(settings.keywords, settings.domain_patterns, settings.confidence_threshold)
        self.store = JsonDedupStore(settings.storage_file)
        self.alert_client = TelegramAlertClient(settings.telegram_bot_token, settings.telegram_chat_id)
        self._thread: threading.Thread | None = None
        self._stop_event = threading.Event()
        self._lock = threading.Lock()
        self._last_cycle: MonitorCycleResult | None = None

    def start(self) -> None:
        if not self.settings.enabled or self._thread is not None:
            return
        self._thread = threading.Thread(target=self._run_scheduler, name="osint-monitor", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        self.scraper.close()

    def run_cycle(self) -> MonitorCycleResult:
        with self._lock:
            started_at = _utc_now().isoformat()
            self.store.cleanup(self.settings.dedupe_retention_days)

            scraped_articles = []
            source_failures = 0
            skipped_sources = 0
            source_results: list[SourceCycleResult] = []
            checked_sources = self.settings.sources[: self.settings.max_sources_per_cycle]
            for source in checked_sources:
                result = self.scraper.scrape_source(source)
                if result.success:
                    scraped_articles.extend(result.items)
                    source_results.append(
                        SourceCycleResult(
                            source_name=result.source_name,
                            source_url=result.source_url,
                            success=True,
                            fetched_items=len(result.items),
                        )
                    )
                else:
                    if result.skipped:
                        skipped_sources += 1
                    else:
                        source_failures += 1
                    source_results.append(
                        SourceCycleResult(
                            source_name=result.source_name,
                            source_url=result.source_url,
                            success=False,
                            skipped=result.skipped,
                            error_message=result.error_message,
                        )
                    )

            scraped_articles = scraped_articles[: self.settings.source_limit_per_run]
            detections = self.detector.analyze_batch(scraped_articles)
            delivered = 0
            delivered_fingerprints: set[str] = set()

            for detection in detections:
                if self.store.has_seen(detection.article_url, detection.title):
                    continue
                fingerprint = self.store.build_fingerprint(detection.article_url, detection.title)
                if delivered >= self.settings.max_alerts_per_cycle:
                    LOGGER.warning(
                        "OSINT alert cap reached | max_alerts_per_cycle=%s | remaining_detection=%s",
                        self.settings.max_alerts_per_cycle,
                        detection.article_url,
                    )
                    self.store.mark_seen(detection.article_url, detection.title)
                    continue
                if self.alert_client.send_detection(detection):
                    delivered += 1
                    delivered_fingerprints.add(fingerprint)
                self.store.mark_seen(detection.article_url, detection.title)
                LOGGER.warning(
                    "OSINT detection | source=%s | title=%s | url=%s | score=%s",
                    detection.source_name,
                    detection.title,
                    detection.article_url,
                    detection.confidence_score,
                )

            per_source_detections: dict[str, int] = {}
            per_source_alerts: dict[str, int] = {}
            for detection in detections:
                per_source_detections[detection.source_url] = per_source_detections.get(detection.source_url, 0) + 1
                fingerprint = self.store.build_fingerprint(detection.article_url, detection.title)
                if fingerprint in delivered_fingerprints:
                    per_source_alerts[detection.source_url] = per_source_alerts.get(detection.source_url, 0) + 1

            source_results = [
                SourceCycleResult(
                    source_name=item.source_name,
                    source_url=item.source_url,
                    success=item.success,
                    skipped=item.skipped,
                    fetched_items=item.fetched_items,
                    detections=per_source_detections.get(item.source_url, 0),
                    new_alerts=per_source_alerts.get(item.source_url, 0),
                    error_message=item.error_message,
                )
                for item in source_results
            ]

            if detections and self.alert_client.configured():
                self.alert_client.send_cycle_summary(delivered, len(detections), source_failures)

            finished_at = _utc_now().isoformat()
            self._last_cycle = MonitorCycleResult(
                sources_checked=len(checked_sources),
                scraped_items=len(scraped_articles),
                detections=len(detections),
                new_alerts=delivered,
                source_failures=source_failures,
                skipped_sources=skipped_sources,
                started_at=started_at,
                finished_at=finished_at,
                source_results=source_results,
            )
            return self._last_cycle

    def status(self) -> dict[str, object]:
        return {
            "enabled": self.settings.enabled,
            "interval_seconds": self.settings.run_interval_seconds,
            "telegram_configured": self.settings.telegram_configured(),
            "source_count": len(self.settings.sources),
            "max_sources_per_cycle": self.settings.max_sources_per_cycle,
            "max_alerts_per_cycle": self.settings.max_alerts_per_cycle,
            "storage": self.store.stats(),
            "last_cycle": vars(self._last_cycle) if self._last_cycle else None,
            "thread_running": bool(self._thread and self._thread.is_alive()),
        }

    def _run_scheduler(self) -> None:
        while not self._stop_event.is_set():
            try:
                self.run_cycle()
            except Exception as exc:
                LOGGER.exception("OSINT monitor cycle failed: %s", exc)
            end_time = time.time() + self.settings.run_interval_seconds
            while not self._stop_event.is_set() and time.time() < end_time:
                time.sleep(1)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)
