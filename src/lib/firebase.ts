import { FirebaseApp, FirebaseOptions, getApp, getApps, initializeApp } from "firebase/app";
import { Auth, getAuth } from "firebase/auth";
import { Firestore, doc, getDoc, getFirestore, initializeFirestore } from "firebase/firestore";

// Fill these Vite env vars in your local .env file:
// VITE_FIREBASE_API_KEY=
// VITE_FIREBASE_AUTH_DOMAIN=
// VITE_FIREBASE_PROJECT_ID=
// VITE_FIREBASE_APP_ID=
// VITE_FIREBASE_MESSAGING_SENDER_ID=
//
// This keeps Firebase config out of source code and makes it easy to swap
// between environments.
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

const createFirebaseConfigError = () =>
  new Error(
    `[Firebase] ${firebaseConfigIssue || "Firebase configuration is incomplete."} ` +
      "Set the matching VITE_FIREBASE_* variables for this deployment and rebuild the frontend."
  );

export const firebaseApp: FirebaseApp | null = isFirebaseConfigured
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

const createFirestoreDb = (app: FirebaseApp): Firestore => {
  if (!shouldForceLongPolling) return getFirestore(app);

  try {
    return initializeFirestore(app, {
      experimentalForceLongPolling: true,
    });
  } catch {
    return getFirestore(app);
  }
};

export const firebaseAuth: Auth | null = firebaseApp && isFirebaseAuthEnabled ? getAuth(firebaseApp) : null;
export const firestoreDb: Firestore | null = firebaseApp ? createFirestoreDb(firebaseApp) : null;

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
      return {
        ok: false,
        reason: "diagnostics_disabled",
      };
    }

    console.log("[Firebase] Starting initialization check...");

    if (!isFirebaseConfigured || !firebaseApp || !firestoreDb) {
      throw createFirebaseConfigError();
    }

    console.log("[Firebase] App initialized successfully.");
    console.log("[Firestore] Instance created successfully.");

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

    return {
      ok: true,
      documentPath: testRef.path,
      data,
    };
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

    return {
      ok: false,
      reason: firebaseLikeError?.code || "unknown_error",
    };
  }
};

export const runFirestoreConnectionTest = (): Promise<FirestoreConnectionTestResult> => {
  if (!firestoreConnectionTestPromise) {
    firestoreConnectionTestPromise = runFirestoreConnectionTestOnce();
  }
  return firestoreConnectionTestPromise;
};
