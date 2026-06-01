import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import {
  clearAuthState,
  getStoredAccessToken,
  setStoredAuthState,
  getStoredAuthState,
  bootstrapAuthSession,
} from "@/lib/apiClient";
import api from "@/lib/api";
import { firebaseAuth, initFirebase } from "@/lib/firebase";

// ── Mock Auth (dev/test only) ──
// Enable by setting localStorage.setItem("zdg_mock_auth", "true") then reload.
// Skipped entirely when zdg_mock_auth is not set, so there's zero production impact.

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
  token: string;
  login: (payload: { accessToken: string; refreshToken: string; user: AuthUser }) => void;
  refreshAuth: (force?: boolean) => Promise<boolean>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const toFirebaseAuthUser = (firebaseUser: FirebaseUser): AuthUser => ({
  id: firebaseUser.uid,
  name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Guardian",
  email: firebaseUser.email || "",
  role: "user",
});

/**
 * Restore user from cached auth state (written by apiClient on successful API auth).
 */
const restoreCachedUser = (): AuthUser | null => {
  try {
    const cachedAuth = getStoredAuthState();
    if (cachedAuth?.isAuthenticated && cachedAuth?.user) {
      const u = cachedAuth.user;
      return {
        id: String(u.id || u._id || ""),
        name: String(u.name || u.displayName || "Guardian"),
        email: String(u.email || ""),
        role: String(u.role || "user"),
      };
    }
  } catch {
    // ignore
  }
  return null;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState("");
  const initAuthRef = useRef(false);

  const syncAuthState = useCallback((nextUser: AuthUser | null) => {
    setUser(nextUser);
    const storedToken = getStoredAccessToken();
    setToken(nextUser ? storedToken : "");
    if (!nextUser) {
      clearAuthState();
    } else {
      setStoredAuthState({
        isAuthenticated: true,
        user: nextUser as unknown as Record<string, unknown>,
        timestamp: Date.now(),
        accessToken: storedToken,
      });
    }
    setAuthState(nextUser ? "authenticated" : "unauthenticated");
    return Boolean(nextUser);
  }, []);

  const login = useCallback((payload: { accessToken: string; refreshToken: string; user: AuthUser }) => {
    try {
      if (payload.accessToken) localStorage.setItem("zdg_token", payload.accessToken);
      if (payload.refreshToken) localStorage.setItem("zdg_refresh", payload.refreshToken);
    } catch {
      // storage unavailable
    }
    setStoredAuthState({
      isAuthenticated: true,
      user: payload.user as unknown as Record<string, unknown>,
      timestamp: Date.now(),
      accessToken: payload.accessToken,
    });
    setToken(payload.accessToken);
    setUser(payload.user);
    setAuthState("authenticated");
  }, []);

  const refreshAuth = useCallback(async (_force?: boolean): Promise<boolean> => {
    // 0. Mock auth bypass for local frontend testing (no backend required)
    try {
      if (localStorage.getItem("zdg_mock_auth") === "true") {
        const mockUser: AuthUser = {
          id: "mock-user-1",
          name: "Test Guardian",
          email: "test@zerodayguardian.com",
          role: "user",
        };
        localStorage.setItem("zdg_token", "mock_access_token_abc123");
        localStorage.setItem("zdg_refresh", "mock_refresh_token_xyz789");
        return syncAuthState(mockUser);
      }
    } catch {
      // localStorage unavailable
    }

    // 1. Try token verify first (silent — no toast, no redirect)
    const storedToken = localStorage.getItem("zdg_token");
    if (storedToken && storedToken.length > 10) {
      try {
        const response = await api.get<{ authenticated?: boolean; user?: AuthUser; success?: boolean }>("/api/auth/verify", {
          timeout: 8000,
        });
        if ((response.data.authenticated || response.data.success) && response.data.user) {
          return syncAuthState(response.data.user);
        }
      } catch {
        // token verify failed, try refresh silently
      }
    }

    // 2. Try silent refresh
    const storedRefreshToken = localStorage.getItem("zdg_refresh");
    if (storedRefreshToken) {
      try {
        const response = await api.post<{ accessToken?: string; user?: AuthUser; status?: string }>(
          "/api/auth/refresh",
          { refreshToken: storedRefreshToken },
          { timeout: 10000 }
        );
        if (response.data.accessToken) {
          localStorage.setItem("zdg_token", response.data.accessToken);
        }
        if (response.data.user) {
          return syncAuthState(response.data.user);
        }
        // If no user but got token, try getting user profile
        if (response.data.accessToken) {
          try {
            const userRes = await api.get<{ user?: AuthUser }>("/api/auth/me");
            if (userRes.data.user) {
              return syncAuthState(userRes.data.user);
            }
          } catch {
            // user fetch failed
          }
        }
      } catch {
        // refresh failed — only clear if BOTH verify AND refresh fail
      }
    }

    // 3. Try bootstrapAuthSession from apiClient
    try {
      const result = await bootstrapAuthSession();
      if (result.ok) {
        const cachedUser = restoreCachedUser();
        if (cachedUser) return syncAuthState(cachedUser);
      }
    } catch {
      // bootstrap failed
    }

    // 4. Try Firebase currentUser (fast path)
    await initFirebase();
    if (firebaseAuth?.currentUser) {
      return syncAuthState(toFirebaseAuthUser(firebaseAuth.currentUser));
    }

    // 5. Restore from cached auth state as last resort
    const cachedUser = restoreCachedUser();
    if (cachedUser) return syncAuthState(cachedUser);

    // 6. Clear only if ALL methods fail
    localStorage.removeItem("zdg_token");
    localStorage.removeItem("zdg_refresh");
    return syncAuthState(null);
  }, [syncAuthState]);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | null = null;

    (async () => {
      await initFirebase();

      if (cancelled) return;

      if (!firebaseAuth) {
        // Try silent auth refresh first — no loading gate
        if (!initAuthRef.current) {
          initAuthRef.current = true;
          refreshAuth().catch(() => { /* silent fail */ });
        }
        return;
      }

      // Dynamic import of firebase/auth — keeps Firebase out of the main bundle
      const { onAuthStateChanged } = await import("firebase/auth");

      unsub = onAuthStateChanged(firebaseAuth, (fbUser) => {
        if (fbUser) {
          initAuthRef.current = true;
          syncAuthState(toFirebaseAuthUser(fbUser as FirebaseUser));
          return;
        }
        // Silent refresh: only run if we haven't already done initial auth check
        if (!initAuthRef.current) {
          initAuthRef.current = true;
          refreshAuth().catch(() => { /* silent fail */ });
        }
      });
    })();

    // Cleanup on unmount — properly unsubscribes from Firebase auth listener
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [refreshAuth, syncAuthState]);

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
    try {
      localStorage.removeItem("zdg_token");
      localStorage.removeItem("zdg_refresh");
    } catch {
      // storage unavailable
    }
    clearAuthState();
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
      token,
      login,
      refreshAuth,
      logout,
    }),
    [authState, login, logout, refreshAuth, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
