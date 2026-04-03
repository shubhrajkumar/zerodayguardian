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
  registerPlatformServiceWorker().catch(() => undefined);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
