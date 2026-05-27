# ZeroDay Guardian — Full-Stack Architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                                 │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐     │
│  │  Vite + React │  │  Tailwind    │  │  React Router v6     │     │
│  │  (TypeScript) │  │  CSS (dark/  │  │  (Lazy routes +      │     │
│  │               │  │  light mode) │  │  Suspense boundaries)│     │
│  └──────────────┘  └──────────────┘  └───────────────────────┘     │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  STATE MANAGEMENT                            │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │   │
│  │  │ AuthCtx  │ │ UserProg │ │ Mission  │ │ ToolConfig   │  │   │
│  │  │(Firebase │ │ (XP/rank/ │ │ System   │ │ (tool config │  │   │
│  │  │ + JWT)   │ │ streaks)  │ │ (Missions)│ │ management)  │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                   │   │
│  │  │ Adaptive │ │ Learning │ │ TanStack │                   │   │
│  │  │ Mentor   │ │ Mode     │ │ React    │                   │   │
│  │  │ (AI diff)│ │ (B/R Tm) │ │ Query    │                   │   │
│  │  └──────────┘ └──────────┘ └──────────┘                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    UI COMPONENTS                             │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │   │
│  │  │ Radix UI │ │ Lucide   │ │ Framer   │ │ Custom:      │  │   │
│  │  │(Dialog,  │ │ Icons    │ │ Motion   │ │ CyberCards,  │  │   │
│  │  │ Command, │ │          │ │          │ │ ShellCmds,   │  │   │
│  │  │ Sheet...)│ │          │ │          │ │ Skeleton Grid│  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    PAGES                                    │   │
│  │  / /dashboard /learn /program /lab /tools /osint            │   │
│  │  /assistant /blog /community /resources /about              │   │
│  │  /privacy /terms /contact /auth /security /u/:handle        │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                    HTTP/HTTPS (CORS + CSRF)
                              │
┌─────────────────────────────────────────────────────────────────────┐
│                       API GATEWAY (Vercel Edge)                     │
│                                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────┐    │
│  │ Security │ │ Rate     │ │ CORS     │ │ Compression +      │    │
│  │ Headers  │ │ Limiting │ │ Control  │ │ Response Time      │    │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────────┐
│                      BACKEND LAYER (Express)                       │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                  MIDDLEWARE PIPELINE                        │    │
│  │  Helmet → CORS → CookieParser → RequestCtx → AuditLog      │    │
│  │  → Compression → JSON Parser → CSRF → Sanitize → Guard     │    │
│  │  → Session → OptionalAuth → Router                          │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐   │
│  │ Auth    │ │ Mission │ │ OSINT   │ │ Labs    │ │ Dashboard│   │
│  │ Routes  │ │ Routes  │ │ Routes  │ │ Routes  │ │ Routes   │   │
│  │ /auth   │ │ /mission│ │ /osint  │ │ /labs   │ │ /dashboard│  │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └──────────┘   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐               │
│  │ Intel   │ │ Users   │ │ Neurobot│ │ Notifs  │               │
│  │ Routes  │ │ Routes  │ │ Routes  │ │ Routes  │               │
│  │ /intel  │ │ /users  │ │ /neuro  │ │ /notifs │               │
│  │         │ │         │ │ (AI)    │ │         │               │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘               │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                  CONTROLLERS + SERVICES                     │    │
│  │  authController · dashboardController · osintController    │    │
│  │  authService · osintService · probeService                 │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                  AI ENGINE                                  │    │
│  │  orchestrator.mjs → responseGenerator.mjs → LLM Router     │    │
│  │  Circuit breaker · Health monitor · Fallback provider      │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                  MONITORING                                  │    │
│  │  OpenTelemetry SDK · Prometheus Metrics · Audit Logging     │    │
│  │  Health (/health, /livez, /readyz) · Slow API Detection     │    │
│  └────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
┌─────────────▼────┐ ┌───────▼───────┐ ┌─────▼─────────────┐
│   MongoDB        │ │   Redis       │ │   PostgreSQL       │
│   (Primary DB)   │ │   (Cache/     │ │   (Python API)     │
│   Users ·        │ │    Session)   │ │   Analytics ·      │
│   Missions ·     │ │               │ │   Telemetry        │
│   OSINT Cases    │ │               │ │                    │
└──────────────────┘ └───────────────┘ └────────────────────┘

```

---

## Technology Stack

### Frontend
| Technology | Purpose |
|---|---|
| **React 18** | UI framework with concurrent features |
| **TypeScript** | Type safety across the codebase |
| **Vite** | Build tool with HMR and code splitting |
| **Tailwind CSS** | Utility-first styling with dark/light mode |
| **React Router v6** | Client-side routing with lazy loading |
| **Radix UI** | Accessible, unstyled UI primitives |
| **Framer Motion** | Animation library |
| **TanStack Query** | Server state management |
| **React Helmet Async** | SEO management |
| **Zod** | Runtime validation |

### Backend
| Technology | Purpose |
|---|---|
| **Node.js 22** | Runtime (Express + ES Modules) |
| **Express** | Web framework |
| **MongoDB + Mongoose** | Primary database |
| **Redis** | Caching and session store |
| **PostgreSQL** | Analytics data (Python API) |
| **JWT + Firebase** | Authentication |
| **OpenTelemetry** | Distributed tracing |
| **Prometheus** | Metrics collection |

### Infrastructure
| Technology | Purpose |
|---|---|
| **Docker** | Containerization |
| **Kubernetes** | Orchestration |
| **Vercel** | Frontend hosting + CDN |
| **GitHub Actions** | CI/CD pipeline |
| **cert-manager** | TLS certificate management |
| **OpenTelemetry Collector** | Metrics/traces aggregation |

---

## Data Flow

### Authentication Flow
```
User → Login Form → Firebase Auth → JWT Token → API Gateway → 
Backend (verify JWT + CSRF) → Response (Set-Cookie + JSON) → Client
```

### Lab Execution Flow
```
User → Select Lab → API /api/labs/:id → Mission System → 
Sandbox Environment → Execute Commands → Validate Results → 
Update Progress (XP, Streaks, Badges) → Response
```

### OSINT Investigation Flow
```
User → Input Target (domain/IP/email) → /api/osint/scan → 
OSINT Service (WHOIS, DNS, Shodan, etc.) → Enrich Results → 
Save to Case → Generate Report (CSV/PDF) → Response
```

---

## Key Design Patterns

1. **Provider Pattern** — Context providers for auth, progress, missions, learning mode
2. **Lazy Loading** — All routes are lazy-loaded with Suspense fallbacks
3. **Optimistic Updates** — UserProgressContext applies optimistic XP on actions
4. **Telemetry Batching** — Batches events every 30s for efficient analytics
5. **Circuit Breaker** — AI provider calls wrapped in circuit breaker pattern
6. **Middleware Pipeline** — Express middleware chain for security + observability
7. **Singleton Services** — Services like CyberSandbox use singleton pattern
8. **Adaptive Difficulty** — ML-light algorithm adjusts based on level, streak, momentum
