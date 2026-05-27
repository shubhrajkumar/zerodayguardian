# ZeroDay Guardian — Production Deployment Guide

## Overview

ZeroDay Guardian supports three deployment strategies:
1. **Vercel** (frontend SPA) — Recommended for frontend-only deployments
2. **Docker Compose** — Full-stack local/cloud deployment
3. **Kubernetes** — Enterprise-scale production deployment

---

## 1. Vercel Deployment (Frontend)

### Prerequisites
- Vercel account
- GitHub repository connected to Vercel

### Configuration
The project is fully configured for Vercel via `vercel.json`:

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install --no-fund --no-audit --prefer-offline"
}
```

### Environment Variables (Vercel)
| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend API URL |
| `VITE_PYAPI_URL` | Python API URL |
| `VITE_SITE_URL` | Frontend URL |
| `VITE_FIREBASE_API_KEY` | Firebase API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_SENTRY_DSN` | (Optional) Sentry error tracking |

### Deploy Steps
1. Connect repo to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy — Vercel auto-detects Vite framework
4. Custom domain: Configure DNS at registrar (CNAME to `cname.vercel-dns.com`)

---

## 2. Docker Compose Deployment (Full-Stack)

### Prerequisites
- Docker Engine 24+ and Docker Compose v2
- Git

### Quick Start
```bash
# Clone and enter directory
git clone https://github.com/shubhrajkumar/zerodayguardian.git
cd zerodayguardian

# Set required environment variables
export LLM_API_KEY="your-openai-key"
export SESSION_SECRET="your-session-secret"
export JWT_SECRET="your-jwt-secret"

# Start all services
docker compose up -d

# Verify
curl http://localhost:8080/health
```

### Services
| Service | Port | Description |
|---|---|---|
| `app` | 8080 (web), 8787 (API) | Node.js + Vite frontend + backend |
| `mongo` | 27017 | MongoDB database |
| `redis` | 6379 | Redis cache |
| `postgres` | 5432 | PostgreSQL (Python API) |
| `py-api` | 8000 | Python API (FastAPI) |

### Production Hardening
- Set strong `SESSION_SECRET` and `JWT_SECRET` (use `openssl rand -hex 32`)
- Configure `CORS_ORIGIN` to match your domain
- Enable `TRUST_PROXY=true` when behind a reverse proxy
- Mount persistent volumes for MongoDB and PostgreSQL

---

## 3. Kubernetes Deployment (Enterprise)

### Prerequisites
- Kubernetes cluster (EKS, GKE, AKS, or self-managed)
- `kubectl` configured
- `kustomize` installed
- cert-manager (for TLS)

### Deploy Steps
```bash
# Navigate to K8s manifests
cd k8s

# Create namespace
kubectl apply -f namespace.yaml

# Create secrets from .env.k8s file
# Edit .env.k8s with your values, then:
kubectl create secret generic zdg-secrets --from-env-file=.env.k8s -n zeroday-guardian

# Deploy with Kustomize
kubectl apply -k .

# Verify deployment
kubectl get pods -n zeroday-guardian
kubectl get svc -n zeroday-guardian
```

### Kubernetes Architecture
| Resource | Description |
|---|---|
| **Deployment** | 2 replicas, rolling update strategy |
| **Service** | ClusterIP (port 80 → 8080, port 8787) |
| **HPA** | Auto-scale (2-10 pods, CPU 70%, Mem 80%) |
| **Ingress** | TLS with cert-manager + Let's Encrypt |
| **ServiceMonitor** | Prometheus scraping (30s interval) |
| **OTel Collector** | Traces + Metrics pipeline |

### Monitoring Stack
```bash
# Deploy Prometheus + Grafana
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack

# Deploy OpenTelemetry Collector (included in monitoring.yaml)
kubectl apply -f k8s/monitoring.yaml
```

---

## 4. CI/CD Pipeline

### GitHub Actions
The repository includes three workflows:

| Workflow | Trigger | Purpose |
|---|---|---|
| `deploy.yml` | Push to main/develop, PR to main | Lint → Typecheck → Test → Build → Security Scan |
| `security-audit-weekly.yml` | Monday 4AM UTC | `npm audit` with issue auto-creation |
| `browserslist-db-weekly.yml` | Monday 3AM UTC | Refresh caniuse-lite data |

### Required GitHub Secrets
| Secret | Description |
|---|---|
| `VITE_API_URL` | Backend API URL |
| `VITE_PYAPI_URL` | Python API URL |

---

## 5. Post-Deployment Verification

### Health Checks
```bash
# Frontend
curl https://yourdomain.com/health

# Backend API
curl https://yourdomain.com/api/health

# Prometheus Metrics
curl https://yourdomain.com/api/metrics

# Liveness / Readiness
curl https://yourdomain.com/api/livez
curl https://yourdomain.com/api/readyz

# AI Provider Status
curl https://yourdomain.com/api/health/chatbot
```

### SEO Verification
```bash
# Check sitemap
curl https://yourdomain.com/sitemap.xml

# Check robots.txt
curl https://yourdomain.com/robots.txt

# Validate with Google Search Console
# Submit sitemap: https://search.google.com/search-console
```

### Security Header Check
```bash
curl -sI https://yourdomain.com | grep -E "(Strict-Transport-Security|X-Frame-Options|X-Content-Type-Options|Content-Security-Policy|Referrer-Policy|Permissions-Policy)"
```

---

## 6. DNS & DNSSEC Setup

### Recommended DNS Configuration
| Record | Type | Value |
|---|---|---|
| `@` | CNAME | `cname.vercel-dns.com` |
| `www` | CNAME | `cname.vercel-dns.com` |
| `api` | A | Your backend IP |
| `_dmarc` | TXT | `v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com` |

### Enable DNSSEC
1. Log into your domain registrar (Namecheap, Cloudflare, GoDaddy)
2. Find DNSSEC settings in DNS management
3. Enable DNSSEC and add DS record provided by Vercel
4. Verify: `dnssec.debugger.com`

---

## 7. Monitoring & Alerts

### Integrated Monitoring
- **OpenTelemetry**: Traces + metrics exported via OTLP
- **Prometheus**: `/api/metrics` endpoint for custom metrics
- **Health Endpoints**: `/api/health`, `/api/livez`, `/api/readyz`
- **Sentry**: Optional error tracking (set `VITE_SENTRY_DSN`)

### Prometheus Metrics Available
- Request counts by route and method
- Response times (sum, count, max)
- AI provider health status
- Chat recovery events
- Custom application metrics

---

## 8. Backup & Recovery

### Database Backups
```bash
# MongoDB
docker exec <mongo-container> mongodump --out /backup/$(date +%Y%m%d)

# PostgreSQL
docker exec <pg-container> pg_dump -U postgres zeroday_guardian > backup.sql
```

### Disaster Recovery
1. Restore MongoDB from backup
2. Restore PostgreSQL from backup
3. Redeploy with `docker compose up -d`
4. Verify health endpoints
5. Test auth flow
