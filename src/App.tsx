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

/** Minimal loading shell while AppShell chunk loads */
const AppLoadingShell = () => (
  <div
    className="flex min-h-screen items-center justify-center"
    style={{ backgroundColor: "var(--theme-bg)" }}
  >
    <div className="text-center">
      <div className="spinner-cyber mx-auto mb-4" />
      <p className="terminal-font text-[11px] uppercase tracking-[0.24em]" style={{ color: "var(--theme-text-dim)" }}>
        Loading workspace...
      </p>
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
    </QueryClientProvider>
  );
}
