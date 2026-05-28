# ZeroDay Guardian — Security Posture

## HTTP Security Headers

| Header | Value | Status |
|--------|-------|--------|
| `Strict-Transport-Security` | `max-age=15552000; includeSubDomains; preload` | ✅ HSTS (180 days) |
| `X-Frame-Options` | `DENY` | ✅ Clickjacking protection |
| `X-Content-Type-Options` | `nosniff` (Helmet default) | ✅ MIME sniffing prevention |
| `Content-Security-Policy` | Set via API serverless function | ✅ Custom CSP with nonce |
| `Referrer-Policy` | `no-referrer` | ✅ Referrer control |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | ✅ Feature restriction |
| `X-Permitted-Cross-Domain-Policies` | `none` | ✅ Adobe Flash restriction |
| `X-DNS-Prefetch-Control` | `off` | ✅ Controlled prefetch |
| `Origin-Agent-Cluster` | `?1` | ✅ Process isolation |

## CORS Configuration

- **Production origin:** `https://zerodayguardian-delta.vercel.app`
- **Methods:** GET, POST, PUT, DELETE, OPTIONS
- **Credentials:** true (cookies, auth headers)
- **Allowed headers:** Content-Type, Authorization, X-CSRF-Token, Cookie, Last-Event-ID, X-Request-Id
- **Max age:** 600 seconds (preflight caching)
- **Dynamic origin validation:** localhost blocked in production

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
