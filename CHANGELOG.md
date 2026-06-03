# Changelog

All notable changes to ZeroDay Guardian are documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [2.3.0] — 2026-06-03

### Security

#### Content Security Policy — Nonce-Based Overhaul

- **`api/index.mjs`**: Added `https://*.sentry.io` to `script-src` to unblock Sentry error tracking scripts in production
- **`api/index.mjs`**: Added `https://fonts.googleapis.com` to `style-src` and `https://fonts.gstatic.com` to `font-src` to allow Google Fonts without `'unsafe-inline'`
- **`api/index.mjs`**: Removed unnecessary `'unsafe-inline'` from `style-src` — cryptographic nonces now handle all inline `<style>` tags injected at serve time
- **`vercel.json`**: Aligned static fallback CSP with nonce-based CSP for consistent security posture across all routes
- **`vercel.json`**: Added `https://accounts.google.com` to `script-src` and `frame-src` for Google OAuth flows
- **`vercel.json`**: Added `https://*.sentry.io` and `https://*.ingest.sentry.io` to `connect-src` for Sentry telemetry
- **`vercel.json`**: Added `https://fonts.googleapis.com` to `style-src` and `https://fonts.gstatic.com` to `font-src`
- **`vercel.json`**: Added `frame-src 'self' https://*.firebaseapp.com https://accounts.google.com` for Firebase Auth popups
- **`vercel.json`**: Added `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'self'` — hardening against injection, clickjacking, and form hijacking
- **`vercel.json`**: Added `worker-src 'self' blob: https://*.sentry.io` for Sentry replay workers
- **`vercel.json`**: Added `wss: ws:` to `connect-src` for WebSocket connections
- **`vercel.json`**: Added `https://*.vercel.app` to `connect-src` for Vercel preview deployments

#### CSP Architecture (Two-Layer Design)

| Layer | File | Purpose |
|-------|------|---------|
| **Nonce-based** | `api/index.mjs` | Per-request cryptographic nonce for all HTML responses — eliminates `'unsafe-inline'` for scripts and styles |
| **Static fallback** | `vercel.json` | `'unsafe-inline'` fallback for static assets served by Vercel's CDN (non-HTML routes) |

> Both layers allow the same external domains (Google Fonts, Sentry, Firebase, Google APIs).
> The `index.html` meta CSP tag is stripped at serve time by `api/index.mjs` to prevent nonce bypass.

### Documentation

#### World Class Audit Report (`worldclass-report/`)

- **`README.md`**: Updated verification table — test count corrected from 123 to **366 tests** across 10 files; added date verification stamp (June 3, 2026)
- **`AUDIT_SUMMARY.md`**: Added Vite production build verification (clean, no warnings) and unit test results (366/366 passed) to the CSP fix verification section
- **`SECURITY_POSTURE.md`**: Added full CSP directive table documenting every allowed source per directive; documented nonce architecture and static fallback rationale; updated CORS section to include `baggage` and `sentry-trace` headers

### Quality Verification

All changes verified before staging:

| Check | Result |
|-------|--------|
| TypeScript typecheck (`tsc --noEmit`) | ✅ Zero errors |
| Vite production build | ✅ Clean build, no warnings |
| Unit tests (vitest) | ✅ 366/366 passed (10 test files) |
| Code review | ✅ CSP directives consistent; report data accurate |

### Files Changed

| File | Change Type | Summary |
|------|-------------|---------|
| `api/index.mjs` | Modified | Added Sentry + Google Fonts to CSP directives |
| `vercel.json` | Modified | Aligned static CSP with nonce-based CSP; added hardening directives |
| `worldclass-report/AUDIT_SUMMARY.md` | Modified | Added build + test verification data |
| `worldclass-report/README.md` | Modified | Updated test count (366) and date stamp |
| `worldclass-report/SECURITY_POSTURE.md` | Modified | Added CSP directive table and architecture docs |
| `CHANGELOG.md` | **New** | This file |

---

## [2.2.0] — 2026-05-XX

### Fixed

- **Crash prevention**: Resolved 11 TypeScript errors (toast types, skeleton props, import path fixes)
- **Import paths**: Fixed case-sensitive import path for Toast component to resolve Vercel build failure
- **Database**: Aligned email index unique flag between `db.mjs` and `memoryService.mjs` to resolve `MongoServerError` code 86
- **Lab deployment**: Fixed state stuck by adding missing backend fields, degraded fallback UI, retry with backoff
- **Neurobot**: Prevented `/api/neurobot/memory/summary` 500 crash when MongoDB unavailable — returns graceful empty snapshot
- **Empty states**: Clean empty state for ProgramPage when backend unavailable

### Changed

- **UI Modernization**: Complete overhaul including crash fix, UI modernization, and security hardening
- **LabPage & ProgramLabPage**: Migrated hardcoded colors to CSS theme variables
- **ToolDetail.tsx**: Migrated hardcoded colors to CSS theme variables
- **Unsafe patterns**: Audited and fixed unsafe `.detail` patterns across codebase

---

## [2.1.0] — 2026-04-XX

### Added

- GDPR/CCPA compliance routes (`/api/compliance/data` export + delete)
- CookieConsent component with granular preference management
- Privacy Policy and Terms of Service pages
- Sentry error monitoring with tracing, replays, and source maps
- Global ErrorBoundary wrapping entire React tree
- Per-request nonce-based CSP via `api/index.mjs` serverless function
- Skip-to-content accessibility link in Layout
- Animated cyber background with reduced-motion and compact-viewport detection
- AssistantCommandPalette for keyboard-driven navigation

### Security

- Helmet security middleware (HSTS, X-Frame-Options, X-Content-Type-Options)
- CORS with dynamic origin validation and Vercel preview support
- CSRF double-submit cookie pattern
- Per-endpoint rate limiting
- Request ID tracing and audit logging
- Input sanitization middleware
- Parameterized MongoDB queries (injection prevention)

---

*For the full commit history, see `git log --oneline`.*
