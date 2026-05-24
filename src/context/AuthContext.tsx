import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiGetJson, apiPostJson, bootstrapAuthSession, clearAuthState, setStoredAuthState } from "@/lib/apiClient";

const MOCK_AUTH_KEY = "zdg_mock_auth";
const MOCK_USER: AuthUser = {
  id: "mock-user-1",
  name: "Test Guardian",
  email: "test@zerodayguardian.com",
  role: "user",
};

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
  isAuthenticated: boolean;
  isVerified: boolean;
  user: AuthUser | null;
  refreshAuth: (force?: boolean) => Promise<boolean>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  const syncAuthState = useCallback((nextUser: AuthUser | null) => {
    setUser(nextUser);
    if (!nextUser) clearAuthState();
    else setStoredAuthState({ isAuthenticated: true, user: nextUser, timestamp: Date.now() });
    setAuthState(nextUser ? "authenticated" : "unauthenticated");
    return Boolean(nextUser);
  }, []);

  const refreshAuth = useCallback(async () => {
    try {
      if (localStorage.getItem(MOCK_AUTH_KEY) === "true") {
        syncAuthState(MOCK_USER);
        return true;
      }
    } catch {
      // localStorage unavailable (SSR / incognito) — fall through to real auth
    }

    const session = await bootstrapAuthSession();
    if (!session.ok) return syncAuthState(null);

    try {
      const payload = await apiGetJson<{ user?: AuthUser }>("/api/users/profile");
      return syncAuthState(payload.user ?? null);
    } catch {
      return syncAuthState(null);
    }
  }, [syncAuthState]);

  useEffect(() => {
    refreshAuth().catch(() => syncAuthState(null));
  }, [refreshAuth, syncAuthState]);

  const logout = useCallback(async () => {
    try {
      await apiPostJson("/api/auth/logout", {});
    } catch {
      // Ignore backend logout failures and still clear client auth state.
    }
    syncAuthState(null);
  }, [syncAuthState]);

  const value = useMemo<AuthContextValue>(
    () => ({
      authState,
      loading: authState === "loading",
      isAuthenticated: authState === "authenticated",
      isVerified: Boolean(user),
      user,
      refreshAuth,
      logout,
    }),
    [authState, logout, refreshAuth, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
