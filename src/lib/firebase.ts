// ── Lazy-loaded Firebase Module ──
// All static imports from firebase/* have been replaced with dynamic imports.
// This enables Vite to split the 452KB Firebase SDK into a deferred chunk
// that is only loaded when a Firebase-dependent feature is first accessed.
//
// Usage:
//   Call initFirebase() early in main.tsx (fire-and-forget).
//   The sync exports (firebaseApp, firebaseAuth, firestoreDb) start as null
//   and are populated after init completes. Consumers that need Firebase
//   should call initFirebase() first or handle null gracefully.

import type { FirebaseApp, FirebaseOptions } from "firebase/app";
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";

// ── Configuration (synchronous — no Firebase SDK imports) ──

const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

const missingConfigKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !String(value || "").trim())
  .map(([key]) => key);

export const isFirebaseConfigured = missingConfigKeys.length === 0;
export const firebaseConfigIssue =
  isFirebaseConfigured
    ? ""
    : `Missing Firebase config: ${missingConfigKeys.join(", ")}`;
export const isFirebaseDiagnosticsEnabled = String(import.meta.env.VITE_ENABLE_FIREBASE_DIAGNOSTICS || "")
  .trim()
  .toLowerCase() === "true";
const isFirebaseAuthEnabled = String(import.meta.env.VITE_ENABLE_FIREBASE_AUTH || "")
  .trim()
  .toLowerCase() === "true";
const shouldForceLongPolling = String(import.meta.env.VITE_FIRESTORE_FORCE_LONG_POLLING || "")
  .trim()
  .toLowerCase() === "true";

// ── Lazy-initialized sync exports (live bindings via export let) ──
// These start as null and are populated after initFirebase() resolves.
// Use initFirebase() before accessing these.

export let firebaseApp: FirebaseApp | null = null;
export let firebaseAuth: Auth | null = null;
export let firestoreDb: Firestore | null = null;

// ── Internal state ──

let _initPromise: Promise<void> | null = null;

const createFirebaseConfigError = () =>
  new Error(
    `[Firebase] ${firebaseConfigIssue || "Firebase configuration is incomplete."} ` +
      "Set the matching VITE_FIREBASE_* variables for this deployment and rebuild the frontend."
  );

// ── Initializer ──

export async function initFirebase(): Promise<void> {
  if (_initPromise) return _initPromise;
  if (!isFirebaseConfigured) {
    _initPromise = Promise.resolve();
    return _initPromise;
  }

  _initPromise = (async () => {
    // Dynamic imports — these create a separate vendor chunk in the build
    const { initializeApp, getApps, getApp } = await import("firebase/app");
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    firebaseApp = app;

    if (isFirebaseAuthEnabled) {
      const { getAuth } = await import("firebase/auth");
      firebaseAuth = getAuth(app);
    }

    if (!shouldForceLongPolling) {
      const { getFirestore } = await import("firebase/firestore");
      firestoreDb = getFirestore(app);
    } else {
      const { getFirestore, initializeFirestore } = await import("firebase/firestore");
      try {
        firestoreDb = initializeFirestore(app, {
          experimentalForceLongPolling: true,
        });
      } catch {
        firestoreDb = getFirestore(app);
      }
    }
  })();

  return _initPromise;
}

// ── Public API types ──

export type FirestoreConnectionTestResult = {
  ok: boolean;
  documentPath?: string;
  data?: Record<string, unknown>;
  reason?: string;
};

let firestoreConnectionTestPromise: Promise<FirestoreConnectionTestResult> | null = null;

const runFirestoreConnectionTestOnce = async (): Promise<FirestoreConnectionTestResult> => {
  try {
    if (!isFirebaseDiagnosticsEnabled) {
      return { ok: false, reason: "diagnostics_disabled" };
    }

    console.log("[Firebase] Starting initialization check...");
    await initFirebase();

    if (!isFirebaseConfigured || !firebaseApp || !firestoreDb) {
      throw createFirebaseConfigError();
    }

    console.log("[Firebase] App initialized successfully.");
    console.log("[Firestore] Instance created successfully.");

    const { doc, getDoc } = await import("firebase/firestore");
    const testRef = doc(firestoreDb, "connection_tests", "react_main_test");
    console.log("[Firestore] Reading probe document from connection_tests/react_main_test ...");
    const snapshot = await getDoc(testRef);

    console.log("[Firestore] Read successful.");
    console.log("[Firestore] Document path:", testRef.path);

    const data = snapshot.exists() ? snapshot.data() : { exists: false };
    if (!snapshot.exists()) {
      console.warn("[Firestore] Probe document does not exist, but Firestore is reachable.");
    } else {
      console.log("[Firestore] Document data:", data);
    }

    return { ok: true, documentPath: testRef.path, data };
  } catch (error: unknown) {
    console.error("[Firebase] Connection test failed.");

    const firebaseLikeError =
      typeof error === "object" && error !== null && "message" in error
        ? (error as { code?: string; message: string })
        : null;

    if (firebaseLikeError) {
      console.error("[Firebase] Error code:", firebaseLikeError.code || "unknown");
      console.error("[Firebase] Error message:", firebaseLikeError.message);

      if (firebaseLikeError.code === "permission-denied") {
        console.error("[Firestore] Permission denied. Check your Firestore security rules.");
      }
      if (firebaseLikeError.code === "invalid-api-key") {
        console.error("[Firebase] Invalid API key. Verify your VITE_FIREBASE_API_KEY value.");
      }
    } else {
      console.error(error);
    }

    return { ok: false, reason: firebaseLikeError?.code || "unknown_error" };
  }
};

export const runFirestoreConnectionTest = (): Promise<FirestoreConnectionTestResult> => {
  if (!firestoreConnectionTestPromise) {
    firestoreConnectionTestPromise = runFirestoreConnectionTestOnce();
  }
  return firestoreConnectionTestPromise;
};
