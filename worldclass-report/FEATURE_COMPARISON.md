# ZeroDay Guardian — Feature Comparison

## Current Feature Matrix

| Feature | Status | Backend Route | Frontend Page | Notes |
|---------|--------|---------------|---------------|-------|
| **Authentication** | ✅ Complete | `/api/auth/*` | `AuthPage.tsx` | Firebase + Google OAuth + Email |
| **Dashboard** | ✅ Complete | `/api/dashboard/*` | `DashboardPage.tsx` | Stats, adaptive, platform-cockpit |
| **User Profile** | ✅ Complete | `/api/users/*` | `PublicProfilePage.tsx` | Public profiles, badges |
| **Cyber Labs** | ✅ Complete | `/api/labs/*` | `LabPage.tsx` | CRUD, filtering, start/complete |
| **Missions** | ✅ Complete | `/api/missions/*` | Integrated in dashboard | Daily, weekly, start/complete |
| **Courses** | ✅ Complete | `/api/courses/*` | `LearnPage.tsx` | Catalog, detail, filtering |
| **Learning Paths** | ✅ Complete | `/api/learning/*` | `ProgramPage.tsx` | Structured tracks |
| **OSINT** | ✅ Complete | `/api/osint/*` | `OsintPage.tsx` | Domain/IP/username intel |
| **AI Chat (ZORVIX)** | ✅ Complete | `/api/neurobot/*` | `AssistantPage.tsx` + `Zorvix.tsx` | Adaptive AI mentor |
| **Tools Hub** | ✅ Complete | Various | `ToolsPage.tsx` + `ToolDetail.tsx` | Web/header/port scanners |
| **Notifications** | ✅ Complete | `/api/notifications/*` | `NotificationBell.tsx` | Push + in-app |
| **Blog** | ✅ Complete | Static | `BlogPage.tsx` + `BlogDetail.tsx` | Intel feed |
| **Resources** | ✅ Complete | Static | `ResourcesPage.tsx` | Curated security resources |
| **Community** | ✅ Complete | Static | `CommunityPage.tsx` | Leaderboard, threads |
| **Theme Toggle** | ✅ Complete | N/A | `ThemeToggle.tsx` | Dark/light with persistence |
| **Cookie Consent** | ✅ Complete | N/A | `CookieConsent.tsx` | GDPR/CCPA compliant |
| **SEO** | ✅ Complete | N/A | `AppShell.tsx` RouteSeo | Meta, OG, Twitter, JSON-LD |
| **Error Boundaries** | ✅ Complete | N/A | Multiple levels | Double-wrapped + per-route |
| **PWA** | ✅ Complete | N/A | `sw.js` | Service worker + manifest |
| **Gamification** | ✅ Complete | Integrated | XP, streaks, badges | Integrated across pages |
| **Adaptive Mentor** | ✅ Complete | `/api/adaptive/*` | `AdaptiveMentorContext` | Difficulty adaptation |
| **Compliance (GDPR)** | ✅ Complete | `/api/compliance/*` | Cookie consent + policy | Data operations |

## Planned Features (60-Day Roadmap)

| Feature | Priority | Target Date |
|---------|----------|-------------|
| Real Sentry DSN integration | High | Week 1 |
| WCAG 2.1 AA compliance | High | Week 2 |
| Zorvix-style profile UI | Medium | Week 5 |
| Real-time RUM metrics | Medium | Week 3 |
| CI/CD quality gates | Medium | Week 7 |
| GDPR data export/delete | Medium | Week 7 |
| Command palette (Cmd+K) | Low | Week 5 |
| Voice input for ZORVIX | Low | Week 6 |
