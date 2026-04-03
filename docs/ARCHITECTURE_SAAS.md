# ZeroDay Guardian SaaS Architecture

## Purpose
Production-grade AI cybersecurity SaaS with modular services, scalable data, adaptive AI, and premium real-time UX.

## Modular Backend
- Express API gateway with strict middleware boundaries.
- Domain modules: OSINT, scans, threat detection, labs, learning, recommendations, notifications.
- Background workers: scan queues, OSINT refresh, AI retries.
- Observability: request IDs, structured logs, metrics.

## Scalable Database
- PostgreSQL as primary store.
- Redis for cache and rate limits.
- Partitioned telemetry tables for user events and scan history.
- Read replicas for analytics/BI dashboards.

## Adaptive AI Engine
- Rules-first, AI only for complex queries.
- Provider routing with fallback and retries.
- Prompt versioning + cache.
- Outputs always include reasons, signals, and next actions.

## Frontend UX
- React + Vite, real-time updates via SSE.
- Premium dashboard cards, instant feedback, mobile-first layout.
- Separate live scans from simulated labs.

## Performance Targets
- p95 < 2s for core APIs.
- Cached answers for repeatable queries.
- Streaming where possible.

## Security
- JWT auth + refresh sessions.
- CSRF + strict validation on all mutations.
- Rate limit and abuse detection.
- Audit trail for sensitive operations.

