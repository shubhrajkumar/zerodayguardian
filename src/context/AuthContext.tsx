import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import {
  clearAuthState,
  getStoredAccessToken,
  setStoredAuthState,
} from "@/lib/apiClient";
import api from "@/lib/api";
import { firebaseAuth } from "@/lib/firebase";

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

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState("");

  const syncAuthState = useCallback((nextUser: AuthUser | null) => {
    setUser(nextUser);
    const storedToken = getStoredAccessToken();
    setToken(nextUser ? storedToken : "");
    if (!nextUser) clearAuthState();
    else setStoredAuthState({ isAuthenticated: true, user: nextUser, timestamp: Date.now(), accessToken: storedToken });
    setAuthState(nextUser ? "authenticated" : "unauthenticated");
    return Boolean(nextUser);
  }, []);

  const login = useCallback((payload: { accessToken: string; refreshToken: string; user: AuthUser }) => {
    localStorage.setItem("zdg_token", payload.accessToken);
    localStorage.setItem("zdg_refresh", payload.refreshToken);
    setStoredAuthState({ isAuthenticated: true, user: payload.user, timestamp: Date.now(), accessToken: payload.accessToken });
    setToken(payload.accessToken);
    setUser(payload.user);
    setAuthState("authenticated");
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

    if (firebaseAuth?.currentUser) {
      return syncAuthState(toFirebaseAuthUser(firebaseAuth.currentUser));
    }

    const storedToken = localStorage.getItem("zdg_token");
    const storedRefreshToken = localStorage.getItem("zdg_refresh");
    
    if (storedToken) {
      try {
        // Attempt to verify the token
        const response = await api.get<{ authenticated?: boolean; user?: AuthUser }>("/api/auth/verify");
        if (response.data.authenticated && response.data.user) {
          return syncAuthState(response.data.user);
        }
      } catch (error) {
        console.error("Token verification failed:", error);
      }
    }

    // If no valid token, try refreshing
    if (storedRefreshToken) {
      try {
        const response = await api.post<{ accessToken: string; refreshToken: string; user: AuthUser }>("/api/auth/refresh", { refreshToken: storedRefreshToken });
        if (response.data.accessToken) {
          localStorage.setItem("zdg_token", response.data.accessToken);
        }
        if (response.data.refreshToken) {
          localStorage.setItem("zdg_refresh", response.data.refreshToken);
        }
        if (response.data.user) {
          return syncAuthState(response.data.user);
        }
      } catch (error) {
        console.error("Refresh token failed:", error);
      }
    }

    return syncAuthState(null);
  }, [syncAuthState]);

  useEffect(() => {
    if (!firebaseAuth) {
      refreshAuth().catch(() => syncAuthState(null));
      return;
    }

    return onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      if (firebaseUser) {
        syncAuthState(toFirebaseAuthUser(firebaseUser));
        return;
      }
      refreshAuth().catch(() => syncAuthState(null));
    });
  }, [refreshAuth, syncAuthState]);

  const logout = useCallback(async () => {
    if (firebaseAuth?.currentUser) {
      try {
        await signOut(firebaseAuth);
      } catch {
        // Ignore Firebase logout failures and still clear local state.
      }
    }
    try {
      await api.post("/api/auth/logout", {});
    } catch {
      // Ignore backend logout failures and still clear client auth state.
    }
    localStorage.clear();
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
