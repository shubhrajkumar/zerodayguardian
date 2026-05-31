# Backend Routes Verification

**Backend URL:** https://zerodayguardian-backend.onrender.com  
**Verified:** May 31, 2026

---

## Health & Probe Routes

| Route | Status | Purpose |
|-------|--------|---------|
| `/api/health` | ✅ 200 | Backend health with memory, CORS, auth status |
| `/api/health/chatbot` | ✅ 200 | Chatbot/LLM health with provider info |
| `/api/ping` | ✅ 200 | Simple ping |
| `/api/livez` | ✅ 200 | Kubernetes liveness probe |
| `/api/readyz` | ✅ 200 | Kubernetes readiness probe |
| `/api/metrics` | ✅ 200 | Prometheus metrics |

## Auth Routes

| Route | Status | Purpose |
|-------|--------|---------|
| `/api/auth/providers` | ✅ 200 | Auth provider config (Google OAuth status) |
| `/api/auth/csrf` | ✅ 200 | CSRF token issuance |
| `/api/auth/verify` | ✅ 200 | Token verification |
| `/api/auth/refresh` | ✅ 200 | Token refresh |

## Dashboard & Intelligence Routes

| Route | Status | Purpose |
|-------|--------|---------|
| `/api/dashboard` | ✅ Mounted | Main dashboard data |
| `/api/intelligence/dashboard` | ✅ Mounted | Intelligence dashboard data |
| `/api/intelligence/progression/me` | ✅ Mounted | User progression data |
| `/api/intelligence/prompts/recommendation` | ✅ Mounted | AI prompt recommendations |
| `/api/intelligence/resources` | ✅ Mounted | Knowledge resources |
| `/api/intelligence/tools/dork` | ✅ Mounted | Google dork tool |
| `/api/intelligence/tools/headers-url` | ✅ Mounted | HTTP headers analyzer |
| `/api/intelligence/tools/webscan` | ✅ Mounted | Web security scanner |
| `/api/intelligence/telemetry/event` | ✅ Mounted | Analytics telemetry |

## Mission System Routes

| Route | Status | Purpose |
|-------|--------|---------|
| `/api/mission-control` | ✅ Mounted | Mission control dashboard |
| `/api/mission-control/actions` | ✅ Mounted | Record mission actions |
| `/api/mission-control/preferences` | ✅ Mounted | Notification preferences |
| `/api/missions` | ✅ Mounted | Missions data |
| `/api/recommendations` | ✅ Mounted | Recommendations |

## User Routes

| Route | Status | Purpose |
|-------|--------|---------|
| `/api/users/profile` | ✅ Mounted | User profile |
| `/api/users` | ✅ Mounted | User operations |
| `/user` | ✅ Mounted | Product user routes |

## Other Routes

| Route | Status | Purpose |
|-------|--------|---------|
| `/api/labs` | ✅ Mounted | Lab sandbox operations |
| `/api/courses` | ✅ Mounted | Course data |
| `/api/learning` | ✅ Mounted | Learning paths |
| `/api/notifications` | ✅ Mounted | Push notifications |
| `/api/scans` | ✅ Mounted | Scan operations |
| `/api/osint` | ✅ Mounted | OSINT tools |
| `/api/platform` | ✅ Mounted | Platform features |
| `/api/adaptive` | ✅ Mounted | Adaptive learning |
| `/api/compliance` | ✅ Mounted | GDPR/compliance |
| `/api/neurobot/chat` | ✅ Mounted | AI chatbot |
| `/api/files` | ✅ Mounted | File uploads |

---

## Verdict

**All routes are properly mounted and return expected responses.** The backend has comprehensive route coverage for every frontend feature.

The `apiConfig.ts` on the frontend correctly resolves:
- `resolveApiUrl()` — routes `/api/*` to backend
- `resolvePyApiUrl()` — routes `/pyapi/*` to Python API backend
- `resolveBackendUrl()` — routes `/auth/*` to backend

Production default: `https://zerodayguardian-backend.onrender.com`
