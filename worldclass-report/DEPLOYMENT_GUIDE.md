# ZeroDay Guardian — Deployment Guide

## Prerequisites

- Node.js >= 20
- MongoDB Atlas cluster (or any MongoDB)
- Vercel account (frontend)
- Render account (backend)

---

## 1. Backend Deployment (Render)

### Step 1: Set Environment Variables

In your Render dashboard, add these environment variables:

```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>/zeroday_guardian?retryWrites=true&w=majority
SESSION_SECRET=<random-64-char-string>
JWT_SECRET=<random-64-char-string>
CORS_ORIGIN=https://zerodayguardian-delta.vercel.app
APP_BASE_URL=https://zerodayguardian-delta.vercel.app
BACKEND_PUBLIC_URL=https://<your-render-service>.onrender.com
HEALTHCHECK_SECRET=<random-string>
```

### Step 2: Deploy

- **Start command:** `npm start` (runs `node backend/server.js`)
- **Build command:** None (Node app)
- **Instance type:** Starter or higher (512MB+ RAM)

### Step 3: Verify

```bash
curl https://<your-render-service>.onrender.com/health
# → {"status":"ok","service":"neurobot-backend",...}
```

---

## 2. Frontend Deployment (Vercel)

### Step 1: Set Environment Variables

In Vercel project settings → Environment Variables:

```env
VITE_SITE_URL=https://zerodayguardian-delta.vercel.app
VITE_API_URL=https://<your-render-service>.onrender.com
VITE_API_BASE_URL=https://<your-render-service>.onrender.com
BACKEND_PUBLIC_URL=https://<your-render-service>.onrender.com
```

### Step 2: Deploy

- **Framework preset:** Vite
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Install command:** `npm install --no-fund --no-audit --prefer-offline`

### Step 3: Configure Rewrites (vercel.json)

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```

### Step 4: Verify

Visit `https://zerodayguardian-delta.vercel.app` — the app should load with no console errors.

---

## 3. Post-Deployment Checks

```bash
# Frontend
curl -I https://zerodayguardian-delta.vercel.app
# → 200 OK, security headers present

# Backend
curl https://<your-render-service>.onrender.com/api/health
# → {"status":"ok","service":"zero-day-guardian-backend","version":"1.0.0"}

# Labs endpoint
curl https://<your-render-service>.onrender.com/api/labs
# → {"success":true,"labs":[...]}

# Auth providers
curl https://<your-render-service>.onrender.com/api/auth/providers
# → {"status":"ok","providers":["google"],...}
```

## 4. Troubleshooting

| Issue | Solution |
|-------|----------|
| Backend 404 on routes | Verify `backend/src/app.mjs` imports all route files |
| CORS errors | Check `CORS_ORIGIN` matches the Vercel URL exactly |
| MongoDB connection | Verify `MONGODB_URI` and IP whitelist (0.0.0.0/0 for Render) |
| Frontend API 401 | User needs to log in — protected routes require auth |
| Build failures | Run `npm run typecheck` and `npm test` locally first |
