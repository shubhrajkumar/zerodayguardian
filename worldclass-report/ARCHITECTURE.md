# ZeroDay Guardian — Architecture Document

**Version:** 1.0.0 | **Last Updated:** May 27, 2026

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Vercel (CDN)                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              React SPA (Vite + TypeScript)                │  │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐  │  │
│  │  │ Auth    │ │ Dashboard│ │ Labs     │ │ Tools Hub   │  │  │
│  │  │ Layer   │ │ Module   │ │ Module   │ │ Module      │  │  │
│  │  └────┬────┘ └────┬─────┘ └────┬─────┘ └──────┬──────┘  │  │
│  │       │           │            │              │          │  │
│  │  ┌────┴───────────┴────────────┴──────────────┴──────┐   │  │
│  │  │           API Client Layer (apiClient.ts)          │   │  │
│  │  └────────────────────────┬──────────────────────────┘   │  │
│  └───────────────────────────┼──────────────────────────────┘  │
└──────────────────────────────┼──────────────────────────────────┘
                               │ HTTPS / REST
┌──────────────────────────────┼──────────────────────────────────┐
│                   Render (Node.js)                              │
│  ┌───────────────────────────┴──────────────────────────────┐   │
│  │              Express Server (server.js)                   │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │   │
│  │  │ Auth     │ │ API      │ │ Intel    │ │ Telemetry  │  │   │
│  │  │ Routes   │ │ Routes   │ │ Routes   │ │ Routes     │  │   │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬──────┘  │   │
│  │       │            │            │              │          │   │
│  │  ┌────┴────────────┴────────────┴──────────────┴──────┐   │   │
│  │  │            Middleware Stack                         │   │   │
│  │  │  Helmet │ CORS │ Rate Limit │ CSRF │ Auth │ Audit │   │   │
│  │  └────────────────────────┬───────────────────────────┘   │   │
│  └───────────────────────────┼───────────────────────────────┘   │
└──────────────────────────────┼──────────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────┐
│              Render (Python FastAPI)                            │
│  ┌───────────────────────────┴──────────────────────────────┐   │
│  │         Python API (uvicorn)                              │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │   │
│  │  │ Labs     │ │ Adaptive │ │ Courses  │ │ Missions   │  │   │
│  │  │ Routes   │ │ Routes   │ │ Routes   │ │ Routes     │  │   │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬──────┘  │   │
│  └───────┼────────────┼────────────┼──────────────┼──────────┘   │
└──────────┼────────────┼────────────┼──────────────┼──────────────┘
           │            │            │              │
    ┌──────┴──────┐ ┌───┴────┐ ┌────┴─────┐ ┌─────┴──────┐
    │   MongoDB   │ │ Redis  │ │PostgreSQL│ │  Firestore │
    │  (Primary)  │ │(Cache) │ │(Analytics)│ │(Gamification)│
    └─────────────┘ └────────┘ └──────────┘ └────────────┘
```

## 2. Component Tree (Frontend)

```
App
├── QueryClientProvider (TanStack Query)
├── HelmetProvider (SEO)
├── ErrorBoundary
├── AuthProvider (Firebase + JWT)
│   └── AppShell
│       ├── UserProgressProvider
│       ├── MissionSystemProvider
│       ├── LearningModeProvider
│       ├── AdaptiveMentorProvider
│       ├── BrowserRouter
│       │   ├── RouteSeo (per-route meta/JSON-LD)
│       │   ├── GlobalScrollReveal
│       │   ├── GamificationTracker
│       │   ├── GrowthProfileSync
│       │   ├── FirebaseStatusBadge
│       │   ├── RewardExperience (confetti)
│       │   ├── Layout
│       │   │   ├── Navbar
│       │   │   ├── Suspense (lazy routes)
│       │   │   │   ├── HomePage
│       │   │   │   ├── DashboardPage (RequireAuth)
│       │   │   │   ├── LabPage (RequireAuth)
│       │   │   │   ├── LearnPage (RequireAuth)
│       │   │   │   ├── ToolsPage (RequireAuth)
│       │   │   │   ├── AuthPage
│       │   │   │   └── ...
│       │   │   └── Footer
│       │   ├── HotToaster
│       │   └── SonnerToaster
```

## 3. Data Flow

```
User Action → Component → apiClient.ts → Express Backend → MongoDB/Firestore
                                                    ↓
                                              Response ← Processing
                                                    ↓
Component ← State Update ← TanStack Query Cache ← JSON Response
```

### Gamification Data Flow
```
Complete Mission → gamificationSystem.ts → Firestore Transaction
                                         → LocalStorage Fallback
                                         → XP Calculation
                                         → Level Check
                                         → Badge Award
                                         → Reward Creation
```

## 4. Auth Flow
```
Login Form → Firebase Auth (OAuth) / JWT Login
           → Backend validates credentials
           → Issues accessToken (15min) + refreshToken (7d)
           → Stores in localStorage (zdg_token, zdg_refresh)
           → CSRF token fetched via /api/auth/csrf
           → AuthContext syncs state
           
Token Refresh:
  401 Response → Axios Interceptor → POST /api/auth/refresh
              → New tokens issued → Retry original request
              → Queue concurrent 401 requests
```

## 5. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Express over Next.js | Simpler API server, separate from frontend build |
| Vite over CRA | Faster builds, native ESM, better DX |
| Firebase Auth | Social login, email/password, no self-hosted auth server |
| Firestore for Gamification | Real-time sync, server timestamps, transaction safety |
| MongoDB for Primary | Schema flexibility for lab/mission data |
| PostgreSQL for Analytics | Structured querying for leaderboards/reports |
| Python Sidecar for Labs | Rich ecosystem for security tools (nmap, requests, etc.) |
| TanStack Query | Deduplication, caching, retry, stale-while-revalidate |
| Tailwind CSS + Radix | Rapid UI development, accessible components |
