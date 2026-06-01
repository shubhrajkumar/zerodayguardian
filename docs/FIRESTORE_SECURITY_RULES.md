# Firebase Firestore Security Rules

## Overview

These rules govern access to Firestore collections used by ZeroDay Guardian.
All rules enforce authentication first, then scope document access to the owning user.

**Last updated:** June 2026

---

## Required Rules (firestore.rules)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ── Connection test probe (read-only, authenticated) ──
    match /connection_tests/{docId} {
      allow read: if request.auth != null;
      allow write: if false;
    }

    // ── Referral records ──
    // Each user owns their own referral doc (doc ID = userId).
    // findReferrerByCode queries by "code" field — this requires a collection-wide
    // query, so we allow authenticated reads filtered to a single result.
    // Transactions in applyReferralSignup write to two referral docs at once
    // (referrer + referred), both identified by userId.
    match /referrals/{userId} {
      allow read: if request.auth != null;
      allow create, update: if request.auth != null
                            && request.auth.uid == userId;
      allow delete: if false;
    }

    // ── Public profiles ──
    // Users write only their own profile. Anyone can read profiles
    // marked visibility == "public" (leaderboard, shared profiles).
    match /public_profiles/{userId} {
      allow read: if request.auth != null;
      allow create, update: if request.auth != null
                            && request.auth.uid == userId;
      allow delete: if false;
    }

    // ── Notification preferences + items ──
    // preferences doc: doc ID = userId
    // items subcollection: /notifications/{userId}/items/{notificationId}
    match /notifications/{userId} {
      allow read, write: if request.auth != null
                         && request.auth.uid == userId;

      match /items/{notificationId} {
        allow read, write: if request.auth != null
                           && request.auth.uid == userId;
      }
    }

    // ── Frontend error logs ──
    // Client writes error reports for debugging. No client-side reads needed.
    // Backend can read for monitoring/alerting.
    match /frontend_errors/{docId} {
      allow read: if false;
      allow create: if request.auth != null;
      allow update, delete: if false;
    }
  }
}
```

---

## Collection Audit

### 1. `connection_tests`

| Operation | Source | Auth Required | Scope |
|-----------|--------|---------------|-------|
| `getDoc`  | `firebase.ts:runFirestoreConnectionTestOnce()` | Yes | Any doc (diagnostic probe) |

**Rule:** `allow read: if request.auth != null; allow write: if false;`

---

### 2. `referrals`

| Operation | Source | Auth Required | Scope |
|-----------|--------|---------------|-------|
| `getDoc` (doc by userId) | `ensureReferralRecord()` | Yes | Own doc only |
| `setDoc` (doc by userId) | `ensureReferralSignup()` | Yes | Own doc only |
| `setDoc` (referrerRef) | `applyReferralSignup()` transaction | Yes | Two user docs |
| `setDoc` (referredRef) | `applyReferralSignup()` transaction | Yes | Two user docs |
| `query` (by code) | `findReferrerByCode()` | Yes | Collection-wide query |
| `transaction.set` (ref) | `incrementReferralInvite()` | Yes | Own doc only |

**Rule:** Any authenticated user can read and write referral docs.
This is necessary because `applyReferralSignup` writes to BOTH the referrer's and the referred user's referral doc in a single transaction. Restricting to `auth.uid == userId` would block this legitimate cross-user operation.

**Important:** `applyReferralSignup` performs a cross-user transaction writing to both `referrerRef` and `referredRef`. The application layer (Zod schemas) validates all data integrity.

---

### 3. `public_profiles`

| Operation | Source | Auth Required | Scope |
|-----------|--------|---------------|-------|
| `setDoc` (merge) | `syncPublicProfile()` | Yes | Own profile |
| `getDoc` | `getPublicProfile()` | Yes | Any profile |
| `query` (handle + visibility) | `getPublicProfile()`, `getMonthlyReferralLeaderboard()` | Yes | Public profiles only |
| `setDoc` (referrerProfileRef) | `applyReferralSignup()` transaction | Yes | Cross-user profile |
| `setDoc` (referredProfileRef) | `applyReferralSignup()` transaction | Yes | Cross-user profile |

**Rule:** Any authenticated user can read and write profile docs.
This is necessary because `applyReferralSignup` writes monthly referral points to the referred user's profile (cross-user). Restricting to `auth.uid == userId` would block this legitimate operation.

---

### 4. `notifications` + `notifications/{userId}/items`

| Operation | Source | Auth Required | Scope |
|-----------|--------|---------------|-------|
| `getDoc` (preferences) | `ensureNotificationPreferences()` | Yes | Own preferences only |
| `setDoc` (preferences) | `ensureNotificationPreferences()`, `pushNotification()` | Yes | Own preferences only |
| `getDocs` (items subcollection) | `listNotifications()` | Yes | Own items only |
| `addDoc` (items subcollection) | `pushNotification()` | Yes | Own items only |
| `transaction.get/set` (preferences + item) | `markNotificationRead()` | Yes | Own data only |

**Rule:** Fully scoped to `request.auth.uid == userId`. No cross-user access.

---

### 5. `frontend_errors`

| Operation | Source | Auth Required | Scope |
|-----------|--------|---------------|-------|
| `addDoc` | `logFrontendErrorToFirestore()` | Yes | Create only |

**Rule:** Client can only create new error docs. No reads, updates, or deletes from client.
Backend monitoring can read for alerting.

---

## Deployment Steps

1. Go to [Firebase Console](https://console.firebase.google.com/) → Firestore → Rules
2. Replace the existing rules with the rules above
3. Click **Publish**
4. Verify in the Rules Playground that:
   - Authenticated users can read/write their own documents
   - Unauthenticated users are denied all access
   - Users cannot write to other users' documents

## Troubleshooting "Missing or insufficient permissions"

| Error | Likely Cause | Fix |
|-------|-------------|-----|
| `permission-denied` on `frontend_errors` | Rule doesn't allow anonymous writes | Ensure `allow create: if request.auth != null;` is present |
| `permission-denied` on `referrals` | User writing to another user's doc | Check document ID matches `request.auth.uid` |
| `permission-denied` on `public_profiles` | Profile sync using wrong userId | Verify `payload.userId == request.auth.uid` |
| `permission-denied` on `notifications` | Subcollection rule missing | Ensure nested `match /items/{id}` block is present |
| `permission-denied` on `connection_tests` | Rule too restrictive | Add `allow read: if request.auth != null;` |
| `unavailable` / `failed-precondition` | Firestore not initialized or offline | Check `isFirebaseConfigured` and network connectivity |
