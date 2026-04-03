from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class SeenRecord:
    fingerprint: str
    title: str
    url: str
    first_seen: str
    last_seen: str


class JsonDedupStore:
    def __init__(self, storage_file: Path) -> None:
        self.storage_file = Path(storage_file)
        self.storage_file.parent.mkdir(parents=True, exist_ok=True)
        self._records: dict[str, SeenRecord] = {}
        self._load()

    def _load(self) -> None:
        if not self.storage_file.exists():
            self._save()
            return
        try:
            payload = json.loads(self.storage_file.read_text(encoding="utf-8"))
            self._records = {
                key: SeenRecord(**value)
                for key, value in payload.get("records", {}).items()
                if isinstance(value, dict) and value.get("fingerprint")
            }
        except (OSError, ValueError, TypeError):
            self._records = {}
            self._save()

    def _save(self) -> None:
        payload = {
            "updated_at": utc_now().isoformat(),
            "records": {key: asdict(value) for key, value in self._records.items()},
        }
        self.storage_file.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    @staticmethod
    def build_fingerprint(url: str, title: str) -> str:
        normalized = f"{url.strip().lower()}|{title.strip().lower()}"
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    def has_seen(self, url: str, title: str) -> bool:
        return self.build_fingerprint(url, title) in self._records

    def mark_seen(self, url: str, title: str) -> None:
        fingerprint = self.build_fingerprint(url, title)
        timestamp = utc_now().isoformat()
        existing = self._records.get(fingerprint)
        self._records[fingerprint] = SeenRecord(
            fingerprint=fingerprint,
            title=title,
            url=url,
            first_seen=existing.first_seen if existing else timestamp,
            last_seen=timestamp,
        )
        self._save()

    def cleanup(self, retention_days: int) -> int:
        cutoff = utc_now() - timedelta(days=retention_days)
        stale = [key for key, record in self._records.items() if _parse_dt(record.last_seen) < cutoff]
        for key in stale:
            self._records.pop(key, None)
        if stale:
            self._save()
        return len(stale)

    def stats(self) -> dict[str, object]:
        return {
            "storage_file": str(self.storage_file),
            "record_count": len(self._records),
            "exists": self.storage_file.exists(),
        }


def _parse_dt(value: str) -> datetime:
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return utc_now()

