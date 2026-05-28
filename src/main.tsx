// ── Sentry instrumentation: must be the very first import ──
import "./instrument";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initFirebase } from "./lib/firebase";
import { applyThemeToDocument, getStoredTheme } from "./lib/theme";
import { installGlobalDiagnostics } from "./lib/runtimeDiagnostics";
import { registerPlatformServiceWorker } from "./lib/pushNotifications";

// ── Monitoring: initialize global diagnostics & error boundaries ──
applyThemeToDocument(getStoredTheme());
installGlobalDiagnostics();

// ── Firebase: lazy-initialize (loads Firebase SDK as deferred chunk) ──
initFirebase().catch(() => undefined);

// ── Service Worker (PWA) ──
if (typeof window !== "undefined") {
  registerPlatformServiceWorker().catch(() => undefined);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
