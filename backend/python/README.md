# Python Security API

This FastAPI service powers backend security features for ZeroDay Guardian, including website scanning, threat detection, and an integrated OSINT breach monitoring system.

## Quick Start

1. Create a virtual environment and install dependencies:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

2. Set environment variables:

```bash
set PY_DATABASE_URL=sqlite:///./local.db
set PY_API_PORT=8000
set PY_OSINT_MONITOR_ENABLED=true
set PY_OSINT_RUN_INTERVAL_SECONDS=21600
set TELEGRAM_BOT_TOKEN=your_bot_token
set TELEGRAM_CHAT_ID=your_chat_id
```

3. Run the API:

```bash
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The project root `main.py` is the supported local entrypoint. It wires the
`backend/python` package onto `sys.path` so you can run FastAPI from the repo
root without changing directories.

## Database migrations

```bash
alembic upgrade head
```

## Seed starter data

```bash
python seed_data.py
```

Reset and re-seed:

```bash
python seed_data.py --reset
```

Targeted seeds:

```bash
python seed_data.py --paths
python seed_data.py --rewards
python seed_data.py --skills
```

Reset + migrate + seed:

```bash
python reset_and_seed.py --force
```

## OSINT Monitor

The OSINT package lives in `backend/python/osint_monitor/` and is structured as:

```text
backend/python/osint_monitor/
├── config.py
├── models.py
├── scraper.py
├── detector.py
├── alert.py
├── storage.py
└── service.py
```

Features:

- Public-source scraping with `requests` and `BeautifulSoup`
- Keyword and domain-pattern breach detection
- Telegram alerts
- JSON dedupe storage
- Logging to `backend/python/osint-monitor.log`
- Background auto-run every 6 hours by default
- Manual run and status endpoints for operations
- Source-level cycle accounting for safer troubleshooting
- Optional external JSON source list for modular scaling
- HTTPS-first source validation, robots.txt support, retries, and per-cycle alert caps

Additional OSINT environment variables:

```bash
set PY_OSINT_REQUEST_TIMEOUT_SECONDS=20
set PY_OSINT_DELAY_MIN_SECONDS=2
set PY_OSINT_DELAY_MAX_SECONDS=4
set PY_OSINT_CONFIDENCE_THRESHOLD=35
set PY_OSINT_STORAGE_FILE=backend/python/osint-storage.json
set PY_OSINT_LOG_FILE=backend/python/osint-monitor.log
set PY_OSINT_MAX_SOURCES_PER_CYCLE=10
set PY_OSINT_MAX_ALERTS_PER_CYCLE=20
set PY_OSINT_SOURCES_FILE=backend/python/osint-sources.json
```

Custom source file format:

```json
{
  "sources": [
    {
      "name": "Example Source",
      "url": "https://example.com/breaches",
      "item_selector": "article",
      "title_selector": "h2 a",
      "date_selector": "time",
      "summary_selector": "p",
      "link_selector": "h2 a",
      "max_items": 10
    }
  ]
}
```

## Endpoints

- `POST /pyapi/scan` - scan a website and store a report
- `GET /pyapi/scan/history` - fetch scan history
- `GET /pyapi/scan/report/{id}` - fetch a full report
- `POST /pyapi/threat/detect` - run threat detection
- `POST /pyapi/users` - create user
- `GET /pyapi/users/{id}` - fetch user
- `GET /pyapi/osint/status` - inspect OSINT scheduler status
- `POST /pyapi/osint/run` - trigger one OSINT monitoring cycle manually
- `GET /health` - root health probe
- `GET /pyapi/health` - namespaced health probe

## Local Smoke Run

You can trigger one OSINT cycle directly from the project with:

```bash
python ..\test.py
```

Useful runner modes:

```bash
python ..\test.py --mode status
python ..\test.py --mode run
python ..\test.py --mode loop
```
