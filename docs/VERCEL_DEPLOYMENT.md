# Vercel Deployment

## Single-project layout

- Frontend is served by Vite from the repo root.
- Node backend routes are served by `api/[...path].js`.
- FastAPI routes are served by `api/pyapi/[...path].py`.
- `vercel.json` keeps `/api/*` and `/pyapi/*` out of the SPA rewrite path.

## Recommended production topology

- Vercel project 1: frontend on `https://zeroday-guardian.app`
- Vercel project 2: backend on `https://api.zeroday-guardian.app`

Deploying the same repo twice is supported:

- frontend project uses the root build with Vite
- backend project uses the same repo and serves the function routes under `api/`

## Required backend env

- `APP_BASE_URL=https://zeroday-guardian.app`
- `BACKEND_PUBLIC_URL=https://api.zeroday-guardian.app`
- `CORS_ORIGIN=https://zeroday-guardian.app,https://www.zeroday-guardian.app`
- `PY_API_INTERNAL_URL=https://api.zeroday-guardian.app/api`

If backend and Python API are served from the same Vercel backend project, set:

- `PY_API_INTERNAL_URL=https://api.zeroday-guardian.app/api`

That lets the Node backend compatibility routes reach `/api/pyapi/*`.

## Frontend env

- `VITE_API_BASE_URL=https://api.zeroday-guardian.app`
- `VITE_PY_API_URL=` leave empty unless the browser should bypass backend routing

## Notes

- Vercel Python functions must fit platform limits. Heavy background jobs are better hosted separately.
- If you split frontend and backend into separate Vercel projects, keep this same routing shape and env values.
- `.vercelignore` excludes local DBs, logs, archives, and dev folders from deployment uploads.
