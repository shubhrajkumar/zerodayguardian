import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import {
  clearAuthState,
  getStoredAccessToken,
  setStoredAuthState,
  getStoredAuthState,
  bootstrapAuthSession,
} from "@/lib/apiClient";
import api from "@/lib/api";
import { firebaseAuth } from "@/lib/firebase";

// MOCK_AUTH removed for production — all auth flows go through Firebase + backend API

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

// checkMockAuth removed for production — no mock auth path
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
    // 1. Try Firebase currentUser (fast path)
    if (firebaseAuth?.currentUser) {
      return syncAuthState(toFirebaseAuthUser(firebaseAuth.currentUser));
    }

    // 2. Try bootstrapAuthSession from apiClient (handles token verify + refresh)
    try {
      const result = await bootstrapAuthSession();
      if (result.ok) {
        // Restore user from cached state (bootstrapAuthSession writes it)
        const cachedUser = restoreCachedUser();
        if (cachedUser) return syncAuthState(cachedUser);
        // fall through to token check below
      }
    } catch {
      // bootstrap failed, try direct token check
    }

    // 3. Direct token check
    const storedToken = localStorage.getItem("zdg_token");
    const storedRefreshToken = localStorage.getItem("zdg_refresh");

    if (storedToken && storedToken.length > 10) {
      try {
        const response = await api.get<{ authenticated?: boolean; user?: AuthUser }>("/api/auth/verify", {
          timeout: 8000,
        });
        if (response.data.authenticated && response.data.user) {
          return syncAuthState(response.data.user);
        }
      } catch {
        // token verify failed, try refresh
      }
    }

    // 4. Try refresh token
    if (storedRefreshToken) {
      try {
        const response = await api.post<{ accessToken: string; refreshToken: string; user: AuthUser }>(
          "/api/auth/refresh",
          { refreshToken: storedRefreshToken },
          { timeout: 8000 }
        );
        if (response.data.accessToken) {
          localStorage.setItem("zdg_token", response.data.accessToken);
        }
        if (response.data.refreshToken) {
          localStorage.setItem("zdg_refresh", response.data.refreshToken);
        }
        if (response.data.user) {
          return syncAuthState(response.data.user);
        }
      } catch {
        // refresh failed
      }
    }

    // 5. Restore from cached auth state as last resort (allows offline viewing)
    const cachedUser = restoreCachedUser();
    if (cachedUser) return syncAuthState(cachedUser);

    return syncAuthState(null);
  }, [syncAuthState]);

  useEffect(() => {
    if (!firebaseAuth) {
      refreshAuth().catch(() => syncAuthState(null));
      return;
    }

    const unsub = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      if (firebaseUser) {
        syncAuthState(toFirebaseAuthUser(firebaseUser));
        return;
      }
      refreshAuth().catch(() => syncAuthState(null));
    });

    return unsub;
  }, [refreshAuth, syncAuthState]);

  const logout = useCallback(async () => {
    if (firebaseAuth?.currentUser) {
      try {
        await signOut(firebaseAuth);
      } catch {
        // Ignore Firebase logout failures
      }
    }
    try {
      await api.post("/api/auth/logout", {});
    } catch {
      // Ignore backend logout failures
    }
    try {
      localStorage.removeItem("zdg_token");
      localStorage.removeItem("zdg_refresh");
      // MOCK_AUTH_KEY removed for production
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
