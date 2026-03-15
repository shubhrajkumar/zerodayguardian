import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, getStoredAccessToken, clearStoredAccessToken } from "@/lib/apiClient";

type AuthState = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  authState: AuthState;
  isAuthenticated: boolean;
  refreshAuth: (force?: boolean) => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_REFRESH_DEBOUNCE_MS = 1200;
let authBootstrapPromise: Promise<boolean> | null = null;
let authBootstrapResult: boolean | null = null;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const inFlightRef = useRef<Promise<boolean> | null>(null);
  const lastCheckedRef = useRef(0);
  const initializedRef = useRef(false);

  const refreshAuth = useCallback(async (force = false) => {
    const token = getStoredAccessToken();
    if (!token) {
      setAuthState("unauthenticated");
      return false;
    }

    const now = Date.now();
    if (!force && now - lastCheckedRef.current < AUTH_REFRESH_DEBOUNCE_MS) {
      return authState === "authenticated";
    }

    if (inFlightRef.current) return inFlightRef.current;

    inFlightRef.current = (async () => {
      try {
        const response = await apiFetch("/api/auth/me");
        const ok = response.ok;
        if (!ok && response.status === 401) clearStoredAccessToken();
        setAuthState(ok ? "authenticated" : "unauthenticated");
        lastCheckedRef.current = Date.now();
        return ok;
      } catch {
        setAuthState("unauthenticated");
        return false;
      } finally {
        inFlightRef.current = null;
      }
    })();

    return inFlightRef.current;
  }, [authState]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    if (authBootstrapResult !== null) {
      setAuthState(authBootstrapResult ? "authenticated" : "unauthenticated");
      return;
    }
    if (!authBootstrapPromise) {
      authBootstrapPromise = refreshAuth(true)
        .then((ok) => {
          authBootstrapResult = ok;
          return ok;
        })
        .catch(() => {
          authBootstrapResult = false;
          return false;
        });
    }
    authBootstrapPromise.then((ok) => {
      setAuthState(ok ? "authenticated" : "unauthenticated");
    });
  }, [refreshAuth]);

  const value = useMemo<AuthContextValue>(
    () => ({
      authState,
      isAuthenticated: authState === "authenticated",
      refreshAuth,
    }),
    [authState, refreshAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
