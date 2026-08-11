# OTP Architecture

## Overview

ZeroDay Guardian uses a **shared OTP service** that can run in two modes:

1. **In-app (default)** — OTP endpoints are mounted directly inside the main Express backend
2. **Standalone (optional)** — A separate Express process handles OTP independently

Both modes delegate to the same `backend/src/services/otpService.mjs` module, ensuring identical behavior regardless of deployment choice.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Main Backend                          │
│                   (port 8787 / 10000)                    │
│                                                          │
│  ┌──────────────────────┐   ┌─────────────────────────┐ │
│  │  Auth Routes          │   │  /api/otp/* Routes      │ │
│  │  POST /auth/send-otp  │   │  POST /api/otp/send     │ │
│  │  POST /auth/otp       │   │  POST /api/otp/verify   │ │
│  │  POST /auth/reset-pwd │   │  GET  /api/otp/health   │ │
│  └──────────┬───────────┘   └───────────┬─────────────┘ │
│             │                            │               │
│             ▼                            ▼               │
│  ┌──────────────────────────────────────────────────────┐│
│  │            authService.mjs                           ││
│  │  sendResetOtp() → calls otpService.sendOtpEmail()   ││
│  │  resetPassword() → calls otpService.verifyOtp()     ││
│  └──────────────────────┬───────────────────────────────┘│
│                         │                                 │
│                         ▼                                 │
│  ┌──────────────────────────────────────────────────────┐│
│  │            otpService.mjs  (shared module)           ││
│  │                                                      ││
│  │  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  ││
│  │  │ In-memory │  │ Nodemailer│  │ Express Handlers  │  ││
│  │  │ OTP Store │  │ Transport │  │ sendOtpHandler    │  ││
│  │  │ (Map)     │  │ (SMTP)    │  │ verifyOtpHandler  │  ││
│  │  └──────────┘  └──────────┘  │ otpHealthHandler   │  ││
│  │                               └───────────────────┘  ││
│  └──────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              Standalone OTP Server (optional)            │
│                   (port 5050)                            │
│                                                          │
│  POST /send     → sendOtpHandler  (same as in-app)      │
│  POST /verify   → verifyOtpHandler (same as in-app)     │
│  GET  /health   → otpHealthHandler  (same as in-app)    │
│                         │                                │
│                         ▼                                │
│  ┌──────────────────────────────────────────────────────┐│
│  │            otpService.mjs  (same shared module)      ││
│  │                                                      ││
│  │  Same in-memory Map, same Nodemailer transport,      ││
│  │  same Promise.race timeouts, same preview fallback   ││
│  └──────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

---

## Shared OTP Service (`backend/src/services/otpService.mjs`)

### Core Functions

| Export | Purpose |
|--------|---------|
| `createOtp(email)` | Generates 6-digit OTP, stores in memory with 10-min expiry |
| `verifyOtp(email, otp)` | Checks OTP against in-memory store, returns boolean |
| `sendOtpEmail(email, otp, expiresInMinutes)` | Sends OTP via Nodemailer over SMTP |
| `deleteOtp(email)` | Removes OTP from memory |
| `peekOtp(email)` | Returns stored OTP (development preview only) |
| `getOtpExpiry(email)` | Returns OTP expiry timestamp |
| `isMailConfigured()` | Checks if SMTP env vars are present |

### Express Handlers (reusable by both servers)

| Handler | Route | Behavior |
|---------|-------|----------|
| `sendOtpHandler` | `POST /send` | Validates email → creates OTP → sends via SMTP or preview mode |
| `verifyOtpHandler` | `POST /verify` | Validates email + 6-digit OTP → checks in-memory store |
| `otpHealthHandler` | `GET /health` | Returns `{ status: "ok", activeOtps: <count> }` |

### Timeout Protection

Every SMTP operation is guarded by `Promise.race` with hard timeouts:

```
Nodemailer transport:  connectionTimeout: 5_000
                       greetingTimeout:  5_000
                       socketTimeout:   10_000

transporter.verify():  Promise.race(verify(), 5_000ms timeout)

transporter.sendMail(): Promise.race(sendMail(), 5_000ms timeout)
```

In addition, `authService.sendResetOtp()` wraps the entire `sendOtpEmail` call in another 5s `Promise.race`, providing a 3-layer safety net.

### Preview Mode

When SMTP is not configured (`AUTH_EMAIL_ENABLED=false` or missing credentials) and `authOtpPreviewEnabled=true`:

- The OTP is still created and stored in-memory
- Instead of sending an email, the handler returns `{ sent: false, delivery: "preview", otp: "123456" }`
- This allows development and testing without a real SMTP server
- Preview mode is auto-enabled in non-production environments

### In-Memory OTP Store

- Uses a JavaScript `Map` keyed by normalized email
- OTPs expire after 10 minutes
- A background `setInterval` cleans up expired entries every 30 seconds
- The timer uses `.unref()` so it doesn't prevent Node from exiting

---

## In-App Mode (Default)

### Route Mounting

In `backend/src/app.mjs`:

```javascript
app.post("/api/otp/send",   authRateLimit, sendOtpHandler);
app.post("/api/otp/verify", authRateLimit, verifyOtpHandler);
app.get("/api/otp/health",  otpHealthHandler);
```

### Middleware Chain

The in-app routes inherit the full backend middleware stack:

- **CORS** — Cross-origin headers
- **Helmet** — Security headers
- **Rate limiting** — `authRateLimit` prevents abuse
- **CSRF protection** — Required for mutation endpoints
- **Request context** — Request IDs, audit logging
- **Error handler** — Structured JSON errors

### Integration with Auth Flow

The `authService.mjs` calls into the OTP service directly:

```
POST /auth/send-otp
  → authController.sendOtp()
    → authService.sendResetOtp()
      → otpService.createOtp()      // Generate + store OTP
      → bcrypt.hash(otp, 8)         // Persist bcrypt hash to MongoDB
      → otpService.sendOtpEmail()   // Send via SMTP (5s timeout)
        ↳ On failure → returns { sent: false, delivery: "preview" }
        ↳ On success → returns { sent: true, delivery: "email" }

POST /auth/reset-password
  → authController.resetUserPassword()
    → authService.resetPassword()
      → otpService.verifyOtp()      // Check in-memory store first
        ↳ Fallback → bcrypt.compare() against MongoDB hash
```

### Key Behavior: Graceful Fallback

When email delivery fails or times out, `sendResetOtp()` **never throws** — it returns a preview fallback object:

```javascript
{
  sent: false,
  delivery: "preview",
  destination: "te**@example.com",
  expiresInMinutes: 10,
  message: "Email delivery temporarily unavailable. The reset code has been stored and can be verified."
}
```

This means:
- The client never experiences a 35s timeout
- The OTP remains in the in-memory store for verification
- The user can still complete the password reset via `/auth/reset-password`
- The failure is logged for observability

---

## Standalone Mode (Optional)

### Starting the Server

```bash
node scripts/otp-server.mjs
# Listens on http://localhost:5050
```

Use a custom port:
```bash
OTP_PORT=9090 node scripts/otp-server.mjs
```

### Routes

| Method | Path | Handler |
|--------|------|---------|
| `POST` | `/send` | `sendOtpHandler` |
| `POST` | `/verify` | `verifyOtpHandler` |
| `GET` | `/health` | `otpHealthHandler` |

### Differences from In-App Mode

| Aspect | In-App | Standalone |
|--------|--------|------------|
| Port | Shared with backend (8787/10000) | `5050` (configurable via `OTP_PORT`) |
| Route prefix | `/api/otp/*` | `/*` (no prefix) |
| Rate limiting | `authRateLimit` middleware | None (add if needed) |
| CORS | Full CORS stack | None |
| CSRF | Required | None |
| Auth | Optional (for auth routes) | None |
| Error handler | Structured JSON | Added JSON fallback |

### When to Use Standalone Mode

- **Isolation**: Separate the OTP process from the main backend to prevent SMTP hangs from affecting other API routes
- **Horizontal scaling**: Run the OTP server on a separate instance with dedicated resources
- **Development**: Quick testing without starting the full backend stack
- **SMTP debugging**: Isolate SMTP connectivity issues from the rest of the application

---

## Environment Variables

### SMTP Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AUTH_EMAIL_ENABLED` | No | `true` if credentials present | Master switch for email sending |
| `AUTH_EMAIL_USER` | Yes (for SMTP) | — | Gmail/ SMTP username |
| `AUTH_EMAIL_APP_PASSWORD` | Yes (for SMTP) | — | Gmail app password or SMTP password |
| `AUTH_EMAIL_FROM` | Yes (for SMTP) | — | From address for emails |
| `AUTH_EMAIL_FROM_NAME` | No | `"ZeroDay Guardian Security"` | Display name for the from field |
| `SMTP_HOST` | No | `smtp.gmail.com` | SMTP server hostname |
| `SMTP_PORT` | No | `587` | SMTP server port |
| `SMTP_SECURE` | No | `false` | Use SSL/TLS |
| `SMTP_REQUIRE_TLS` | No | `true` | Require TLS connection |
| `AUTH_OTP_PREVIEW_ENABLED` | No | Auto-detected | Force preview mode on/off |

### Preview Mode Logic

```javascript
authOtpPreviewEnabled = isExplicitTrue(env.AUTH_OTP_PREVIEW_ENABLED)       // explicit true
  ? true
  : isExplicitFalse(env.AUTH_OTP_PREVIEW_ENABLED)                          // explicit false
    ? false
    : env.nodeEnv !== "production"                                         // auto: dev mode
      || localLikeAppHost                                                  // localhost
      || (isManagedDeploy && !authEmailEnabled);                           // deployed but no SMTP
```

### Standalone Server Only

| Variable | Default | Description |
|----------|---------|-------------|
| `OTP_PORT` | `5050` | Port for the standalone OTP server |

---

## Testing

### Unit Tests

```bash
# Run the authService tests (includes sendResetOtp timeout/fallback tests)
npx vitest run backend/services/security-service/authService.test.js
```

The test file covers:
- Preview mode when mail is not configured
- 404 when user is not found
- Preview fallback when SMTP times out (using fake timers)
- Preview fallback when SMTP fails with various errors
- Success path when email sends

### Live Test (Standalone)

```bash
# Start the OTP server
node scripts/otp-server.mjs

# Health check
curl http://localhost:5050/health

# Send OTP (preview mode if no SMTP configured)
curl -X POST http://localhost:5050/send \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Verify OTP
curl -X POST http://localhost:5050/verify \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","otp":"123456"}'
```

### Live Test (In-App)

```bash
# Start the full backend
node backend/server.js

# Send OTP
curl -X POST http://localhost:8787/api/otp/send \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Also available via auth routes
curl -X POST http://localhost:8787/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

---

## Security Considerations

- **OTP expiry**: 10 minutes, enforced by both in-memory expiry and optional MongoDB bcrypt hash
- **No persistent storage of plaintext OTPs**: The in-memory store is process-local; MongoDB stores only bcrypt hashes
- **Rate limiting**: Main backend OTP routes use `authRateLimit` middleware; standalone server has no rate limiting by design (add if deploying publicly)
- **Preview mode**: Exposes OTPs in response body when enabled — never enable in production
- **`setInterval().unref()`**: The cleanup timer does not prevent Node from exiting, avoiding zombie processes
