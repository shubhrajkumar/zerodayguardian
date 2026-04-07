# Vercel Deployment

## Active deployment shape

- Vercel serves the frontend from the repo root with Vite.
- The Node compatibility API is served by `api/[...path].js`.
- Python is not deployed on Vercel from this repo anymore.
- `vercel.json` keeps `/api/*` out of the SPA rewrite path and lets Vercel auto-detect the project as Node/Vite.

## Recommended production topology

- Vercel project: frontend on `https://zeroday-guardian.app`
- Live backend: Node service on a separate host such as Render
- Optional Python service: host separately if you still need FastAPI workloads

## Required frontend env

- `BACKEND_PUBLIC_URL=https://api.zeroday-guardian.app`
- `VITE_API_BASE_URL=` leave empty to let the frontend fall back to `BACKEND_PUBLIC_URL`
- `VITE_PY_API_URL=` leave empty unless the browser should bypass the Node backend and call a separate Python service directly

## Backend routing note

- Browser `/api/*` calls are resolved against `BACKEND_PUBLIC_URL`.
- The Node backend can proxy or bridge to any separately hosted Python service with its own internal env configuration.

## Notes

- `.vercelignore` excludes Python-only and local dev artifacts from the Vercel upload.
- Keep root-level `requirements.txt` and root-level Python entrypoints out of the repo if Vercel should remain a pure Node/Vite deployment.
