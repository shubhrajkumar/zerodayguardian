import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { applyThemeToDocument, getStoredTheme } from './lib/theme';
import { installGlobalDiagnostics } from './lib/runtimeDiagnostics';
import { registerPlatformServiceWorker } from './lib/pushNotifications';

applyThemeToDocument(getStoredTheme());
installGlobalDiagnostics();

if (typeof window !== 'undefined') {
  const { protocol, hostname, port, pathname, search, hash } = window.location;
  const shouldCanonicalizeLocalhost = protocol === 'http:' && port === '8080' && hostname !== 'localhost';
  if (shouldCanonicalizeLocalhost) {
    window.location.replace(`http://localhost:8080${pathname}${search}${hash}`);
  }
  registerPlatformServiceWorker().catch(() => undefined);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
