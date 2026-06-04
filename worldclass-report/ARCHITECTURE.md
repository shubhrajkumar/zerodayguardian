# ZeroDay Guardian — Architecture Overview

## System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        VERCEL (Frontend)                         │
│                                                                  │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────────┐ │
│  │ index.html│  │ api/index.mjs│  │ Static Assets (dist/)      │ │
│  │ (SPA)     │  │ (CSP Nonce)  │  │ JS/CSS/Fonts/Images        │ │
│  └─────┬─────┘  └──────┬───────┘  └────────────────────────────┘ │
│        │               │                                          │
│  ┌─────┴───────────────┴──────┐                                   │
│  │     React App (SPA)        │                                   │
│  │  ├─ App.tsx (critical)     │                                   │
│  │  ├─ AppShell.tsx (lazy)    │                                   │
│  │  ├─ Pages (lazy)           │                                   │
│  │  ├─ Components             │                                   │
│  │  └─ Contexts/Providers     │                                   │
│  └────────────┬───────────────┘                                   │
│               │ fetch() with CSRF token                           │
└───────────────┼──────────────────────────────────────────────────┘
                │
                │ CORS: zerodayguardian-delta.vercel.app
                │
┌───────────────┼──────────────────────────────────────────────────┐
│               │          RENDER (Backend)                         │
│  ┌────────────┴───────────────────────────────────────────────┐   │
│  │                Express.js Server                           │   │
│  │                                                            │   │
│  │  Middleware Stack:                                         │   │
│  │  ├─ CORS (origin allowlist)                               │   │
│  │  ├─ Helmet (security headers)                             │   │
│  │  ├─ Compression (gzip/brotli)                             │   │
│  │  ├─ Request Context (requestId, traceId)                  │   │
│  │  ├─ CSRF Protection (encrypted tokens)                    │   │
│  │  ├─ Input Sanitization                                    │   │
│  │  ├─ Rate Limiting (per-route)                             │   │
│  │  ├─ Auth (Firebase verify + session)                      │   │
│  │  └─ Error Handler                                         │   │
│  │                                                            │   │
│  │  Route Modules:                                           │   │
│  │  ├─ /api/auth/*          (Firebase + Google OAuth)        │   │
│  │  ├─ /api/dashboard/*     (Stats, Adaptive, Cockpit)      │   │
│  │  ├─ /api/users/*         (Profile, Sync, Update)         │   │
│  │  ├─ /api/labs/*          (CRUD, Start, Complete)         │   │
│  │  ├─ /api/missions/*      (Daily, Weekly, Start, Complete)│   │
│  │  ├─ /api/courses/*       (Catalog, Detail)               │   │
│  │  ├─ /api/learning/*      (Tracks, Progress)              │   │
│  │  ├─ /api/neurobot/*      (AI Chat via LLM)              │   │
│  │  ├─ /api/osint/*         (Domain/IP/Username Intel)      │   │
│  │  ├─ /api/scans/*         (Web/Header/Port Scans)        │   │
│  │  ├─ /api/notifications/* (Push, In-App)                  │   │
│  │  ├─ /api/recommendations/*(AI Suggestions)              │   │
│  │  ├─ /api/mission-control/*(Progress Tracking)           │   │
│  │  ├─ /api/adaptive/*      (Difficulty Adaptation)        │   │
│  │  ├─ /api/compliance/*    (GDPR Data Ops)                │   │
│  │  ├─ /api/files/*         (Upload, Processing)           │   │
│  │  ├─ /api/intelligence/*  (Threat Intel)                 │   │
│  │  └─ /pyapi/*             (Python API Compat)            │   │
│  │                                                            │   │
│  │  Data Layer:                                              │   │
│  │  ├─ MongoDB Atlas (native driver + Mongoose)             │   │
│  │  ├─ Redis (caching, rate limiting)                       │   │
│  │  └─ Firebase Auth (token verification)                   │   │
│  │                                                            │   │
│  │  Observability:                                           │   │
│  │  ├─ OpenTelemetry (distributed tracing)                  │   │
│  │  ├─ Prometheus metrics                                   │   │
│  │  └─ Structured logging                                   │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
User Browser → Vercel Edge → React SPA → fetch(Backend URL) → Render Express
                                              ↓
                                    MongoDB Atlas ←→ Redis Cache
                                              ↓
                                    Firebase Auth (token verify)
```

## Key Design Decisions

1. **Monorepo** — Frontend and backend share a single repository for simplicity
2. **Dual database driver** — Native MongoDB driver for performance + Mongoose for schema validation
3. **Per-request CSP nonce** — Eliminates `unsafe-inline` from production CSP
4. **Lazy everything** — AppShell, pages, Firebase, Sentry, toasters all lazy-loaded
5. **Safe data utilities** — Prevent all `undefined.map()` crashes at the utility level
6. **Mock auth mode** — Enables frontend development without backend
7. **Free tier optimization** — Keep-alive pings, cold start detection, server wake-up UI
