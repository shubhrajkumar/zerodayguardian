from __future__ import annotations

import argparse
import logging
import signal
import sys
import time
from dataclasses import dataclass

from alert import TelegramAlert, TelegramConfig
from config import Settings, validate_settings
from detector import BreachDetector, DetectionResult
from improver import ImprovementEngine
from scraper import WebScraper
from storage import StorageManager


LOGGER = logging.getLogger(__name__)


def setup_logging(settings: Settings) -> None:
    level = getattr(logging, settings.log_level, logging.INFO)
    formatter = logging.Formatter("%(asctime)s | %(levelname)-7s | %(name)s | %(message)s")

    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    root_logger.handlers.clear()

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)

    file_handler = logging.FileHandler(settings.log_file, encoding="utf-8")
    file_handler.setFormatter(formatter)

    root_logger.addHandler(console_handler)
    root_logger.addHandler(file_handler)
    logging.getLogger("urllib3").setLevel(logging.WARNING)


@dataclass
class CycleStats:
    sources_attempted: int = 0
    active_sources: int = 0
    scraped_items: int = 0
    detections: int = 0
    new_alerts: int = 0
    source_failures: int = 0


class BreachMonitor:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.storage = StorageManager(settings.storage_file)
        self.scraper = WebScraper(settings)
        self.improver = ImprovementEngine(
            state_file=settings.state_file,
            disable_minutes=settings.source_disable_minutes,
            error_backoff_limit=settings.source_error_backoff_limit,
            max_keyword_suggestions=settings.max_keyword_suggestions,
        )
        self.detector = BreachDetector(
            keywords=settings.keywords,
            domain_patterns=settings.domain_patterns,
            confidence_threshold=settings.confidence_threshold,
        )
        self.telegram = TelegramAlert(
            TelegramConfig(
                bot_token=settings.telegram_bot_token,
                chat_id=settings.telegram_chat_id,
                enabled=settings.telegram_enabled,
            )
        )
        self.running = True

    def run_cycle(self) -> CycleStats:
        cleaned = self.storage.cleanup(self.settings.dedup_retention_days)
        if cleaned:
            LOGGER.info("Cleaned %s stale dedup records.", cleaned)

        ranked_sources = self.improver.rank_sources(self.settings.sources)
        eligible_sources = [source for source in ranked_sources if self.improver.should_scrape_source(source.name)]
        skipped_sources = len(ranked_sources) - len(eligible_sources)
        if skipped_sources:
            LOGGER.warning("Skipping %s degraded sources due to adaptive backoff.", skipped_sources)

        source_results = self.scraper.scrape_sources(eligible_sources)
        scraped_items = []
        source_failures = 0
        for result in source_results:
            if result.success:
                self.improver.record_source_success(result.source.name)
                scraped_items.extend(result.items)
            else:
                source_failures += 1
                self.improver.record_source_error(result.source.name, result.error_message)

        scraped_items = scraped_items[: self.settings.source_limit_per_run]
        detections = self.detector.analyze_batch(scraped_items)
        self.improver.learn_from_cycle(scraped_items, detections, self.settings.keywords)
        new_detections = self._filter_new_detections(detections)

        delivered = 0
        for detection in new_detections:
            if self.telegram.send_detection(detection):
                delivered += 1
            self.storage.mark_seen(detection.article_url, detection.title)
            LOGGER.warning(
                "Alert candidate | source=%s | title=%s | url=%s | score=%s",
                detection.source_name,
                detection.title,
                detection.article_url,
                detection.confidence_score,
            )

        return CycleStats(
            sources_attempted=len(ranked_sources),
            active_sources=len(eligible_sources),
            scraped_items=len(scraped_items),
            detections=len(detections),
            new_alerts=delivered,
            source_failures=source_failures,
        )

    def serve_forever(self) -> None:
        while self.running:
            stats = self.run_cycle()
            LOGGER.info(
                "Cycle complete | sources=%s/%s | scraped=%s | detections=%s | alerts_sent=%s | source_failures=%s",
                stats.active_sources,
                stats.sources_attempted,
                stats.scraped_items,
                stats.detections,
                stats.new_alerts,
                stats.source_failures,
            )
            sleep_remaining = self.settings.run_interval_seconds
            while self.running and sleep_remaining > 0:
                time.sleep(min(1, sleep_remaining))
                sleep_remaining -= 1

    def shutdown(self) -> None:
        self.running = False
        self.scraper.close()

    def _filter_new_detections(self, detections: list[DetectionResult]) -> list[DetectionResult]:
        return [
            detection
            for detection in detections
            if not self.storage.has_seen(detection.article_url, detection.title)
        ]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="OSINT breach monitoring runner")
    parser.add_argument("--once", action="store_true", help="Run a single monitoring cycle and exit.")
    parser.add_argument("--status", action="store_true", help="Print current configuration status and exit.")
    return parser.parse_args()


def print_status(settings: Settings) -> None:
    storage = StorageManager(settings.storage_file)
    improver = ImprovementEngine(
        state_file=settings.state_file,
        disable_minutes=settings.source_disable_minutes,
        error_backoff_limit=settings.source_error_backoff_limit,
        max_keyword_suggestions=settings.max_keyword_suggestions,
    )
    print("OSINT Breach Monitor Status")
    print(f"Interval: {settings.run_interval_seconds // 3600}h")
    print(f"Robots respected: {settings.respect_robots_txt}")
    print(f"Telegram configured: {settings.telegram_configured()}")
    print(f"Configured sources: {len(settings.sources)}")
    print(f"Storage: {storage.stats()}")
    print(f"Runtime insights: {improver.get_runtime_insights()}")


def main() -> int:
    settings = Settings()
    setup_logging(settings)

    for warning in validate_settings(settings):
        LOGGER.warning(warning)

    args = parse_args()
    if args.status:
        print_status(settings)
        return 0

    monitor = BreachMonitor(settings)

    def _handle_signal(signum, _frame) -> None:
        LOGGER.info("Received signal %s, shutting down monitor.", signum)
        monitor.shutdown()

    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)

    try:
        if args.once:
            stats = monitor.run_cycle()
            LOGGER.info("Single run finished | scraped=%s | detections=%s | alerts_sent=%s", stats.scraped_items, stats.detections, stats.new_alerts)
            return 0

        LOGGER.info("Starting continuous monitoring every %s seconds.", settings.run_interval_seconds)
        monitor.serve_forever()
        return 0
    finally:
        monitor.shutdown()


if __name__ == "__main__":
    raise SystemExit(main())
