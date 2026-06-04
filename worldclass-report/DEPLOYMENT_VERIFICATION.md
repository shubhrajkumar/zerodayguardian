# Deployment Verification — ZeroDay Guardian

**Verified:** June 3, 2026

---

## Frontend (Vercel)

| Check | Result |
|-------|--------|
| URL | https://zerodayguardian-delta.vercel.app |
| HTTP Status | 200 OK |
| Console Errors | **0** (verified via browser automation) |
| CSP Header | ✅ Delivered via HTTP header with per-request nonce |
| CSP Meta Tag | ✅ Stripped by api/index.mjs serverless function |
| frame-ancestors | ✅ Enforced via HTTP header only (meta tag warning resolved) |
| Page Load | ✅ No layout shift, no FOUC |
| Fonts | ✅ Non-blocking preload with onload swap |
| JSON-LD | ✅ Organization + WebSite + WebApplication schemas |
| Sitemap | ✅ /sitemap.xml |
| Robots | ✅ /robots.txt |
| Service Worker | ✅ /sw.js with must-revalidate |

## Backend (Render)

| Check | Result |
|-------|--------|
| URL | https://zerodayguardian-backend.onrender.com |
| Health Endpoint | `/api/health` → 200 OK |
| Service Status | `ok` |
| Node Version | v24.16.0 |
| Environment | production |
| Uptime | 33,499 seconds (~9.3 hours) |
| Memory | 67.09 MB heap / 73.6 MB total |
| Google Auth | ✅ Enabled |
| Session Auth | ✅ Enabled |
| CORS Origins | 4 configured (production + preview + dev) |

## Backend Routes Verified

| Endpoint | Method | Auth Required | Status |
|----------|--------|---------------|--------|
| `/api/health` | GET | No | ✅ 200 |
| `/api/auth/verify` | GET | Yes | ✅ Protected |
| `/api/auth/providers` | GET | No | ✅ Public |
| `/api/dashboard/stats` | GET | Yes | ✅ Protected |
| `/api/users/profile` | GET | Yes | ✅ Protected |
| `/api/labs` | GET | No | ✅ Public |
| `/api/missions` | GET | Yes | ✅ Protected |
| `/api/courses` | GET | Yes | ✅ Protected |
| `/api/learning` | GET | Yes | ✅ Protected |
| `/api/osint` | GET | Yes | ✅ Protected |
| `/api/neurobot/chat` | POST | Rate Limited | ✅ Protected |
| `/api/scans` | GET | Yes | ✅ Protected |
| `/api/compliance` | GET | Yes | ✅ Protected |

## Security Headers (Vercel)

| Header | Value |
|--------|-------|
| Strict-Transport-Security | max-age=63072000; includeSubDomains; preload |
| X-Frame-Options | DENY |
| X-XSS-Protection | 1; mode=block |
| X-Content-Type-Options | nosniff |
| Referrer-Policy | strict-origin-when-cross-origin |
| Permissions-Policy | camera=(), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=(), gyroscope=(), magnetometer=() |
| Content-Security-Policy | Nonce-based (per-request via api/index.mjs) |

## Security Headers (Backend via Helmet)

| Header | Value |
|--------|-------|
| X-Content-Type-Options | nosniff |
| Cross-Origin-Resource-Policy | cross-origin |
| Cross-Origin-Opener-Policy | same-origin |
| Referrer-Policy | no-referrer |
| X-Frame-Options | DENY |
| HSTS | max-age=15552000 (production only) |
| Permissions-Policy | camera=(), microphone=(), geolocation=(), payment=() |
