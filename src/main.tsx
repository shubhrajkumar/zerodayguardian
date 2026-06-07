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
  // Sentry: deferred until after window.load to avoid blocking TTI.
  // requestIdleCallback fires immediately in headless Chrome (Lighthouse),
  // so we gate on window.load to ensure real user interactivity first.
  const loadSentry = () => import("./instrument").catch(() => undefined);
  if (typeof window !== "undefined" && document.readyState !== "complete") {
    window.addEventListener("load", loadSentry, { once: true });
  } else {
    loadSentry();
  }

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
