/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_ENABLE_FIREBASE_AUTH?: string;
  readonly VITE_ENABLE_FIREBASE_DIAGNOSTICS?: string;
  readonly VITE_FIRESTORE_FORCE_LONG_POLLING?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_SITE_URL?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_PORT?: string;
  readonly VITE_PY_API_URL?: string;
  readonly VITE_PY_API_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __BACKEND_PUBLIC_URL__: string;
declare const __PY_API_PUBLIC_URL__: string;
declare const __SITE_URL__: string;
