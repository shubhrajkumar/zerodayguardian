# Google OAuth Setup Guide

## Overview

ZeroDay Guardian uses Google OAuth for authentication via two paths:
1. **Frontend (Firebase)**: Firebase Auth handles the popup/redirect flow for Google sign-in
2. **Backend (Express)**: Server-side OAuth code exchange for credential verification

## Current Credentials

| Field | Value |
|-------|-------|
| **Google Client ID** | `156777670484-1a79vc8ghkqnhqndqihr2727h076t4ha.apps.googleusercontent.com` |
| **Google Client Secret** | ⚠️ Must be regenerated (see below) |
| **Authorized Origins** | `http://localhost:5173`, `https://zerodayguardian-delta.vercel.app` |
| **Authorized Redirect URIs** | Backend callback + Firebase handler |

---

## Step 1: Regenerate Client Secret

```text
1. Go to https://console.cloud.google.com/apis/credentials
2. Select your project
3. Find the OAuth 2.0 Client ID matching:
   156777670484-1a79vc8ghkqnhqndqihr2727h076t4ha.apps.googleusercontent.com
4. Click the pencil/edit icon
5. Click "Regenerate secret"
6. Copy the new secret immediately (it won't be shown again)
```

---

## Step 2: Configure Authorized URIs

In the same OAuth client edit screen:

### Authorized JavaScript Origins
```
http://localhost:5173
https://zerodayguardian-delta.vercel.app
```

### Authorized Redirect URIs
```
https://zerodayguardian-backend.onrender.com/auth/google/callback
https://zerodayguardian-delta.vercel.app/__/auth/handler
```

---

## Step 3: Update Environment Variables

### 3a: Local Development (`.env.local` — NEVER COMMIT)

```env
# Frontend
VITE_GOOGLE_CLIENT_ID=156777670484-1a79vc8ghkqnhqndqihr2727h076t4ha.apps.googleusercontent.com

# Backend
GOOGLE_CLIENT_ID=156777670484-1a79vc8ghkqnhqndqihr2727h076t4ha.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=[paste-regenerated-secret-here]
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
ENABLE_GOOGLE_LOCALHOST=true
```

### 3b: Vercel (Frontend — Production)

| Variable | Value | Environment |
|----------|-------|-------------|
| `VITE_GOOGLE_CLIENT_ID` | `156777670484-...` | Production + Preview |
| `VITE_FIREBASE_API_KEY` | (existing) | Production + Preview |
| `VITE_FIREBASE_AUTH_DOMAIN` | (existing) | Production + Preview |
| `VITE_FIREBASE_PROJECT_ID` | (existing) | Production + Preview |

### 3c: Render (Backend — Production)

| Variable | Value | Sensitive |
|----------|-------|-----------|
| `GOOGLE_CLIENT_ID` | `156777670484-...` | No |
| `GOOGLE_CLIENT_SECRET` | [regenerated secret] | **Yes** ⚠️ |
| `GOOGLE_REDIRECT_URI` | `https://zerodayguardian-backend.onrender.com/auth/google/callback` | No |

---

## Step 4: Firebase Console Setup

```text
1. Go to https://console.firebase.google.com/
2. Select your project → Authentication → Sign-in method
3. Click Google → Enable
4. Verify the "Web client ID" matches the one above
5. Under "Authorized domains", ensure:
   - zerodayguardian-delta.vercel.app
   - zerodayguardian.firebaseapp.com
   - localhost
6. Save
```

---

## Step 5: Validation

### Backend health check
```bash
curl https://zerodayguardian-backend.onrender.com/api/health
# Expected: 200 OK
```

### OAuth provider status
```bash
curl https://zerodayguardian-backend.onrender.com/api/auth/providers
# Expected: { status: "ok", google: { enabled: true, clientId: "1567..." } }
```

### Local testing
```bash
# 1. Start frontend and backend
npm run dev       # frontend on :5173
npm run dev:backend  # backend on :3000

# 2. Open http://localhost:5173
# 3. Click "Sign in with Google"
# 4. Complete OAuth flow
# 5. Verify authenticated redirect
```

---

## Troubleshooting

| Error | Likely Cause | Fix |
|-------|-------------|-----|
| `redirect_uri_mismatch` | Callback URL doesn't match console config | Check Authorized Redirect URIs in Google Cloud Console |
| `invalid_client` | Wrong or missing client secret | Regenerate secret and update env vars |
| `access_denied` | OAuth consent screen not published | Publish app or add test users |
| `auth/popup-closed-by-user` | User closed popup | Normal — handle gracefully in UI |
| Firebase 401 | Firebase API key or project ID mismatch | Verify VITE_FIREBASE_* vars match Firebase project |

---

## Security Notes

- **NEVER commit `.env.local` or `.env` to git**
- Mark `GOOGLE_CLIENT_SECRET` as "Sensitive" in Render to hide from logs
- Use separate OAuth credentials for dev vs production if possible
- Regenerate the client secret if it's ever exposed
- The frontend uses `credentials: "omit"` for status checks to avoid auth redirect loops
