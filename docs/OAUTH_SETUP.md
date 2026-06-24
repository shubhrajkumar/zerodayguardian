# Google OAuth Setup Guide

## Overview

ZeroDay Guardian uses Google OAuth for authentication via two paths:
1. **Frontend (Firebase)**: Firebase Auth handles the popup/redirect flow for Google sign-in
2. **Backend (Express)**: Server-side OAuth code exchange for credential verification

## Current Credentials

| Field | Value |
|-------|-------|
| **Google Client ID** | `754043289403-5395lupd8t396uml1cuestusf99ve9gd.apps.googleusercontent.com` |
| **Google Client Secret** | ⚠️ Must be regenerated (see below) |
| **Authorized Origins** | `http://localhost:5173`, `https://zerodayguardian-delta.vercel.app` |
| **Authorized Redirect URIs** | Backend callback + Firebase handler |

---

## Step 1: Regenerate Client Secret

```text
1. Go to https://console.cloud.google.com/apis/credentials
2. Select your project
3. Find the OAuth 2.0 Client ID matching:
   754043289403-5395lupd8t396uml1cuestusf99ve9gd.apps.googleusercontent.com
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
VITE_GOOGLE_CLIENT_ID=754043289403-5395lupd8t396uml1cuestusf99ve9gd.apps.googleusercontent.com

# Backend
GOOGLE_CLIENT_ID=754043289403-5395lupd8t396uml1cuestusf99ve9gd.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=[paste-regenerated-secret-here]
GOOGLE_REDIRECT_URI=http://localhost:8787/auth/google/callback
ENABLE_GOOGLE_LOCALHOST=true
```

### 3b: Vercel (Frontend — Production)

| Variable | Value | Environment |
|----------|-------|-------------|
| `VITE_GOOGLE_CLIENT_ID` | `754043289403-...` | Production + Preview |
| `VITE_FIREBASE_API_KEY` | (existing) | Production + Preview |
| `VITE_FIREBASE_AUTH_DOMAIN` | (existing) | Production + Preview |
| `VITE_FIREBASE_PROJECT_ID` | (existing) | Production + Preview |

### 3c: Render (Backend — Production)

| Variable | Value | Sensitive |
|----------|-------|-----------|
| `GOOGLE_CLIENT_ID` | `754043289403-...` | No |
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
npm run dev:server  # backend on :3000

# 2. Open http://localhost:5173
# 3. Click "Sign in with Google"
# 4. Complete OAuth flow
# 5. Verify authenticated redirect
```

---

## Troubleshooting

| Error | Likely Cause | Fix |
|-------|-------------|-----|
| `redirect_uri_mismatch` | Callback URL doesn't match console config | Check Authorized Redirect URIs in Google Cloud Console — MUST match exactly, including trailing slash |
| `invalid_client` | Wrong or missing client secret | Regenerate secret in Google Cloud Console and update env vars |
| `access_denied` | OAuth consent screen not published | Publish app or add test users in OAuth consent screen settings |
| **`Access blocked: Authorization Error`** | Most common OAuth error. Caused by: (1) frontend domain not in Authorized JavaScript Origins, (2) consent screen in Testing mode without user as test user, (3) popup blocked by browser. | Step-by-step: (a) Add your frontend URL to Google Cloud Console > APIs & Services > Credentials > OAuth 2.0 Client > Authorized JavaScript Origins. (b) Add user's email as test user in OAuth consent screen. (c) Unblock pop-ups in browser. |
| **`auth/unauthorized-domain`** | Firebase Auth domain not in Authorized JavaScript Origins | Add the frontend domain to both: (1) Google Cloud Console OAuth client, AND (2) Firebase Console > Authentication > Settings > Authorized domains |
| `auth/popup-closed-by-user` | User closed popup | Normal — handle gracefully in UI |
| `auth/popup-blocked` | Browser blocked the popup | User must allow pop-ups for this site. Show a message telling them. |
| `auth/operation-not-supported-in-this-environment` | Sign-in initiated in a non-browser context (e.g., iframe, embedded webview) | Use redirect flow instead of popup, or switch to a standard browser |
| `auth/account-exists-with-different-credential` | Same email already used with a different sign-in method | User should sign in with the original method and link accounts |
| Firebase 401 | Firebase API key or project ID mismatch | Verify VITE_FIREBASE_* vars match Firebase project in Firebase Console |
| `google_auth_not_configured` (backend) | GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing on backend | Set both env vars on Render (or local .env). Required even though Firebase handles the popup. |
| `google_identity_invalid` (backend) | Backend failed to verify Firebase-issued ID token | Check that the GOOGLE_CLIENT_ID in the backend matches the one used by the Firebase project. They must be the same OAuth client. |

---

## Security Notes

- **NEVER commit `.env.local` or `.env` to git**
- Mark `GOOGLE_CLIENT_SECRET` as "Sensitive" in Render to hide from logs
- Use separate OAuth credentials for dev vs production if possible
- Regenerate the client secret if it's ever exposed
- The frontend uses `credentials: "omit"` for status checks to avoid auth redirect loops

## Complete Diagnostic Checklist

If "Continue with Google" shows an error, check each layer in order:

### Layer 1: Frontend Environment (.env.local / Vercel)
```bash
# Verify these Vite env vars are set at BUILD TIME:
VITE_FIREBASE_API_KEY       # Must be non-empty
VITE_FIREBASE_AUTH_DOMAIN   # Must match Firebase project
VITE_FIREBASE_PROJECT_ID    # Must match Firebase project
VITE_FIREBASE_APP_ID        # Must match Firebase project
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_ENABLE_FIREBASE_AUTH   # Must be exactly "true"
```

### Layer 2: Firebase Console
```text
1. Go to https://console.firebase.google.com/
2. Select project -> Authentication -> Sign-in method
3. Verify Google is ENABLED
4. Verify the Web client ID matches what's in env vars
5. Check Authorized domains include your frontend URL
```

### Layer 3: Google Cloud Console
```text
1. Go to https://console.cloud.google.com/apis/credentials
2. Find the OAuth 2.0 Client ID matching your client ID
3. Verify Authorized JavaScript Origins:
   - https://zerodayguardian-delta.vercel.app (production)
   - http://localhost:5173 (local dev)
4. Verify Authorized Redirect URIs:
   - https://zerodayguardian-backend.onrender.com/auth/google/callback (production)
   - http://localhost:8787/auth/google/callback (local dev)
5. Go to OAuth consent screen
6. Verify publishing status is "In production" OR your email is in Test users
```

### Layer 4: Backend Environment (Render)
```bash
# Verify these env vars are set on Render:
GOOGLE_CLIENT_ID       # Must match the Firebase project's OAuth client
GOOGLE_CLIENT_SECRET   # Must be the current, valid secret (regenerate if unsure)
```

### Layer 5: API Test
```bash
# Check backend provider status:
curl https://zerodayguardian-backend.onrender.com/api/auth/providers
# Expected: {"status":"ok","google":{"enabled":true,"clientId":"1567..."}}
```
