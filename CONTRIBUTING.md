# Contributing to ZeroDay Guardian

Thank you for considering contributing to ZeroDay Guardian! This guide covers everything you need to get started.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| **Node.js** | ≥ 20.0.0 (`.nvmrc` specifies 24) | Run `nvm use` to match |
| **npm** | ≥ 10 | Ships with Node 20+ |
| **Git** | ≥ 2.40 | For conventional commits |
| **MongoDB** | 6.0+ | Local or Atlas cluster |

### Optional (Backend)

- **Docker** — for containerized backend development
- **Python 3.11+** — only if working on the Python AI services (`/pyapi`)

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/shubhrajkumar/zerodayguardian.git
cd zerodayguardian

# 2. Install dependencies
npm install --no-fund --no-audit

# 3. Copy environment template
cp .env.example .env
# Edit .env with your Firebase, MongoDB, and API keys

# 4. Start the frontend dev server (port 8080)
npm run dev

# 5. (Optional) Start the backend server (port 8787)
npm run dev:server
```

> **Frontend-only development?** Enable mock auth in DevTools: `localStorage.setItem("zdg_mock_auth", "true")` then reload. See [AGENTS.md](./AGENTS.md) for details.

---

## Project Structure

```
zeroday-guardian/
├── api/                    # Vercel serverless function (CSP nonce injection)
├── auth/                   # Auth service (legacy)
├── backend/                # Express.js backend
│   ├── src/app.mjs         # Main Express app with middleware stack
│   ├── src/config/         # Env, MongoDB, Redis config
│   ├── src/middleware/      # Error handler, auth, CSRF, rate limiting
│   ├── routes/             # Route modules (auth, labs, missions, etc.)
│   └── services/           # Business logic (AI engine, lab sandbox)
├── e2e/                    # Playwright end-to-end tests
├── public/                 # Static assets (favicons, downloads, SW)
├── scripts/                # Dev/ops utilities
├── src/                    # React frontend (Vite + TypeScript)
│   ├── components/         # Reusable UI components
│   ├── context/            # React Context providers
│   ├── data/               # Static data (courses, blogs)
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utilities, API clients, Firebase
│   ├── pages/              # Route page components
│   ├── styles/             # Additional CSS
│   ├── test/               # Unit/integration tests
│   └── utils/              # Helper functions
├── tools/                  # Security tool definitions
└── worldclass-report/      # Audit reports and architecture docs
```

---

## Available Scripts

### Development

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend dev server (Vite, port 8080) with API proxy |
| `npm run dev:web` | Frontend only (no backend proxy) |
| `npm run dev:server` | Backend only (Express, port 8787) |
| `npm run dev:server:full` | Frontend + backend together |

### Build & Deploy

| Command | Description |
|---------|-------------|
| `npm run build` | Production build (Vite) |
| `npm run preview` | Preview production build locally |
| `npm run start` | Start production backend (`node backend/server.js`) |

### Testing

| Command | Description |
|---------|-------------|
| `npm test` | Run unit tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run typecheck` | TypeScript type-check (no emit) |
| `npm run lint` | ESLint all files |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run test:e2e:ui` | Playwright with interactive UI |

### Operations

| Command | Description |
|---------|-------------|
| `npm run health:stack` | Check backend health |
| `npm run env:render:sync` | Sync Render environment variables |

---

## Branching Strategy

We use a **trunk-based** development model:

- **`main`** — production-ready code. All PRs merge here.
- Feature branches — branched from `main`, merged via PR.

### Branch Naming Conventions

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feat/` | New feature | `feat/osint-breach-monitor` |
| `fix/` | Bug fix | `fix/csp-google-fonts` |
| `perf/` | Performance optimization | `perf/defer-sentry-init` |
| `docs/` | Documentation only | `docs/update-changelog` |
| `chore/` | Maintenance, deps, config | `chore/browserslist-db-refresh` |
| `security/` | Security fix or hardening | `security/fix-cors-origin` |

---

## Commit Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/) to enable automated changelogs and semantic versioning.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | Description | When to Use |
|------|-------------|-------------|
| `feat` | New feature | Adding a new page, component, or API endpoint |
| `fix` | Bug fix | Fixing a runtime error, broken UI, or API issue |
| `perf` | Performance | Bundle optimization, lazy loading, caching |
| `refactor` | Code restructuring | No behavior change, just cleaner code |
| `docs` | Documentation | README, CHANGELOG, inline comments |
| `test` | Tests | Adding or updating test coverage |
| `chore` | Maintenance | Dep updates, config changes, CI fixes |
| `security` | Security | CSP, auth, vulnerability fixes |
| `style` | Formatting | Whitespace, semicolons (no logic change) |

### Scopes

| Scope | Area |
|-------|------|
| `frontend` | `src/` — React components, pages, hooks |
| `backend` | `backend/` — Express server, routes, middleware |
| `api` | `api/` — Vercel serverless functions |
| `csp` | Content Security Policy changes |
| `auth` | Authentication and authorization |
| `ui` | UI component library (`src/components/ui/`) |
| `docs` | Documentation and reports |

### Examples

```bash
# Feature
git commit -m "feat(frontend): add real-time leaderboard polling"

# Bug fix with scope
git commit -m "fix(backend): align email index unique flag between db.mjs and memoryService.mjs"

# Performance
git commit -m "perf(frontend): defer Sentry initialization via requestIdleCallback"

# Security
git commit -m "security(csp): add Google Fonts and Sentry domains to Content-Security-Policy"
```

---

## Pull Request Guidelines

### Before Opening a PR

1. **Run the full quality suite:**
   ```bash
   npm run typecheck
   npm test
   npm run lint
   npm run build
   ```

2. **Verify no console errors** — start the dev server and check the browser console.

3. **Update tests** — if you changed behavior, update or add tests.

4. **Update documentation** — if you changed APIs, routes, or env vars, update the relevant docs.

### PR Template

```markdown
## What

Brief description of the change.

## Why

Why this change is needed (link to issue if applicable).

## How

Key implementation details or trade-offs.

## Verification

- [ ] `npm run typecheck` passes
- [ ] `npm test` passes (366+ tests)
- [ ] `npm run build` succeeds
- [ ] No console errors in browser
- [ ] Tested on mobile viewport
- [ ] Light/dark theme verified
```

### Review Checklist

- [ ] Follows existing code style and conventions
- [ ] No hardcoded colors — uses CSS theme variables (`var(--theme-*)`)
- [ ] No `any` types — proper TypeScript typing
- [ ] Components are accessible (ARIA labels, keyboard nav)
- [ ] Responsive on mobile/tablet/desktop
- [ ] No new runtime errors or CSP violations

---

## Code Style

### TypeScript / React

- **Strict TypeScript** — no `any` types
- **Functional components** — no class components (except ErrorBoundary)
- **CSS variables** — use `var(--theme-*)` for all colors, never hardcoded hex
- **Tailwind CSS** — utility-first classes, custom components in `src/index.css`
- **Named exports** — prefer named exports over default exports for utilities
- **Barrel files** — avoid `index.ts` barrel re-exports

### Imports

```typescript
// ✅ Correct — path alias
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

// ❌ Wrong — relative path
import { Button } from "../../components/ui/button";
```

### Component Pattern

```tsx
import { useState } from "react";
import { cn } from "@/lib/utils";

interface MyComponentProps {
  title: string;
  variant?: "default" | "secondary";
}

export function MyComponent({ title, variant = "default" }: MyComponentProps) {
  return (
    <div className={cn("rounded-xl p-4", variant === "secondary" && "opacity-80")}>
      <h2 className="text-sm font-semibold" style={{ color: "var(--theme-text)" }}>
        {title}
      </h2>
    </div>
  );
}
```

---

## Testing

### Unit Tests (Vitest)

Located in `src/test/`. Run with:

```bash
npm test              # Single run
npm run test:watch    # Watch mode
```

**Test naming:** `<Component>.test.tsx` or `<utility>.test.ts`

### E2E Tests (Playwright)

Located in `e2e/`. Run with:

```bash
npm run test:e2e          # Headless
npm run test:e2e:ui       # Interactive UI
```

### Writing Tests

```typescript
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MyComponent } from "./MyComponent";

describe("MyComponent", () => {
  it("renders the title", () => {
    render(<MyComponent title="Hello" />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_BASE_URL` | ✅ | Backend URL (e.g., `https://zerodayguardian-backend.onrender.com`) |
| `VITE_FIREBASE_API_KEY` | ✅ | Firebase API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | ✅ | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | ✅ | Firebase project ID |
| `VITE_SENTRY_DSN` | ⚠️ | Sentry DSN (optional, enables error tracking) |
| `VITE_ENABLE_FIREBASE_AUTH` | ⚠️ | Set to `"true"` to enable Firebase auth |

> **Never commit `.env` files.** Use `.env.example` as a template.

---

## Architecture Decisions

### Why RequestIdleCallback for Sentry?

Sentry's SDK (`@sentry/react`) is ~270 KB and includes browser tracing, replay, and React Router integration. Initializing it synchronously blocks the main thread and increases TBT. Deferring via `requestIdleCallback` removes it from the critical render path while still capturing errors that occur after first paint.

### Why Two-Layer CSP?

- **`api/index.mjs`** — nonce-based CSP for HTML responses (strict, no `'unsafe-inline'`)
- **`vercel.json`** — static fallback CSP with `'unsafe-inline'` for non-HTML routes

This ensures security for HTML pages while allowing static assets to function on Vercel's CDN.

### Why Manual Chunks?

Vite's default code splitting doesn't optimally separate large vendor libraries. Manual chunks ensure:
- **Firebase (666 KB)** loads only when Firebase features are accessed
- **Sentry (270 KB)** loads only after first paint
- **Framer Motion (122 KB)** loads only when animation components render
- **React (266 KB)** is cached independently and shared across all routes

---

## Getting Help

- **Issues:** [GitHub Issues](https://github.com/shubhrajkumar/zerodayguardian/issues)
- **Email:** ksubhraj28@gmail.com
- **Docs:** [codebuff.com/docs](https://codebuff.com/docs)

---

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.
