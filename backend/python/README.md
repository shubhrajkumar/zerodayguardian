# Python Security API

This service provides a FastAPI backend for website scanning, security scoring, vulnerability reports, and AI threat detection. It stores users, scan history, and reports in PostgreSQL (recommended for production).

## Quick Start (Local)

1. Create a virtual environment and install dependencies:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

2. Set environment variables:

```bash
set PY_DATABASE_URL=postgresql+psycopg2://postgres:postgres@127.0.0.1:5432/zeroday_guardian
set PY_API_PORT=9001
```

3. Run the API:

```bash
uvicorn app:app --host 0.0.0.0 --port 9001 --reload
```

## Google Cloud SQL (PostgreSQL)

Use a Cloud SQL connection string in `PY_DATABASE_URL`, for example:

```
postgresql+psycopg2://USER:PASSWORD@/DBNAME?host=/cloudsql/INSTANCE_CONNECTION_NAME
```

Set `PY_CORS_ORIGINS` to include the frontend origin if needed.

### Cloud SQL Proxy (local development)

1. Install the Cloud SQL Auth Proxy and authenticate with gcloud.
2. Run the proxy:

```bash
cloud-sql-proxy --port 5432 PROJECT:REGION:INSTANCE
```

3. Use this connection string:

```
postgresql+psycopg2://USER:PASSWORD@127.0.0.1:5432/DBNAME
```

### Cloud Run / GCE (Unix socket)

If your service has access to the Cloud SQL instance, use the unix socket connection string:

```
postgresql+psycopg2://USER:PASSWORD@/DBNAME?host=/cloudsql/INSTANCE_CONNECTION_NAME
```

## Endpoints

- `POST /pyapi/scan` — scan a website and store a report
- `GET /pyapi/scan/history` — fetch scan history
- `GET /pyapi/scan/report/{id}` — fetch a full report
- `POST /pyapi/threat/detect` — AI-style threat detection signal
- `POST /pyapi/users` — create user
- `GET /pyapi/users/{id}` — fetch user
