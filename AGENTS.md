# Authentication Architecture

ZeroDay Guardian uses a single authentication system managed by **AuthContext** (`src/context/AuthContext.tsx`).

## Auth Flow

1. User submits login credentials on the AuthPage (`src/pages/AuthPage.tsx`)
2. Backend is called via `POST /api/auth/login` (or signup, Google OAuth)
3. On backend success, JWT tokens are stored to `localStorage` (`zdg_token`, `zdg_refresh`)
4. On backend failure, an error is shown — **no local fallback**
5. AuthContext goes through a 6-step refresh chain: verify → refresh → bootstrap → Firebase → cached state → clear

## Key Files

| File | Role |
|---|---|
| `src/context/AuthContext.tsx` | **Single source of truth** for authentication |
| `src/lib/firebase.ts` | Lazy-loaded Firebase SDK (Google sign-in only) |
| `src/lib/api.ts` | Axios instance with auth interceptor |
| `src/lib/apiClient.ts` | Token persistence and auth helpers |
| `src/components/ProtectedRoute.tsx` | Route guard using AuthContext only |
| `src/context/ZdgContext.tsx` | **Gamification only** — no auth logic |

## What Was Removed

- **ZdgContext auth logic** (login/signup/logout/isAuthenticated) — moved to AuthContext
- **Mock JWT generation** (`generateMockJwt`) — eliminated
- **Local auth fallback** — backend authentication is the only path
- **`zdg_mock_auth` flag** — replaced with `auth_state` localStorage for E2E tests
- **Token writes from ZdgContext** — `zdg_token` is managed exclusively by AuthContext

> ⚠️ If you need to test authenticated features locally, set `auth_state` in localStorage:
> ```js
> localStorage.setItem("auth_state", JSON.stringify({ isAuthenticated: true, user: { id: "t1", name: "Test", email: "test@test.com", role: "user" }, timestamp: Date.now(), accessToken: "mock-token" }));
> ```
> This uses AuthContext's cached state fallback chain.
