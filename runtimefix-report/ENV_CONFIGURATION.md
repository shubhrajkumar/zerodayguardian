# Environment Variable Configuration

**Status:** ✅ `.env.example` exists with full documentation  
**Last Verified:** May 31, 2026

---

## Frontend VITE_ Variables

| Variable | Required | Used In | Current Value |
|----------|----------|---------|---------------|
| `VITE_SITE_URL` | ✅ Yes | `App.tsx` (SEO/canonical) | `https://zerodayguardian-delta.vercel.app` |
| `VITE_API_URL` | ✅ Yes | `apiConfig.ts`, `UserProgressContext.tsx`, `BlogPage.tsx` | `https://zerodayguardian-backend.onrender.com` |
| `VITE_SENTRY_DSN` | ⚠️ Optional | `instrument.ts`, `SentryTestPanel.tsx` | Set via Vercel env |
| `VITE_APP_VERSION` | ⚠️ Optional | `instrument.ts` (Sentry release) | Git commit hash |
| `VITE_API_BASE_URL` | ⚠️ Fallback | `apiConfig.ts` | `VITE_API_URL` default |
| `VITE_PYAPI_URL` | ⚠️ Optional | `apiConfig.ts` (Python API) | Auto-derived from `VITE_API_URL` + `/pyapi` |
| `VITE_PY_API_URL` | ⚠️ Fallback | `apiConfig.ts` | Same as `VITE_PYAPI_URL` |
| `VITE_ENABLE_FIREBASE_DIAGNOSTICS` | ⚠️ Optional | `apiClient.ts`, `firebase.ts` | `false` |
| `VITE_FIREBASE_API_KEY` | ⚠️ If Firebase | `firebase.ts` | Set via Vercel env |
| `VITE_FIREBASE_AUTH_DOMAIN` | ⚠️ If Firebase | `firebase.ts` | Set via Vercel env |
| `VITE_FIREBASE_PROJECT_ID` | ⚠️ If Firebase | `firebase.ts` | Set via Vercel env |
| `VITE_FIREBASE_APP_ID` | ⚠️ If Firebase | `firebase.ts` | Set via Vercel env |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | ⚠️ If Firebase | `firebase.ts` | Set via Vercel env |
| `VITE_ENABLE_FIREBASE_AUTH` | ⚠️ Optional | `firebase.ts` | `false` |
| `VITE_FIRESTORE_FORCE_LONG_POLLING` | ⚠️ Optional | `firebase.ts` | `false` |

## Backend Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `MONGODB_URI` | ✅ Yes | MongoDB connection string |
| `MONGODB_DB_NAME` | ✅ Yes | Database name |
| `SESSION_SECRET` | ✅ Yes | Session encryption secret |
| `JWT_SECRET` | ✅ Yes | JWT signing secret |
| `CORS_ORIGIN` | ✅ Yes | Allowed CORS origin |
| `APP_BASE_URL` | ✅ Yes | Application base URL |
| `GOOGLE_CLIENT_ID` | ⚠️ For Google auth | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | ⚠️ For Google auth | Google OAuth client secret |
| `LLM_API_KEY` | ⚠️ For AI features | LLM provider API key |
| `OPENROUTER_API_KEY` | ⚠️ For OpenRouter | OpenRouter API key |
| `OSINT_*` | ⚠️ For OSINT | Various OSINT API keys |

## Resolution Order (Frontend)

The `apiConfig.ts` resolves API URLs using this priority:

1. **Runtime `process.env`** (server-side rendering context)
2. **`import.meta.env.VITE_*`** (Vite build-time env vars)
3. **`window.VITE_*`** (runtime window globals)
4. **Build-time `__BACKEND_PUBLIC_URL__`** (Vite define)
5. **`DEFAULT_RENDER_BACKEND_URL`** (hardcoded fallback: `https://zerodayguardian-backend.onrender.com`)

---

## Verdict

✅ **Environment configuration is complete and robust** with multi-layered fallbacks. All critical VITE_ variables are documented in `.env.example`. The app degrades gracefully when optional variables are unset.
