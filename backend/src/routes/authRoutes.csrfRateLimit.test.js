// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ── Mock controller so the test exercises limiter wiring only ──────────
vi.mock("../controllers/authController.js", () => ({
  getCsrf: (_req, res) => res.json({ status: "ok", csrfToken: "test-token" }),
  getAuthStatus: (_req, res) =>
    res.json({ status: "ok", authenticated: false, user: null }),
  getAuthProviders: (_req, res) => res.json({ status: "ok" }),
  verifyAuth: (_req, res) => res.json({ status: "ok" }),
  forgotPassword: vi.fn(),
  googleLogin: vi.fn(),
  googleOauthCallback: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  refreshSession: vi.fn(),
  resetPasswordHandler: vi.fn(),
  signup: vi.fn(),
  startGoogleOauth: vi.fn(),
  verifyOtp: vi.fn(),
}));

// Middleware that would otherwise require env/DB for these GET routes.
vi.mock("../middleware/auth.mjs", () => ({
  requireAuth: (_req, _res, next) => next(),
}));
vi.mock("../middleware/validate.mjs", () => ({
  validateBody: () => (_req, _res, next) => next(),
}));
vi.mock("../middleware/csrf.mjs", () => ({
  requireCsrf: (_req, _res, next) => next(),
}));

let testApp;

beforeEach(async () => {
  vi.resetModules(); // Fresh router + fresh rate limiter stores per test
  const { default: router } = await import("./authRoutes.js");
  const app = express();
  app.use(express.json());
  app.use("/api/auth", router);
  testApp = app;
});

// Drive a route until it 429s, so the test does not hardcode env limits.
const driveUntilLimited = async (path, ceiling = 600) => {
  for (let i = 1; i <= ceiling; i += 1) {
    const res = await request(testApp).get(path);
    if (res.status === 429) return { hitAt: i, res };
  }
  throw new Error(`${path} was never rate-limited within ${ceiling} requests`);
};

describe("auth route rate limiting buckets", () => {
  it("keeps /csrf usable after the session limiter is exhausted", async () => {
    // Hammer the shared auth-session limiter (/status, /session, /verify,
    // /me, /refresh, /logout all draw from it) until it trips.
    const { res: limited } = await driveUntilLimited("/api/auth/status");
    expect(limited.body.code).toBe("auth_session_rate_limited");

    // Regression guard: /csrf used to share that bucket, so once polling
    // exhausted it, token issuance 429'd and every mutation broke.
    const csrf = await request(testApp).get("/api/auth/csrf").expect(200);
    expect(csrf.body.status).toBe("ok");
  });

  it("still rate-limits /csrf on its own dedicated bucket", async () => {
    const { res: limited } = await driveUntilLimited("/api/auth/csrf");

    expect(limited.body).toEqual(
      expect.objectContaining({
        status: "error",
        code: "csrf_rate_limited",
      })
    );
  });

  it("does not let /csrf traffic consume the session bucket", async () => {
    // Burn a batch of /csrf requests, then confirm /status is unaffected.
    for (let i = 0; i < 50; i += 1) {
      await request(testApp).get("/api/auth/csrf").expect(200);
    }

    const status = await request(testApp).get("/api/auth/status").expect(200);
    expect(status.body.authenticated).toBe(false);

    // And the session bucket should still have most of its budget left.
    expect(Number(status.headers["ratelimit-remaining"])).toBeGreaterThan(0);
  });
});
