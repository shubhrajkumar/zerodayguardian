# OSINT Breach Monitor

A modular Python monitor for legally collecting public breach signals, matching breach indicators, and sending Telegram alerts without storing personal data.

## Design goals

- Respect `robots.txt` before scraping.
- Add polite delays between requests.
- Parse public HTML pages with `requests` and `BeautifulSoup`.
- Extract `title`, `published_at`, `summary`, and canonical article URL.
- Detect breach signals from keywords such as `breach`, `leak`, and `dump`.
- Detect public email-domain patterns such as `gmail.com` and `yahoo.com` without storing raw email addresses.
- Prevent duplicate alerts with JSON fingerprint storage.
- Run every 6 hours by default with structured logging and file logs.
- Adapt at runtime by analyzing source failures, backing off unhealthy sources, and surfacing keyword suggestions.
- Stay extensible for future source adapters or API integrations.

## Structure

```text
osint-breach-monitor/
├── main.py
├── scraper.py
├── detector.py
├── alert.py
├── storage.py
├── improver.py
├── config.py
├── requirements.txt
└── storage.json
```

## Environment variables

```bash
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
OSINT_RUN_INTERVAL_SECONDS=21600
OSINT_REQUEST_TIMEOUT_SECONDS=20
OSINT_DELAY_MIN_SECONDS=2
OSINT_DELAY_MAX_SECONDS=4.5
OSINT_CONFIDENCE_THRESHOLD=35
OSINT_ENABLE_TELEGRAM=true
OSINT_RESPECT_ROBOTS=true
OSINT_LOG_LEVEL=INFO
```

Optional overrides:

```bash
OSINT_STORAGE_FILE=./storage.json
OSINT_LOG_FILE=./monitor.log
OSINT_STATE_FILE=./runtime-state.json
OSINT_KEYWORDS=breach,leak,dump,credentials
OSINT_DOMAIN_PATTERNS=gmail.com,yahoo.com,outlook.com
```

## Run

Install dependencies:

```bash
pip install -r requirements.txt
```

Run one cycle:

```bash
python main.py --once
```

Run continuously:

```bash
python main.py
```

View status:

```bash
python main.py --status
```

## Operational notes

- The scraper only works on public pages and checks `robots.txt` first.
- The detector redacts full email addresses from summaries before alerting or storing anything.
- Deduplication fingerprints are based on URL + title hash, not personal data.
- Telegram messages contain only title, URL, source, score, and short summary.
- `improver.py` stores source health, adaptive backoff state, and keyword suggestions for safe continuous improvement.
- To scale later, add more `SourceConfig` entries or replace specific sources with API collectors while keeping the same detector and alert pipeline.
