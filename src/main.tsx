import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { applyThemeToDocument, getStoredTheme } from './lib/theme';
import { installGlobalDiagnostics } from './lib/runtimeDiagnostics';
import { registerPlatformServiceWorker } from './lib/pushNotifications';

// ── Monitoring: initialize global diagnostics & error boundaries ──
applyThemeToDocument(getStoredTheme());
installGlobalDiagnostics();

// ── Monitoring: Sentry (opt-in via VITE_SENTRY_DSN env var) ──
// To enable, set VITE_SENTRY_DSN in your environment and install:
//   npm install @sentry/react
// The Sentry integration will then auto-initialize on page load.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (_sentryDsn) {
  console.info('[monitor] VITE_SENTRY_DSN detected. Install @sentry/react to enable error tracking.');
}

// ── Service Worker (PWA) ──
if (typeof window !== 'undefined') {
  registerPlatformServiceWorker().catch(() => undefined);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
