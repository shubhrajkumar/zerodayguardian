import argparse
from dataclasses import asdict, is_dataclass
import json
import time
from pathlib import Path
import sys


CURRENT_DIR = Path(__file__).resolve().parent
PYTHON_BACKEND_DIR = CURRENT_DIR / "python"
if str(PYTHON_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(PYTHON_BACKEND_DIR))

from osint_monitor.config import MonitorSettings
from osint_monitor.service import OsintMonitorService


def to_jsonable(value):
    if is_dataclass(value):
        return asdict(value)
    return value


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="ZeroDay Guardian OSINT monitor runner")
    parser.add_argument(
        "--mode",
        choices=("run", "status", "loop"),
        default="run",
        help="Run one monitoring cycle, print status, or loop on the configured interval.",
    )
    return parser


if __name__ == "__main__":
    args = build_parser().parse_args()
    service = OsintMonitorService(MonitorSettings())
    if args.mode == "status":
        print(json.dumps(service.status(), indent=2, default=to_jsonable))
    elif args.mode == "loop":
        try:
            while True:
                result = service.run_cycle()
                print(json.dumps(result, indent=2, default=to_jsonable))
                time.sleep(service.settings.run_interval_seconds)
        except KeyboardInterrupt:
            service.stop()
    else:
        result = service.run_cycle()
        print(json.dumps(result, indent=2, default=to_jsonable))
