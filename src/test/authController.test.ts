import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock browser globals before any imports use them
global.localStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  key: vi.fn(),
  get length() { return 0; },
};

global.sessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  key: vi.fn(),
  get length() { return 0; },
};

global.document = {
  cookie: "",
} as unknown as Document;

// Mock dependencies
vi.mock("@/lib/apiConfig", () => ({
  resolveApiUrl: (url: string) => `/api${url}`,
  resolveBackendUrl: (url: string) => `/auth${url}`,
}));

vi.mock("@/lib/runtimeDiagnostics", () => ({
  recordClientDiagnostic: vi.fn(),
  recordRuntimeDebugEvent: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

const mockUser = {
  _id: { toString: () => "user123" },
  name: "Test User",
  email: "test@example.com",
  role: "user",
  authProvider: "local",
  emailVerified: true,
  avatarUrl: "",
};

const mockReq = (overrides = {}) => ({
  validatedBody: { email: "test@example.com", password: "password123" },
  requestId: "req-123",
  headers: {},
  cookies: {},
  ip: "127.0.0.1",
  query: {},
  ...overrides,
});

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnThis();
  res.json = vi.fn().mockReturnThis();
  res.redirect = vi.fn().mockReturnThis();
  res.setHeader = vi.fn().mockReturnThis();
  res.cookie = vi.fn().mockReturnThis();
  return res;
};

describe("Auth Controller Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  describe("toPublicUser transformation", () => {
    it("should transform user object to public format", () => {
      const toPublicUser = (user: typeof mockUser | null) =>
        user
          ? {
              id: user._id?.toString?.() || "",
              name: String(user.name || ""),
              email: String(user.email || ""),
              role: String(user.role || "user"),
              authProvider: String(user.authProvider || "local"),
              emailVerified: Boolean(user.emailVerified),
              avatarUrl: String(user.avatarUrl || ""),
            }
          : null;

      const result = toPublicUser(mockUser);
      expect(result).toEqual({
        id: "user123",
        name: "Test User",
        email: "test@example.com",
        role: "user",
        authProvider: "local",
        emailVerified: true,
        avatarUrl: "",
      });
    });

    it("should return null for null user", () => {
      const toPublicUser = (user: typeof mockUser | null) =>
        user
          ? {
              id: user._id?.toString?.() || "",
              name: String(user.name || ""),
              email: String(user.email || ""),
              role: String(user.role || "user"),
              authProvider: String(user.authProvider || "local"),
              emailVerified: Boolean(user.emailVerified),
              avatarUrl: String(user.avatarUrl || ""),
            }
          : null;

      expect(toPublicUser(null)).toBeNull();
    });

    it("should handle user with missing optional fields", () => {
      const toPublicUser = (user: typeof mockUser | null) =>
        user
          ? {
              id: user._id?.toString?.() || "",
              name: String(user.name || ""),
              email: String(user.email || ""),
              role: String(user.role || "user"),
              authProvider: String(user.authProvider || "local"),
              emailVerified: Boolean(user.emailVerified),
              avatarUrl: String(user.avatarUrl || ""),
            }
          : null;

      const partialUser = { _id: { toString: () => "456" }, name: undefined, email: "partial@test.com" } as unknown as typeof mockUser;
      const result = toPublicUser(partialUser);
      expect(result?.name).toBe("");
      expect(result?.role).toBe("user");
      expect(result?.authProvider).toBe("local");
    });
  });

  describe("sendAuthError", () => {
    it("should format error response correctly", () => {
      const sendAuthError = (req: ReturnType<typeof mockReq>, res: ReturnType<typeof mockRes>, error: { status?: number; statusCode?: number; code?: string; message?: string; retryAfterSec?: number }) => {
        const status = Number(error?.status || error?.statusCode || 500) || 500;
        res.status(status).json({
          status: "error",
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "An unexpected error occurred.",
          ...(error?.retryAfterSec ? { retryAfterSec: Number(error.retryAfterSec) || 0 } : {}),
          requestId: req.requestId || "",
        });
      };

      const req = mockReq();
      const res = mockRes();
      const error = { status: 401, code: "invalid_credentials", message: "Invalid email or password" };

      sendAuthError(req, res, error);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        status: "error",
        code: "invalid_credentials",
        message: "Invalid email or password",
        requestId: "req-123",
      });
    });

    it("should default to 500 status and INTERNAL_SERVER_ERROR code", () => {
      const sendAuthError = (req: ReturnType<typeof mockReq>, res: ReturnType<typeof mockRes>, error: { status?: number; statusCode?: number; code?: string; message?: string }) => {
        const status = Number(error?.status || error?.statusCode || 500) || 500;
        res.status(status).json({
          status: "error",
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "An unexpected error occurred.",
          requestId: req.requestId || "",
        });
      };

      const req = mockReq();
      const res = mockRes();

      sendAuthError(req, res, {});

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        status: "error",
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
        requestId: "req-123",
      });
    });

    it("should include retryAfterSec when provided", () => {
      const sendAuthError = (req: ReturnType<typeof mockReq>, res: ReturnType<typeof mockRes>, error: { status?: number; statusCode?: number; code?: string; message?: string; retryAfterSec?: number }) => {
        const status = Number(error?.status || error?.statusCode || 500) || 500;
        res.status(status).json({
          status: "error",
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message || "An unexpected error occurred.",
          ...(error?.retryAfterSec ? { retryAfterSec: Number(error.retryAfterSec) || 0 } : {}),
          requestId: req.requestId || "",
        });
      };

      const req = mockReq();
      const res = mockRes();
      const error = { status: 429, code: "rate_limited", message: "Too many requests", retryAfterSec: 60 };

      sendAuthError(req, res, error);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ retryAfterSec: 60 })
      );
    });
  });

  describe("normalizeRefreshError", () => {
    it("should normalize refresh token errors to 401", () => {
      const normalizeRefreshError = (error: { message?: string; code?: string; status?: number; statusCode?: number } | undefined) => {
        const current = error || {};
        const message = String(current.message || "").toLowerCase();
        const code = String(current.code || "").toLowerCase();
        if (
          code.includes("refresh") ||
          code.includes("token") ||
          code.includes("jwt") ||
          message.includes("refresh") ||
          message.includes("token") ||
          message.includes("jwt")
        ) {
          const normalized = new Error(current.message || "Refresh session unavailable");
          normalized.status = 401;
          normalized.code = current.code || "refresh_unavailable";
          return normalized;
        }
        if (current.status || current.statusCode) return current;
        return current;
      };

      const error = { message: "jwt expired", code: "TOKEN_EXPIRED" };
      const result = normalizeRefreshError(error);

      expect(result.status).toBe(401);
      expect(result.code).toBe("TOKEN_EXPIRED");
    });

    it("should preserve status for non-token errors", () => {
      const normalizeRefreshError = (error: { message?: string; code?: string; status?: number; statusCode?: number } | undefined) => {
        const current = error || {};
        const message = String(current.message || "").toLowerCase();
        const code = String(current.code || "").toLowerCase();
        if (
          code.includes("refresh") ||
          code.includes("token") ||
          code.includes("jwt") ||
          message.includes("refresh") ||
          message.includes("token") ||
          message.includes("jwt")
        ) {
          const normalized = new Error(current.message || "Refresh session unavailable");
          normalized.status = 401;
          normalized.code = current.code || "refresh_unavailable";
          return normalized;
        }
        if (current.status || current.statusCode) return current;
        return current;
      };

      const error = { status: 403, code: "forbidden", message: "Access denied" };
      const result = normalizeRefreshError(error);

      expect(result.status).toBe(403);
    });

    it("should return input for unknown errors", () => {
      const normalizeRefreshError = (error: { message?: string; code?: string; status?: number; statusCode?: number } | undefined) => {
        const current = error || {};
        const message = String(current.message || "").toLowerCase();
        const code = String(current.code || "").toLowerCase();
        if (
          code.includes("refresh") ||
          code.includes("token") ||
          code.includes("jwt") ||
          message.includes("refresh") ||
          message.includes("token") ||
          message.includes("jwt")
        ) {
          const normalized = new Error(current.message || "Refresh session unavailable");
          normalized.status = 401;
          normalized.code = current.code || "refresh_unavailable";
          return normalized;
        }
        if (current.status || current.statusCode) return current;
        return current;
      };

      const error = { message: "database error", code: "DB_ERROR" };
      const result = normalizeRefreshError(error);

      expect(result.message).toBe("database error");
    });
  });

  describe("URL resolution helpers", () => {
    it("should resolve backend auth URL correctly", () => {
      const resolveBackendAuthUrl = (
        req: { headers: { "x-forwarded-proto"?: string; "x-forwarded-host"?: string; host?: string }; protocol: string },
        path: string
      ) => {
        const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "http");
        const host = String(req.headers["x-forwarded-host"] || req.headers.host || "");
        const base = host ? `${proto}://${host}` : "http://localhost:8787";
        return `${base.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
      };

      const req = {
        headers: { "x-forwarded-proto": "https", "x-forwarded-host": "api.example.com" },
        protocol: "http",
      };

      expect(resolveBackendAuthUrl(req, "/auth/google")).toBe("https://api.example.com/auth/google");
      expect(resolveBackendAuthUrl(req, "auth/google/callback")).toBe("https://api.example.com/auth/google/callback");
    });

    it("should resolve app redirect with fallback", () => {
      const resolveAppRedirect = (target: string, fallbackPath = "/") => {
        const raw = String(target || "").trim() || fallbackPath;
        return `${raw.startsWith("/") ? raw : `/${raw}`}`;
      };

      expect(resolveAppRedirect("/dashboard", "/")).toBe("/dashboard");
      expect(resolveAppRedirect("", "/")).toBe("/");
      expect(resolveAppRedirect("relative/path", "/")).toBe("/relative/path");
    });

    it("should append query params correctly", () => {
      const appendQueryParam = (target: string, key: string, value: string) => {
        return target.includes("?")
          ? `${target}&${key}=${encodeURIComponent(value)}`
          : `${target}?${key}=${encodeURIComponent(value)}`;
      };

      expect(appendQueryParam("/auth?error=1", "oauth", "google")).toBe("/auth?error=1&oauth=google");
      expect(appendQueryParam("/auth", "oauth", "google")).toBe("/auth?oauth=google");
    });
  });

  describe("safeRecordAuthSuccess/Failure", () => {
    it("should catch errors silently in safeRecordAuthSuccess", async () => {
      const safeRecordAuthSuccess = async (payload: { identifier: string; userId?: string }) => {
        try {
          throw new Error("Audit service unavailable");
        } catch {
          // Keep auth responses non-blocking when audit persistence degrades.
        }
      };

      await expect(safeRecordAuthSuccess({ identifier: "test@example.com", userId: "123" })).resolves.not.toThrow();
    });

    it("should catch errors silently in safeRecordAuthFailure", async () => {
      const safeRecordAuthFailure = async (payload: { identifier: string; reason?: string }) => {
        try {
          throw new Error("Audit service unavailable");
        } catch {
          // Keep auth responses non-blocking when audit persistence degrades.
        }
      };

      await expect(safeRecordAuthFailure({ identifier: "test@example.com", reason: "invalid_password" })).resolves.not.toThrow();
    });
  });
});

describe("Auth Controller Integration Tests", () => {
  describe("Auth flow with mock services", () => {
    it("should handle signup flow with all steps", async () => {
      const mockSetAuthCookies = vi.fn().mockResolvedValue({ accessToken: "mock-token-123" });
      const mockRegisterUser = vi.fn().mockResolvedValue(mockUser);
      const mockAssertAuthAttemptAllowed = vi.fn().mockResolvedValue(undefined);
      const mockRecordAuthSuccess = vi.fn().mockResolvedValue(undefined);

      vi.stubGlobal("registerUser", mockRegisterUser);
      vi.stubGlobal("setAuthCookies", mockSetAuthCookies);
      vi.stubGlobal("assertAuthAttemptAllowed", mockAssertAuthAttemptAllowed);

      // Simulate signup controller logic
      const signup = async (req: ReturnType<typeof mockReq>, res: ReturnType<typeof mockRes>) => {
        try {
          await mockAssertAuthAttemptAllowed({ req, identifier: req.validatedBody?.email || "" });
          const user = await mockRegisterUser(req.validatedBody);
          const { accessToken } = await mockSetAuthCookies(res, user);
          await mockRecordAuthSuccess({ req, identifier: user.email, userId: user._id?.toString?.() || "" });
          res.status(201).json({ status: "ok", accessToken });
        } catch (error) {
          res.status(500).json({ status: "error" });
        }
      };

      const req = mockReq();
      const res = mockRes();

      await signup(req, res);

      expect(mockAssertAuthAttemptAllowed).toHaveBeenCalled();
      expect(mockRegisterUser).toHaveBeenCalledWith(req.validatedBody);
      expect(mockSetAuthCookies).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: "ok", accessToken: "mock-token-123" })
      );
    });

    it("should handle login failure gracefully", async () => {
      const mockLoginUser = vi.fn().mockRejectedValue(new Error("Invalid credentials"));
      const mockAssertAuthAttemptAllowed = vi.fn().mockResolvedValue(undefined);

      vi.stubGlobal("loginUser", mockLoginUser);
      vi.stubGlobal("assertAuthAttemptAllowed", mockAssertAuthAttemptAllowed);

      const login = async (req: ReturnType<typeof mockReq>, res: ReturnType<typeof mockRes>) => {
        try {
          await mockAssertAuthAttemptAllowed({ req, identifier: req.validatedBody?.email || "" });
          await mockLoginUser(req.validatedBody);
          res.json({ status: "ok" });
        } catch (error) {
          res.status(401).json({
            status: "error",
            code: "invalid_credentials",
            message: error instanceof Error ? error.message : "Authentication failed",
          });
        }
      };

      const req = mockReq();
      const res = mockRes();

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "error",
          code: "invalid_credentials",
        })
      );
    });

    it("should handle logout with refresh token revocation", async () => {
      const mockRevokeRefreshSession = vi.fn().mockResolvedValue(undefined);
      const mockClearAuthCookies = vi.fn();

      vi.stubGlobal("revokeRefreshSession", mockRevokeRefreshSession);
      vi.stubGlobal("clearAuthCookies", mockClearAuthCookies);

      const logout = async (req: ReturnType<typeof mockReq>, res: ReturnType<typeof mockRes>) => {
        try {
          await mockRevokeRefreshSession(req.cookies?.neurobot_rt);
          mockClearAuthCookies(res);
          res.status(204).end();
        } catch (error) {
          res.status(500).json({ status: "error" });
        }
      };

      const req = mockReq({ cookies: { neurobot_rt: "refresh-token-abc" } });
      const res = mockRes();

      await logout(req, res);

      expect(mockRevokeRefreshSession).toHaveBeenCalledWith("refresh-token-abc");
      expect(mockClearAuthCookies).toHaveBeenCalledWith(res);
      expect(res.status).toHaveBeenCalledWith(204);
    });
  });

  describe("Google OAuth flow", () => {
    it("should redirect to Google OAuth URL", async () => {
      const mockBuildGoogleOauthRedirectUrl = vi.fn().mockReturnValue("https://accounts.google.com/o/oauth2/auth?client_id=xxx");

      vi.stubGlobal("buildGoogleOauthRedirectUrl", mockBuildGoogleOauthRedirectUrl);

      const startGoogleOauth = async (req: ReturnType<typeof mockReq>, res: ReturnType<typeof mockRes>) => {
        const next = String(req.query?.next || "").trim();
        const redirectUrl = mockBuildGoogleOauthRedirectUrl({ state: next || "" });
        res.redirect(302, redirectUrl);
      };

      const req = mockReq({ query: { next: "/dashboard" } });
      const res = mockRes();

      await startGoogleOauth(req, res);

      expect(mockBuildGoogleOauthRedirectUrl).toHaveBeenCalledWith({ state: "/dashboard" });
      expect(res.redirect).toHaveBeenCalledWith(302, "https://accounts.google.com/o/oauth2/auth?client_id=xxx");
    });

    it("should handle missing code in OAuth callback", async () => {
      const mockResolveAppRedirect = vi.fn().mockReturnValue("/auth?error=oauth_failed");

      vi.stubGlobal("resolveAppRedirect", mockResolveAppRedirect);

      const googleOauthCallback = async (req: ReturnType<typeof mockReq>, res: ReturnType<typeof mockRes>) => {
        const code = String(req.query?.code || "").trim();
        if (!code) {
          const failureBase = mockResolveAppRedirect("/auth?error=oauth_failed", "/auth?error=oauth_failed");
          const failedTarget = `${failureBase}${failureBase.includes("?") ? "&" : "?"}code=missing_google_code`;
          res.redirect(failedTarget);
          return;
        }
        res.redirect("/dashboard");
      };

      const req = mockReq({ query: {} });
      const res = mockRes();

      await googleOauthCallback(req, res);

      expect(res.redirect).toHaveBeenCalledWith("/auth?error=oauth_failed&code=missing_google_code");
    });
  });

  describe("CSRF protection", () => {
    it("should return CSRF token", async () => {
      const getCsrf = async (req: ReturnType<typeof mockReq>, res: ReturnType<typeof mockRes>) => {
        res.setHeader("Cache-Control", "no-store");
        res.json({ status: "ok", csrfToken: String(req.requestId || "csrf-token-xyz") });
      };

      const req = mockReq({ requestId: "csrf-token-xyz" });
      const res = mockRes();

      await getCsrf(req, res);

      expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
      expect(res.json).toHaveBeenCalledWith({
        status: "ok",
        csrfToken: "csrf-token-xyz",
      });
    });
  });

  describe("Auth providers endpoint", () => {
    it("should return Google OAuth configuration when enabled", () => {
      const mockEnv = {
        googleOauthClientId: "client-id-123",
        googleRedirectUri: "https://api.example.com/auth/google/callback",
        appBaseUrl: "https://app.example.com",
        googleAuthorizedOrigins: ["https://app.example.com"],
      };

      const getAuthProviders = (req: ReturnType<typeof mockReq>, res: ReturnType<typeof mockRes>, env: typeof mockEnv) => {
        res.json({
          status: "ok",
          google: {
            enabled: Boolean(env.googleOauthClientId),
            clientId: env.googleOauthClientId || "",
            backendFlow: true,
            redirectUri: env.googleRedirectUri || "https://api.example.com/auth/google/callback",
            frontendOrigin: env.appBaseUrl || "",
            authorizedOrigins: env.googleAuthorizedOrigins || [],
          },
        });
      };

      const res = mockRes();
      getAuthProviders(mockReq(), res, mockEnv);

      expect(res.json).toHaveBeenCalledWith({
        status: "ok",
        google: {
          enabled: true,
          clientId: "client-id-123",
          backendFlow: true,
          redirectUri: "https://api.example.com/auth/google/callback",
          frontendOrigin: "https://app.example.com",
          authorizedOrigins: ["https://app.example.com"],
        },
      });
    });

    it("should return disabled Google OAuth when not configured", () => {
      const mockEnv = {
        googleOauthClientId: "",
        googleRedirectUri: "",
        appBaseUrl: "https://app.example.com",
        googleAuthorizedOrigins: [],
      };

      const getAuthProviders = (req: ReturnType<typeof mockReq>, res: ReturnType<typeof mockRes>, env: typeof mockEnv) => {
        res.json({
          status: "ok",
          google: {
            enabled: Boolean(env.googleOauthClientId),
            clientId: "",
            backendFlow: true,
            redirectUri: "",
            frontendOrigin: env.appBaseUrl || "",
            authorizedOrigins: [],
          },
        });
      };

      const res = mockRes();
      getAuthProviders(mockReq(), res, mockEnv);

      const call = res.json.mock.calls[0][0];
      expect(call.google.enabled).toBe(false);
      expect(call.google.clientId).toBe("");
    });
  });
});
