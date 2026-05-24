# Mock Auth Mode (Frontend Testing)

When the backend is unavailable (e.g., during local frontend development), you can enable mock authentication to test pages that require a logged-in user — including the Dashboard, Labs, and Tools pages.

## Enabling mock auth

Open your browser's DevTools console and run:

```js
localStorage.setItem("zdg_mock_auth", "true");
```

Then reload the page. The app will skip all backend API calls and immediately authenticate as **Test Guardian** (`test@zerodayguardian.com`).

## Disabling mock auth

```js
localStorage.removeItem("zdg_mock_auth");
```

Then reload the page. The app will return to the normal authentication flow.

## How it works

The check lives in `src/context/AuthContext.tsx` inside the `refreshAuth` callback. Before calling any backend auth APIs, it checks for `localStorage.getItem("zdg_mock_auth") === "true"`. If the flag is set, it skips the backend entirely and injects a mock user object directly into the auth state.

The mock user is a plain object (not a real Firebase/backend user) with:
- **id:** `mock-user-1`
- **name:** Test Guardian
- **email:** test@zerodayguardian.com
- **role:** user

> ⚠️ **This is strictly a development/testing tool.** API calls to `/api/users/profile` and similar endpoints are bypassed. Features that make backend API calls (profile updates, saving progress) will fail silently since no real backend is running. Static UI content — dashboard stats, navigation, theme toggle — works as expected.

## When to use

- Testing dashboard layout, responsive styles, and theme switching
- Verifying auth-conditional UI (RequireAuth, navigation menu items)
- Debugging frontend-only bugs without needing the full backend stack
- Running browser-based tests (Vite dev server on `localhost:8080`, no backend required)
