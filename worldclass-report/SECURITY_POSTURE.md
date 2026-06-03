# ZeroDay Guardian — Security Posture

## HTTP Security Headers

| Header | Value | Status |
|--------|-------|--------|
| `Strict-Transport-Security` | `max-age=15552000; includeSubDomains; preload` | ✅ HSTS (180 days) |
| `X-Frame-Options` | `DENY` | ✅ Clickjacking protection |
| `X-Content-Type-Options` | `nosniff` (Helmet default) | ✅ MIME sniffing prevention |
| `Content-Security-Policy` | Per-request nonce in `api/index.mjs` + static fallback in `vercel.json` | ✅ Nonce-based CSP (Google Fonts, Sentry, Firebase allowed) |
| `Referrer-Policy` | `no-referrer` | ✅ Referrer control |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | ✅ Feature restriction |
| `X-Permitted-Cross-Domain-Policies` | `none` | ✅ Adobe Flash restriction |
| `X-DNS-Prefetch-Control` | `off` | ✅ Controlled prefetch |
| `Origin-Agent-Cluster` | `?1` | ✅ Process isolation |

## CSP Directives (Nonce-Based — `api/index.mjs`)

| Directive | Value |
|-----------|-------|
| `default-src` | `'self'` |
| `script-src` | `'self' 'unsafe-eval' 'nonce-{nonce}' *.sentry.io *.firebaseio.com *.googleapis.com apis.google.com accounts.google.com` |
| `style-src` | `'self' 'nonce-{nonce}' fonts.googleapis.com` |
| `font-src` | `'self' data: fonts.gstatic.com` |
| `img-src` | `'self' data: blob: https:` |
| `connect-src` | `'self' *.firebaseio.com identitytoolkit.googleapis.com *.googleapis.com *.ingest.sentry.io *.vercel.app *.onrender.com accounts.google.com wss: ws:` |
| `frame-src` | `'self' *.firebaseapp.com accounts.google.com` |
| `object-src` | `'none'` |
| `base-uri` | `'self'` |
| `form-action` | `'self'` |
| `frame-ancestors` | `'self'` |

**Key security properties:**
- Per-request cryptographic nonce replaces `'unsafe-inline'` for scripts and styles
- Nonce is injected into `<style>` and `<script type="application/ld+json">` tags at serve time
- Static asset CSP (`vercel.json`) uses `'unsafe-inline'` as fallback for non-HTML routes
- Google Fonts explicitly allowed in both `style-src` and `font-src`
- Sentry domains added for error monitoring

## CORS Configuration

- **Production origin:** `https://zerodayguardian-delta.vercel.app`
- **Methods:** GET, POST, PUT, DELETE, OPTIONS
- **Credentials:** true (cookies, auth headers)
- **Allowed headers:** Content-Type, Authorization, X-CSRF-Token, Cookie, Last-Event-ID, X-Request-Id, baggage, sentry-trace
- **Max age:** 600 seconds (preflight caching)
- **Dynamic origin validation:** localhost blocked in production
- **Vercel preview origins:** dynamically allowed via pattern match

## Authentication Flow

1. User authenticates via `/api/auth/login` or Google OAuth
2. Backend returns JWT access token + refresh token
3. Frontend stores tokens in localStorage (zdg_token, zdg_refresh)
4. CSRF token fetched from `/api/auth/csrf`
5. All state-changing requests send X-CSRF-Token header
6. On 401, frontend attempts token refresh via `/api/auth/refresh`
7. On refresh failure, user redirected to `/auth`

## Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/auth/*` | Strict (apiReadRateLimit) | Per IP |
| `/api/neurobot/chat` | chatRateLimit | Per session |
| `/api/osint` | osintRateLimit | Per user |
| `/api/mission` | mutationRateLimit | Per user |
| File uploads | fileUploadRateLimit | Per IP |
| Livez/Readyz probes | Probe rate limits | Per IP |

## CSRF Protection

- Token-based (double-submit cookie pattern)
- Token fetched on first state-changing request
- Stored in sessionStorage
- Verified on POST/PUT/DELETE requests
- Automatic retry on 403 (token refresh)

## Database Security

- Parameterized queries (no raw string concatenation)
- MongoDB injection prevention
- Connection pooling with limits
- Indexes on sensitive fields (email, userId)
- Dead indexes cleaned on startup
- Password hashing with bcryptjs
- Secrets excluded from output (password, refreshToken, resetOtp)
