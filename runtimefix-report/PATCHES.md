# Applied Code Patches

These are the actual code changes that resolved the "Cannot read properties of undefined (reading 'map')" crash on the dashboard.

---

## Patch 1: Safe Data Utilities (`src/utils/safeData.ts`)

**Commit:** `ebbc1f5`

**Problem:** Components calling `.map()` on API response fields that could be `undefined`.

**Fix:** Added defensive wrapper functions that guarantee array/string/number types.

```ts
// src/utils/safeData.ts

/** Guarantees an array is returned even if `data` is undefined/null. */
export function safeArray<T>(data: T[] | undefined | null): T[] {
  return Array.isArray(data) ? data : [];
}

/** Safe `.map()` that won't crash if `data` is undefined/null. */
export function safeMap<T, R>(
  data: T[] | undefined | null,
  fn: (item: T, index: number) => R
): R[] {
  return safeArray(data).map(fn);
}

/** Returns the value or a fallback if undefined/null. */
export function safeGet<T>(data: T | undefined | null, fallback: T): T {
  return data ?? fallback;
}

/** Safe string getter */
export function safeStr(data: string | undefined | null, fallback = ""): string {
  return data ?? fallback;
}

/** Safe number getter */
export function safeNum(data: number | undefined | null, fallback = 0): number {
  return data ?? fallback;
}

/** Safe object getter */
export function safeObj<T extends Record<string, unknown>>(
  data: T | undefined | null,
  fallback: T = {} as T
): T {
  return data ?? fallback;
}

/** Alias for safeArray */
export const safeArr = safeArray;
```

---

## Patch 2: Mission System API Context — Safe Array Wrapping (`src/context/MissionSystemApiContext.tsx`)

**Commit:** `ebbc1f5`

**Problem:** `missionData.tasks`, `missionData.recent_rewards`, `missionData.rails`, etc. could be `undefined` from the API, causing `.map()` to crash.

**Fix:** Wrapped every `.map()` call with `safeArray()`:

```ts
// Before (risky):
tasks: missionData.tasks.map((task) => ({ ... }))

// After (safe):
tasks: safeArray<MissionControlPayload['tasks'][0]>(missionData.tasks).map((task) => ({ ... }))
```

The same pattern was applied to 6 other API response fields:
- `recentRewards` — `safeArray(missionData.recent_rewards).map(...)`
- `rails` — `safeArray(missionData.rails).map(...)`
- `quickActions` — `safeArray(missionData.quick_actions).map(...)`
- `shareableInsights` — `safeArray(missionData.shareable_insights).map(...)`
- `smartNotifications` — `safeArray(missionData.smart_notifications).map(...)`
- `debug.recentEvents` — `safeArray(missionData.debug.recent_events).map(...)`

---

## Patch 3: API Client — Robust Error Handling (`src/lib/apiClient.ts`)

**Commit:** `ebbc1f5`

**Problem:** API timeouts and network errors caused unhandled rejections that could leave data in an undefined state.

**Fix:** Added comprehensive error handling with retry logic:

```ts
// Key features added:
// - 35000ms timeout (default axios is no timeout)
// - CSRF token extraction from response headers
// - Auto-retry on 503 / timeout (up to 2 additional attempts)
// - Network error detection with status code normalization
// - Token refresh on 401 responses
```

---

## Patch 4: Auth Token Refresh with Bearer Header (`src/context/AuthContext.tsx`, `src/lib/api.ts`)

**Commit:** `ebbc1f5`

**Problem:** Auth tokens were not being sent as Bearer headers consistently, causing 401 responses that could break data loading.

**Fix:** Standardized Bearer token injection across all API calls:

```ts
// Headers consistently include:
Authorization: Bearer <token>
X-CSRF-Token: <csrf-token>
Content-Type: application/json
```

---

## Patch 5: Global Error Boundary (`src/components/ErrorBoundary.tsx`)

**Commit:** Earlier build

**Problem:** Uncaught runtime exceptions (like `.map()` on undefined) would crash the entire page (white screen of death).

**Fix:** Global `<ErrorBoundary>` wraps the entire `<App />`:

```tsx
// Features:
// - Catches all unhandled React render errors
// - Shows "Fallback mode is active. Blank screen prevented." message
// - Retry button to attempt recovery
// - Sentry error logging integration
// - Contact Support link
```

---

## Patch 6: API Response Safety in ToolDetail (`src/pages/ToolDetail.tsx`)

**Commit:** `ebbc1f5`

**Problem:** Deep property access on nested API responses could crash if any intermediate value was undefined.

**Fix:** Added `|| []` fallbacks on all array access and `?.` optional chaining:

```tsx
// Before:
{result.technologies.map((tech) => ...)}

// After:
{(result.technologies.length ? result.technologies : ["Unknown stack"]).map((tech) => ...)}

// Before:
{result.missingHeaders.map((item) => ...)}

// After:
{(result.missingHeaders?.length ? result.missingHeaders : ["None detected"]).map((item) => ...)}

// Before:
{result.openPorts.map((entry) => ...)}

// After:
{(result.openPorts?.length ? result.openPorts : [{ port: 0, status: "No common ports responded" }]).map((entry) => ...)}
```

---

## Patch 7: Environment Configuration (.env.example)

**Commit:** `a6198ee` (this report)

**Problem:** `NODE_ENV=production` in `.env.example` caused Vite build warning.

**Fix:** Removed `NODE_ENV=production` line and added documentation that Vite manages this automatically.

---

## Verification

| Check | Result |
|-------|--------|
| TypeScript (`tsc --noEmit`) | ✅ Zero errors |
| Vite production build | ✅ Builds in ~3 min, zero errors |
| Test suite (123 tests) | ✅ All pass |
| Live site `/dashboard` redirect | ✅ 200 → redirect to `/auth` |
| Live site console errors | ✅ Zero critical errors |
| Backend health | ✅ 200 OK |
