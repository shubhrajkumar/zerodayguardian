# ZeroDay Guardian

ZeroDay Guardian is a cybersecurity SaaS built with React, TypeScript, Vite, Firebase, and a Node backend. The frontend is optimized for Vercel, while the live backend is intended to run on a separate host such as Render.

## Stack

- Frontend: React + TypeScript + Vite + Tailwind
- Auth/UI data: Firebase
- Backend: Node + Express
- Optional scanning service: Python/FastAPI hosted separately

## Local development

```bash
npm install
npm run dev
```

The dev runner starts:

- Vite frontend on `http://localhost:8080`
- Node backend on `http://127.0.0.1:8787`
- optional Python API from `backend/python`

## Production deployment

Recommended topology:

1. Frontend on Vercel
2. Node backend on Render
3. Optional Python service on a separate host if still needed

### Frontend env

Set these in Vercel:

```env
VITE_SITE_URL=https://your-frontend.vercel.app
BACKEND_PUBLIC_URL=https://your-backend.onrender.com
VITE_API_BASE_URL=
VITE_PY_API_URL=
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_GOOGLE_CLIENT_ID=
```

### Backend env

Set these on the live Node backend:

```env
APP_BASE_URL=https://your-frontend.vercel.app
BACKEND_PUBLIC_URL=https://your-backend.onrender.com
CORS_ORIGIN=https://your-frontend.vercel.app
DATABASE_URL=<your-mongodb-uri>
SESSION_SECRET=<strong-random-secret>
JWT_SECRET=<strong-random-jwt-secret>
GOOGLE_AUTHORIZED_ORIGINS=https://your-frontend.vercel.app
GOOGLE_REDIRECT_URI=https://your-backend.onrender.com/auth/google/callback
```

If the backend should call a separate Python service:

```env
PY_API_INTERNAL_URL=https://your-python-service.onrender.com
```

## Health checks

- Node backend root: `/`
- Node backend API health: `/api/health`
- frontend build output: `dist/`

## Notes

- Vercel is configured as a Node/Vite project only.
- Python dependency files are kept out of the Vercel root detection path.
- See [docs/VERCEL_DEPLOYMENT.md](./docs/VERCEL_DEPLOYMENT.md) for the deployment checklist.
