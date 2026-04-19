# Vercel Deployment

## Deployment model

This repo now deploys to Vercel as a pure Node/Vite project:

- Vercel builds the frontend from the repo root with Vite.
- Vercel can serve the Node compatibility handler at `api/[...path].js`.
- Python is intentionally not deployed from the repo root on Vercel.
- `.vercelignore` excludes Python-only and local dev artifacts so Vercel does not try to parse Python dependency files.

Recommended production split:

1. Vercel for the frontend
2. Render for the live Node backend
3. Optional separate host for Python/FastAPI if still needed

## Vercel project settings

- Framework preset: `Vite`
- Root directory: repo root
- Install command: use the Vercel default
- Build command: use the Vercel default or `npm run build`
- Output directory: `dist`

## Required frontend env on Vercel

Set these in the Vercel project:

```env
VITE_SITE_URL=https://your-frontend.vercel.app
VITE_API_URL=https://your-backend.onrender.com
BACKEND_PUBLIC_URL=https://your-backend.onrender.com
VITE_API_BASE_URL=
VITE_PY_API_URL=
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_GOOGLE_CLIENT_ID=
VITE_ENABLE_FIREBASE_AUTH=true
VITE_ENABLE_FIREBASE_DIAGNOSTICS=false
VITE_FIRESTORE_FORCE_LONG_POLLING=false
```

Notes:

- Set `VITE_API_URL` to the live Render backend origin.
- Leave `VITE_API_BASE_URL` empty unless you explicitly want to override `VITE_API_URL`.
- Leave `VITE_PY_API_URL` empty unless the browser should call a separate Python host directly.

## Required backend env on Render

Set the live backend origin so the frontend can reach it:

```env
APP_BASE_URL=https://your-frontend.vercel.app
BACKEND_PUBLIC_URL=https://your-backend.onrender.com
CORS_ORIGIN=https://your-frontend.vercel.app
GOOGLE_AUTHORIZED_ORIGINS=https://your-frontend.vercel.app
GOOGLE_REDIRECT_URI=https://your-backend.onrender.com/auth/google/callback
SESSION_SECRET=<strong-random-secret>
JWT_SECRET=<strong-random-jwt-secret>
DATABASE_URL=<your-mongodb-connection-string>
FIREBASE_PROJECT_ID=<your-firebase-project-id>
FIREBASE_CLIENT_EMAIL=<your-firebase-admin-client-email>
FIREBASE_PRIVATE_KEY=<your-firebase-admin-private-key>
```

If the Node backend needs to bridge to a separate Python service:

```env
PY_API_INTERNAL_URL=https://your-python-service.onrender.com
```

## How routing works

- Browser `/api/*` calls are resolved against `BACKEND_PUBLIC_URL` during the frontend build.
- The frontend does not need same-origin Vercel `/api/*` routes to talk to the live backend.
- The Node backend can proxy or bridge to any separate Python host with `PY_API_INTERNAL_URL`.
- Firebase Auth should stay enabled on Vercel when the `VITE_FIREBASE_*` variables are configured.
- Python/FastAPI auth works on the live URL when it can verify either the shared Node JWT or Firebase ID tokens via Firebase Admin credentials.

## Deployment checklist

1. Deploy or update the Render backend first.
2. Confirm the backend health URL responds:
   - `https://your-backend.onrender.com/`
   - `https://your-backend.onrender.com/api/health`
3. Set `BACKEND_PUBLIC_URL` in Vercel to that live backend origin.
4. Redeploy the Vercel frontend.
5. Verify in the browser:
   - auth page loads without `/api/auth/providers` 404
   - frontend requests resolve to the live Render backend
   - no Python dependency parsing failure appears in Vercel
