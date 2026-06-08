/**
 * App — Minimal critical-path shell.
 *
 * Only contains providers that must be available BEFORE first paint:
 * - QueryClientProvider (data fetching)
 * - HelmetProvider (SEO)
 * - ErrorBoundary (crash isolation)
 * - AuthProvider (auth state)
 *
 * Everything else (routing, context providers, UI components) lives in
 * the lazy-loaded AppShell.tsx to keep the critical JS bundle small.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, lazy } from "react";
import { HelmetProvider } from "react-helmet-async";
import { SpeedInsights } from "@vercel/speed-insights/react";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider } from "./context/AuthContext";

// ── Lazy-load the entire app shell (providers, routing, components) ──
const AppShell = lazy(() => import("./AppShell"));

const shouldRetryRequest = (failureCount: number, error: unknown) => {
  const status = Number((error as { status?: number } | null)?.status || 0);
  if ([400, 401, 403, 404, 409, 422].includes(status)) return false;
  return failureCount < 3;
};

const retryDelay = (attemptIndex: number) => Math.min(800 * 2 ** attemptIndex, 8_000);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: shouldRetryRequest,
      retryDelay,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: true,
      networkMode: "online",
    },
    mutations: {
      retry: (failureCount, error) => shouldRetryRequest(failureCount, error),
      retryDelay,
      networkMode: "online",
    },
  },
});

/** Minimal loading shell — matches final layout dimensions to prevent CLS */
const AppLoadingShell = () => (
  <div
    className="relative flex min-h-screen flex-col overflow-x-hidden"
    style={{ backgroundColor: "var(--theme-bg)" }}
  >
    {/* Placeholder for fixed navbar (z-50, h-16) to reserve space */}
    <div className="fixed left-0 right-0 top-0 z-50 h-16" style={{ borderBottom: "1px solid var(--theme-border)", backgroundColor: "color-mix(in srgb, var(--theme-bg) 92%, transparent)" }} />
    {/* Main content area with pt-16 to account for navbar, matching Layout.tsx */}
    <main className="relative z-10 min-w-0 flex-1 pt-16">
      <div className="container mx-auto flex flex-1 items-center justify-center px-4 py-16">
        <div className="text-center">
          <div className="spinner-cyber mx-auto mb-4" />
          <p className="terminal-font text-[11px] uppercase tracking-[0.24em]" style={{ color: "var(--theme-text-dim)" }}>
            Loading workspace...
          </p>
        </div>
      </div>
    </main>
    {/* Placeholder for footer — reserve space without text to prevent CLS */}
    <div className="relative z-10" style={{ borderTop: "1px solid var(--theme-border)" }}>
      <div className="container mx-auto px-4 py-10" aria-hidden="true" />
    </div>
  </div>
);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <ErrorBoundary>
          <AuthProvider>
            <Suspense fallback={<AppLoadingShell />}>
              <AppShell />
            </Suspense>
          </AuthProvider>
        </ErrorBoundary>
      </HelmetProvider>
      <SpeedInsights />
    </QueryClientProvider>
  );
}
