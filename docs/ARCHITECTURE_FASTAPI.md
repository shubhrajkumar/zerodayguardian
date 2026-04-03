# ZeroDay Guardian: Production AI SaaS Architecture (FastAPI)

## Overview
This architecture layers a secure FastAPI API, scalable database, adaptive AI engine, and interactive frontend into a modular, high-performance system. It is designed for low-latency responses, predictable scaling, and verified security intelligence.

## Core Services
- **API Gateway (FastAPI)**: Routes, validation, auth, rate-limits, and response shaping.
- **Scan Engine**: Verified DNS/MX/WHOIS/headers/IP signals with strict timeouts and retries.
- **Adaptive AI Engine**: Short, high-confidence summaries; AI only for complex queries.
- **Recommendations**: Real-time personalization from user activity + recent scan/threat signals.
- **Telemetry & Audit**: User events, scan history, and security event tracking.

## Data Model
- **Users**: Identity, external_id, email.
- **ScanReports**: Target, status, findings, latency, timestamps.
- **ThreatEvents**: Risk level, reasons, triggered signals.
- **UserEvents**: Interaction telemetry for personalization (surface, target, metadata).

## Security & Trust
- **JWT enforcement** on all protected endpoints.
- **Rate limits** per user + IP + route to prevent abuse.
- **Strict validation** with Pydantic schemas.
- **Secure headers** and CORS control via configuration.
- **No mock data**: responses explicitly fall back to “no verified data.”

## Performance & Scaling
- **TTL caches** for OSINT intel and recommendations.
- **Bounded queries** (limits, indexes) and concise payloads.
- **Horizontal scaling** by stateless API nodes + shared DB.
- **Optional queue** for long scans (Celery/Redis or async tasks).

## Real-Time Recommendations
- **Event tracking**: `/pyapi/events`
- **Batch recommendations**: `/pyapi/recommendations`
- **Streaming (SSE)**: `/pyapi/recommendations/stream` for near-real-time UI updates.

## Frontend Integration
- **Interactive dashboard**: scan history, threat feed, and recommendations.
- **Real-time updates** via SSE or periodic refresh.
- **Modular UI**: Cards for OSINT, scans, threats, and adaptive insights.

## Deployment
- **FastAPI** behind a reverse proxy (NGINX).
- **PostgreSQL** for production; SQLite for local dev.
- **Observability**: request IDs, structured logs, and metrics.

