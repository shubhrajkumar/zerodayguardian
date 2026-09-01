import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { clearAuthState } from "@/lib/apiClient";
import api from "@/lib/api";
import { firebaseAuth, initFirebase } from "@/lib/firebase";

type AuthState = "loading" | "authenticated" | "unauthenticated";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type AuthContextValue = {
  authState: AuthState;
  loading: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  isVerified: boolean;
  user: AuthUser | null;
  login: (payload: { accessToken: string; refreshToken: string; user: AuthUser }) => void;
  refreshAuth: (force?: boolean) => Promise<boolean>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Refresh backoff state ──
let lastRefreshAttempt = 0;
let refreshCooldownMs = 0;
const REFRESH_COOLDOWN_BASE = 2000;
const REFRESH_COOLDOWN_MAX = 30000;

/**
 * Fetch the authenticated user from the backend. The session lives in httpOnly
 * cookies — this is the single source of truth for auth state.
 */
const fetchMe = async (): Promise<AuthUser | null> => {
  try {
    const response = await api.get<{ authenticated?: boolean; user?: AuthUser; success?: boolean }>("/api/auth/me", {
      timeout: 8000,
    });
    if ((response.data.authenticated || response.data.success) && response.data.user) {
      const u = response.data.user;
      return {
        id: String(u.id || ""),
        name: String(u.name || "Guardian"),
        email: String(u.email || ""),
        role: String(u.role || "user"),
      };
    }
    return null;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const initAuthRef = useRef(false);

  const syncAuthState = useCallback((nextUser: AuthUser | null) => {
    setUser(nextUser);
    if (!nextUser) {
      clearAuthState();
    }
    setAuthState(nextUser ? "authenticated" : "unauthenticated");
    return Boolean(nextUser);
  }, []);

  const login = useCallback((payload: { accessToken: string; refreshToken: string; user: AuthUser }) => {
    // The backend sets the httpOnly session cookies on login — the tokens in the
    // response body are never persisted to localStorage.
    setUser(payload.user);
    setAuthState("authenticated");
  }, []);

  const refreshAuth = useCallback(async (): Promise<boolean> => {
    // Backoff: skip if we recently failed (exponential cooldown)
    const now = Date.now();
    if (now - lastRefreshAttempt < refreshCooldownMs) {
      return false;
    }
    lastRefreshAttempt = now;

    // 1. Single source of truth: verify the httpOnly cookie session
    const me = await fetchMe();
    if (me) {
      refreshCooldownMs = 0;
      return syncAuthState(me);
    }

    // 2. Silent cookie-based refresh, then re-check
    try {
      await api.post<{ status?: string }>("/api/auth/refresh", {}, { timeout: 10000 });
      const refreshedMe = await fetchMe();
      if (refreshedMe) {
        refreshCooldownMs = 0;
        return syncAuthState(refreshedMe);
      }
    } catch {
      // refresh failed — apply exponential backoff
      refreshCooldownMs = Math.min(
        refreshCooldownMs ? refreshCooldownMs * 2 : REFRESH_COOLDOWN_BASE,
        REFRESH_COOLDOWN_MAX,
      );
    }

    // 3. No valid session
    return syncAuthState(null);
  }, [syncAuthState]);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | null = null;

    (async () => {
      await initFirebase();

      if (cancelled) return;

      if (!firebaseAuth) {
        // No Firebase — verify the backend cookie session directly
        if (!initAuthRef.current) {
          initAuthRef.current = true;
          refreshAuth().catch(() => { /* silent fail */ });
        }
        return;
      }

      // Dynamic import of firebase/auth — keeps Firebase out of the main bundle
      const { onAuthStateChanged } = await import("firebase/auth");

      unsub = onAuthStateChanged(firebaseAuth, () => {
        if (initAuthRef.current) return;
        initAuthRef.current = true;
        // Firebase reflects Google sign-in/sign-out, but the session truth is
        // the backend cookie — re-verify via /api/auth/me
        refreshAuth().catch(() => { /* silent fail */ });
      });
    })();

    // Cleanup on unmount — properly unsubscribes from Firebase auth listener
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [refreshAuth]);

  const logout = useCallback(async () => {
    // Dynamic import of firebase/auth for signOut — keeps Firebase out of main bundle
    await initFirebase();
    if (firebaseAuth?.currentUser) {
      try {
        const { signOut } = await import("firebase/auth");
        await signOut(firebaseAuth);
      } catch {
        // Ignore Firebase logout failures
      }
    }
    try {
      await api.post("/api/auth/logout", {}, { timeout: 8000 });
    } catch {
      // Backend may reject with 403 CSRF if session expired — proceed with local cleanup
    }
    syncAuthState(null);
  }, [syncAuthState]);

  const value = useMemo<AuthContextValue>(
    () => ({
      authState,
      loading: authState === "loading",
      isLoading: authState === "loading",
      isAuthenticated: authState === "authenticated",
      isVerified: Boolean(user),
      user,
      login,
      refreshAuth,
      logout,
    }),
    [authState, login, logout, refreshAuth, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
