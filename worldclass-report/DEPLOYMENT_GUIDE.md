# ZeroDay Guardian — Deployment Guide

**Last Updated:** May 27, 2026

---

## Architecture

```
Frontend (Vercel)                    Backend (Render)
  zerodayguardian-delta.vercel.app     zerodayguardian-backend.onrender.com
       │                                       │
       └────────────── HTTPS ──────────────────┘
```

## Prerequisites

- **Node.js** >= 20.x
- **npm** >= 9.x
- **GitHub** account (for CI/CD)
- **Vercel** account (for frontend)
- **Render** account (for backend + Python API)
- **MongoDB Atlas** cluster (or any MongoDB instance)
- **Firebase** project (for Auth + Firestore)

## Environment Variables

### Frontend (Vercel)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | ✅ | Backend URL (e.g., `https://zerodayguardian-backend.onrender.com`) |
| `VITE_FIREBASE_API_KEY` | ✅ | Firebase API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | ✅ | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | ✅ | Firebase project ID |
| `VITE_FIREBASE_APP_ID` | ✅ | Firebase app ID |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | ✅ | Firebase sender ID |
| `VITE_ENABLE_FIREBASE_AUTH` | ❌ | Set to `true` to enable Firebase auth |
| `VITE_SENTRY_DSN` | ❌ | Sentry error tracking DSN |

### Backend (Render)

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | JWT signing secret (min 32 chars) |
| `SESSION_SECRET` | ✅ | Session encryption secret |
| `CORS_ORIGIN` | ✅ | Frontend URL |
| `LLM_API_KEY` | ❌ | LLM API key for ZORVIX AI |
| `SENTRY_DSN` | ❌ | Sentry error tracking DSN |
| `REDIS_URL` | ❌ | Redis connection string (for caching) |

## Deployment Steps

### 1. Firebase Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication** → Sign-in methods → Email/Password + Google
3. Enable **Cloud Firestore** → Create database (start in test mode, then apply rules)
4. Copy Firebase config → add to Vercel environment variables

### 2. MongoDB Atlas Setup

1. Create cluster at [mongodb.com/atlas](https://mongodb.com/atlas)
2. Create database user with read/write access
3. Whitelist Render's IP range (`0.0.0.0/0` for development)
4. Copy connection string → add to Render environment variables

### 3. Vercel Deployment (Frontend)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Or connect via GitHub:
# 1. Go to vercel.com → Import Repository
# 2. Select zeroday-guardian-main
# 3. Add environment variables
# 4. Deploy
```

**Vercel Configuration** (`vercel.json`):
- Framework: Vite
- Build: `npm run build`
- Output: `dist`
- Install: `npm install --no-fund --no-audit --prefer-offline`

### 4. Render Deployment (Backend)

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click **New +** → **Web Service**
3. Connect GitHub repository
4. Configure:
   - **Name:** `zerodayguardian-backend`
   - **Runtime:** Node
   - **Build Command:** `npm install --no-fund --no-audit`
   - **Start Command:** `node backend/server.js`
   - **Health Check Path:** `/api/health`
5. Add all environment variables from render.yaml
6. Deploy

### 5. GitHub Actions (CI/CD)

The repository includes GitHub Actions workflows:

**`deploy.yml`**: Quality checks on push to `main`/`develop`
- ✅ Linting (`npm run lint`)
- ✅ TypeScript check (`npm run typecheck`)
- ✅ Unit tests (`npm test`)
- ✅ Production build (`npm run build`)
- ✅ Trivy vulnerability scan

**To enable auto-deploy to Vercel/Render:**
1. Vercel: Connect repo → Auto-deploy enabled by default
2. Render: Connect repo → Auto-deploy enabled by default

## Docker Deployment

```bash
# Build and run with Docker Compose (full stack)
docker-compose up -d

# This starts:
#   - MongoDB (port 27017)
#   - Redis (port 6379)
#   - PostgreSQL (port 5432)
#   - Python API (port 8000)
#   - Node.js App (ports 8080, 8787)
```

## Kubernetes Deployment

```bash
# Apply K8s manifests
kubectl apply -k k8s/

# This includes:
#   - Deployment (2 replicas, rolling update)
#   - Service (ClusterIP)
#   - HPA (auto-scale CPU/Memory)
#   - Ingress (TLS via cert-manager)
#   - Prometheus scrape config
```

## Health Check

```bash
# Backend health
curl https://zerodayguardian-backend.onrender.com/api/health

# Security headers check
curl -sI https://zerodayguardian-delta.vercel.app | grep -E "(Strict-Transport-Security|X-Frame-Options|Content-Security-Policy|Referrer-Policy|Permissions-Policy)"
```

## Monitoring

- **Sentry**: Optional error tracking (set `VITE_SENTRY_DSN`)
- **Prometheus**: Metrics endpoint at `/metrics` (K8s only)
- **OpenTelemetry**: Traces and metrics collection (set `OTEL_*` env vars)
- **Health Endpoints**: `/api/health`, `/api/ready`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| CORS errors | Update `CORS_ORIGIN` in Render env to match Vercel URL |
| Auth fails | Check Firebase config vars in Vercel |
| Labs not loading | Check Python API health at `{backend-url}/pyapi/health` |
| Gamification not saving | Check Firestore rules → needs read/write for user docs |
| Build fails | Run `npm run typecheck` and `npm run lint` locally first |
