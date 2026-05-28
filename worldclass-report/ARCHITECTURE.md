# ZeroDay Guardian — Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (User)                        │
│  ┌───────────────────────────────────────────────────┐  │
│  │  React SPA (Vite + TypeScript)                    │  │
│  │  • 23 lazy-loaded routes                          │  │
│  │  • React Query for data fetching                  │  │
│  │  • Context API for auth/progress/mission state    │  │
│  │  • Tailwind CSS + CSS variables (dark/light mode) │  │
│  └────────────┬──────────────────────────────────────┘  │
└───────────────┼──────────────────────────────────────────┘
                │ HTTPS / CORS / CSRF
                ▼
┌─────────────────────────────────────────────────────────┐
│              Vercel (Frontend Hosting)                    │
│  • Edge network                                         │
│  • Serverless API function (api/index.mjs)              │
│  • Static assets + CSP headers                          │
└────────────┬────────────────────────────────────────────┘
             │ HTTPS
             ▼
┌─────────────────────────────────────────────────────────┐
│          Render (Backend Hosting)                        │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Express.js Server (backend/server.js)             │ │
│  │                                                    │ │
│  │  Middleware Stack:                                  │ │
│  │  1. CORS (production origin validation)            │ │
│  │  2. Helmet (security headers)                      │ │
│  │  3. Cookie parser                                  │ │
│  │  4. Request context + audit log                    │ │
│  │  5. Compression (excluding SSE)                    │ │
│  │  6. JSON body parser (1mb limit)                   │ │
│  │  7. CSRF token issuance + verification             │ │
│  │  8. Input sanitization                             │ │
│  │  9. Request guard (request validation)             │ │
│  │  10. Session management (encrypted cookies)        │ │
│  │  11. Optional auth parsing                         │ │
│  │  12. Rate limiting (per-endpoint)                  │ │
│  │  13. Route handlers                                │ │
│  │  14. 404 handler                                   │ │
│  │  15. Error handler                                 │ │
│  └────────────────────────────────────────────────────┘ │
│                         │                                │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Routes:                                           │ │
│  │  /api/auth/*      → authRoutes                     │ │
│  │  /api/labs        → labsRoutes                     │ │
│  │  /api/missions    → missionsRoutes                 │ │
│  │  /api/courses     → coursesRoutes                  │ │
│  │  /api/users       → userRoutes                     │ │
│  │  /api/compliance  → complianceRoutes               │ │
│  │  /api/dashboard   → dashboardRoutes                │ │
│  │  /api/osint       → osintRoutes                    │ │
│  │  /api/neurobot    → neurobotRoutes + chat          │ │
│  │  /api/scans       → scanRoutes                     │ │
│  │  /api/notifications → notificationRoutes           │ │
│  │  /api/intelligence → intelligenceRoutes            │ │
│  │  /api/adaptive    → adaptiveRoutes                 │ │
│  │  /api/mission     → missionRoutes                  │ │
│  │  /api/platform    → platformRoutes                 │ │
│  │  /pyapi           → pyApiCompatRoutes              │ │
│  └────────────────────────────────────────────────────┘ │
│                         │                                │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Database Layer:                                    │ │
│  │  • MongoDB (native driver + Mongoose)               │ │
│  │  • Collections: users, labs, missions, courses,     │ │
│  │    lab_progress, mission_progress, scans,           │ │
│  │    osint_queries, conversations, security_events,   │ │
│  │    growth_* (certifications, ctf, billing, etc.)   │ │
│  │  • Redis (optional, for SSE checkpoint store)       │ │
│  └────────────────────────────────────────────────────┘ │
│                         │                                │
│  ┌────────────────────────────────────────────────────┐ │
│  │  External Services:                                 │ │
│  │  • OpenRouter / Google AI / OpenAI / DeepSeek (LLM) │ │
│  │  • Firebase (optional auth)                         │ │
│  │  • Stripe (subscription billing)                    │ │
│  │  • WHOIS XML API (OSINT)                            │ │
│  │  • LeakCheck / DeHashed (breach data)              │ │
│  │  • Google OAuth                                     │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Data Flow

```
User Request → Vercel Edge → Express Server → Middleware Pipeline → Route Handler → MongoDB
                                                                                         │
                                                                                         ▼
User Response ← JSON/SSE ← Middleware Pipeline ← Route Handler ← Model/Service Layer ←───┘
```

## Authentication Flow

```
1. POST /api/auth/login → validates credentials → issues JWT (access + refresh)
2. Frontend stores tokens → fetches CSRF token from /api/auth/csrf
3. All API calls include: Authorization: Bearer <access_token> + X-CSRF-Token: <csrf>
4. On 401 → POST /api/auth/refresh → new access token
5. On refresh failure → clear state → redirect to /auth
```

## Key Design Decisions

1. **Dual Database Drivers**: Native MongoDB driver for high-performance queries, Mongoose for schema validation and model layers
2. **Token-based CSRF**: Double-submit cookie pattern prevents CSRF while allowing stateless API
3. **Multi-provider LLM Routing**: Failover between OpenRouter, Google AI, OpenAI, DeepSeek with circuit breaker
4. **Lazy-loaded Frontend**: All routes are lazy-loaded with Suspense for optimal initial bundle size
5. **SSE for Chat**: Server-Sent Events for AI chat streaming with heartbeat and checkpoint store
6. **Observability**: OpenTelemetry + Prometheus metrics + Sentry error tracking
