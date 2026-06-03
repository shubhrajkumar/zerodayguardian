import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import ErrorBoundary from "./components/ErrorBoundary";
import { applyThemeToDocument, getStoredTheme } from "./lib/theme";

// ── Critical path: sync theme application to prevent FOUC ──
applyThemeToDocument(getStoredTheme());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);

// ── Deferred: non-critical modules loaded after first paint ──
const deferWork = (fn: () => void) => {
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(fn, { timeout: 5000 });
  } else {
    setTimeout(fn, 1);
  }
};

deferWork(() => {
  // Sentry: lazy-loaded, only needed for error tracking
  import("./instrument").catch(() => undefined);

  // Firebase: lazy-initialize (loads Firebase SDK as deferred chunk)
  import("./lib/firebase").then(({ initFirebase }) => {
    initFirebase().catch(() => undefined);
  }).catch(() => undefined);

  // Global diagnostics: error handlers
  import("./lib/runtimeDiagnostics").then(({ installGlobalDiagnostics }) => {
    installGlobalDiagnostics();
  }).catch(() => undefined);

  // Service Worker (PWA)
  if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    import("./lib/pushNotifications").then(({ registerPlatformServiceWorker }) => {
      registerPlatformServiceWorker().catch(() => undefined);
    }).catch(() => undefined);
  }
});
