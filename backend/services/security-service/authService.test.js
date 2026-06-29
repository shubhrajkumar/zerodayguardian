// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock env ───────────────────────────────────────────────────────────
// Must be shared so mutations in tests reflect in the module's `env` reference.
const mockEnv = {
  authEmailEnabled: true,
  authEmailUser: "noreply@zerodayguardian.com",
  authEmailAppPassword: "fake-app-password",
  authEmailFrom: "noreply@zerodayguardian.com",
  authEmailFromName: "ZeroDay Guardian Security",
  smtpHost: "smtp.gmail.com",
  smtpPort: 587,
  smtpSecure: false,
  smtpRequireTls: true,
  authOtpPreviewEnabled: false,
  appBaseUrl: "https://zerodayguardian-delta.vercel.app",
  backendPublicUrl: "",
  jwtSecret: "test-jwt-secret-that-is-at-least-32-chars!!",
  jwtIssuer: "test",
  jwtAudience: "test",
  googleOauthClientId: "",
  googleOauthClientSecret: "",
  nodeEnv: "test",
  port: 8787,
};

vi.mock("../../src/config/env.mjs", () => ({ env: mockEnv }));

// ── Mock logger ────────────────────────────────────────────────────────
const mockLogInfo = vi.fn();
const mockLogWarn = vi.fn();
vi.mock("../../src/utils/logger.mjs", () => ({
  logInfo: mockLogInfo,
  logWarn: mockLogWarn,
  logError: vi.fn(),
}));

// ── Mock security utils ────────────────────────────────────────────────
vi.mock("../../src/utils/security.mjs", () => ({
  sanitizeText: vi.fn((v) => String(v ?? "")),
  createBlindIndex: vi.fn((v, _salt) => String(v ?? "")),
  decryptSensitive: vi.fn((v) => v),
  encryptSensitive: vi.fn((v) => v),
}));

// ── Mock cookie policy ─────────────────────────────────────────────────
vi.mock("../../src/utils/cookiePolicy.mjs", () => ({
  buildCookieOptions: vi.fn(() => ({})),
}));

// ── Mock MongoDB ───────────────────────────────────────────────────────
const mockFindOne = vi.fn();
const mockUpdateOne = vi.fn();
const mockCollection = vi.fn(() => ({ findOne: mockFindOne, updateOne: mockUpdateOne }));

vi.mock("../../src/config/db.mjs", () => ({
  getDb: vi.fn(() => ({ collection: mockCollection })),
  getDbPoolStatus: vi.fn(() => ({ initialized: true, connected: true })),
}));

vi.mock("./authFallbackStore.mjs", () => ({
  getAuthFallbackCollection: vi.fn(),
}));

// ── Mock OTP service ───────────────────────────────────────────────────
const mockCreateOtp = vi.fn();
const mockSendOtpEmail = vi.fn();
const mockVerifyOtp = vi.fn();
const mockDeleteOtp = vi.fn();

vi.mock("../../src/services/otpService.mjs", () => ({
  createOtp: mockCreateOtp,
  sendOtpEmail: mockSendOtpEmail,
  verifyOtp: mockVerifyOtp,
  deleteOtp: mockDeleteOtp,
  peekOtp: vi.fn(),
  isMailConfigured: vi.fn(),
}));

// ── Mock bcrypt ────────────────────────────────────────────────────────
const mockBcryptHash = vi.fn();
const mockBcryptCompare = vi.fn();
vi.mock("bcryptjs", () => ({
  default: { hash: mockBcryptHash, compare: mockBcryptCompare },
  hash: mockBcryptHash,
  compare: mockBcryptCompare,
}));

// ── Mock other heavy imports (used by exported functions not under test) ─
vi.mock("jsonwebtoken", () => ({
  default: { sign: vi.fn(), verify: vi.fn() },
}));
vi.mock("google-auth-library", () => ({ OAuth2Client: vi.fn() }));
const mockObjectId = vi.fn((id) => ({ toString: () => String(id || "mock-id"), _bsontype: "ObjectId" }));
mockObjectId.isValid = vi.fn(() => true);
mockObjectId.createFromHexString = vi.fn();
mockObjectId.createFromTime = vi.fn();

vi.mock("mongodb", () => ({
  ObjectId: mockObjectId,
}));
vi.mock("nodemailer", () => ({ createTransport: vi.fn() }));

// ── Tests ──────────────────────────────────────────────────────────────
describe("sendResetOtp", () => {
  let sendResetOtp;
  const TEST_EMAIL = "test@example.com";
  const MOCK_USER = {
    _id: "abc123",
    email: TEST_EMAIL,
    name: "Test User",
    role: "user",
    emailVerified: true,
  };
  const MOCK_OTP = {
    otp: "482916",
    expiresAt: Date.now() + 600_000,
    expiresInMinutes: 10,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset env to defaults for each test
    Object.assign(mockEnv, {
      authEmailEnabled: true,
      authEmailUser: "noreply@zerodayguardian.com",
      authEmailAppPassword: "fake-app-password",
      authEmailFrom: "noreply@zerodayguardian.com",
      authEmailFromName: "ZeroDay Guardian Security",
      smtpHost: "smtp.gmail.com",
      smtpPort: 587,
      smtpSecure: false,
      smtpRequireTls: true,
      authOtpPreviewEnabled: false,
    });

    // Default mock behaviors
    mockFindOne.mockResolvedValue(MOCK_USER);
    mockCreateOtp.mockReturnValue(MOCK_OTP);
    mockBcryptHash.mockResolvedValue("hashed-otp-value");
    mockUpdateOne.mockResolvedValue({ acknowledged: true, modifiedCount: 1 });

    // Fresh import to clear module-level state (e.g. transporterPromise)
    vi.resetModules();
    const mod = await import("./authService.mjs");
    sendResetOtp = mod.sendResetOtp;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── 1. Preview mode when mail not configured ─────────────────────────
  it("returns preview fallback when mail is not configured and preview is enabled", async () => {
    mockEnv.authEmailEnabled = false;
    mockEnv.authOtpPreviewEnabled = true;

    const result = await sendResetOtp({ email: TEST_EMAIL });

    expect(result).toMatchObject({
      sent: false,
      delivery: "preview",
      expiresInMinutes: 10,
    });
    expect(result.destination).toContain("@");
    expect(result.message).toContain("not configured");

    // Should NOT have attempted to send email
    expect(mockSendOtpEmail).not.toHaveBeenCalled();

    // Should have logged the preview warning
    expect(mockLogWarn).toHaveBeenCalledWith(
      expect.stringContaining("not configured"),
      expect.objectContaining({ delivery: "preview" })
    );
  });

  // ── 2. Throws when mail not configured and preview disabled ──────────
  it("throws 503 when mail is not configured and preview is disabled", async () => {
    mockEnv.authEmailEnabled = false;
    mockEnv.authOtpPreviewEnabled = false;

    await expect(sendResetOtp({ email: TEST_EMAIL })).rejects.toThrow(/not configured/i);

    // Verify it's a 503 error
    await expect(sendResetOtp({ email: TEST_EMAIL })).rejects.toMatchObject({
      status: 503,
      code: "mail_not_configured",
    });
  });

  // ── 3. Throws 502 when SMTP times out ─────────────────────────────
  it("throws 502 when the SMTP timeout fires", async () => {
    mockSendOtpEmail.mockReturnValue(new Promise(() => {}));

    vi.useFakeTimers();

    const resultPromise = sendResetOtp({ email: TEST_EMAIL });

    // Advance time past the hard timeout (EMAIL_TIMEOUT_MS = 20000ms)
    await vi.advanceTimersByTimeAsync(21_000);

    await expect(resultPromise).rejects.toMatchObject({
      status: 502,
      code: "mail_delivery_failed",
    });

    expect(mockSendOtpEmail).toHaveBeenCalledWith(TEST_EMAIL, MOCK_OTP.otp, 10);
  });

  // ── 4. Throws 502 when SMTP send fails ─────────────────────────────
  it("throws 502 when SMTP email send fails", async () => {
    mockSendOtpEmail.mockRejectedValue(new Error("Connection refused by SMTP server"));

    await expect(sendResetOtp({ email: TEST_EMAIL })).rejects.toMatchObject({
      status: 502,
      code: "mail_delivery_failed",
    });
  });

  // ── 5. Throws 502 for various SMTP failure modes ───────────────────
  it("throws 502 for various SMTP failure modes", async () => {
    const errors = [
      new Error("connect ECONNREFUSED 127.0.0.1:587"),
      new Error("getaddrinfo ENOTFOUND smtp.gmail.com"),
      Object.assign(new Error("SMTP response timeout"), { code: "ETIMEDOUT" }),
      new Error("Invalid login credentials"),
    ];

    for (const error of errors) {
      mockSendOtpEmail.mockRejectedValue(error);
      await expect(sendResetOtp({ email: TEST_EMAIL })).rejects.toMatchObject({
        status: 502,
        code: "mail_delivery_failed",
      });
    }
  });

  // ── 7. Success when email sends ────────────────────────────────────
  it("returns success when SMTP email is sent successfully", async () => {
    mockSendOtpEmail.mockResolvedValue(undefined);

    const result = await sendResetOtp({ email: TEST_EMAIL });

    expect(result).toMatchObject({
      sent: true,
      delivery: "email",
      expiresInMinutes: 10,
    });
    expect(result.message).toContain("successfully");

    expect(mockSendOtpEmail).toHaveBeenCalledWith(TEST_EMAIL, MOCK_OTP.otp, 10);
  });

  // ── 8. Throws when user not found ──────────────────────────────────
  it("throws 404 when the user is not found", async () => {
    mockFindOne.mockResolvedValue(null);

    await expect(sendResetOtp({ email: TEST_EMAIL })).rejects.toThrow(/not found/i);
    await expect(sendResetOtp({ email: TEST_EMAIL })).rejects.toMatchObject({
      status: 404,
      code: "user_not_found",
    });

    // Should NOT have created an OTP or attempted to send email
    expect(mockCreateOtp).not.toHaveBeenCalled();
    expect(mockSendOtpEmail).not.toHaveBeenCalled();
  });

  // ── 9. Normalizes email before lookup ──────────────────────────────
  it("normalizes email before database lookup and OTP creation", async () => {
    mockSendOtpEmail.mockResolvedValue(undefined);

    const result = await sendResetOtp({ email: "  Test@Example.COM  " });

    expect(result.sent).toBe(true);

    // The mocked sanitizeText returns the input as-is, but normalizeEmail
    // also calls .trim().toLowerCase() — so the lookup should use "test@example.com"
    // The mockFindOne will have been called with this normalized email
    expect(mockCreateOtp).toHaveBeenCalledWith("test@example.com");
    expect(mockSendOtpEmail).toHaveBeenCalledWith("test@example.com", MOCK_OTP.otp, 10);
  });

  // ── 10. OTP is persisted to MongoDB as bcrypt hash ──────────────────
  it("persists the OTP bcrypt hash to MongoDB", async () => {
    mockSendOtpEmail.mockResolvedValue(undefined);

    await sendResetOtp({ email: TEST_EMAIL });

    expect(mockBcryptHash).toHaveBeenCalledWith(MOCK_OTP.otp, 8); // OTP_BCRYPT_ROUNDS = 8
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { _id: MOCK_USER._id },
      expect.objectContaining({
        $set: expect.objectContaining({
          resetOtp: "hashed-otp-value",
          resetOtpExpire: MOCK_OTP.expiresAt,
        }),
      }),
      expect.any(Object)
    );
  });

  // ── 11. Response completes quickly ─────────────────────────────────
  it("completes within a reasonable time (not 35s) for all outcomes", async () => {
    // Success path
    mockSendOtpEmail.mockResolvedValue(undefined);
    const start = performance.now();
    await sendResetOtp({ email: TEST_EMAIL });
    expect(performance.now() - start).toBeLessThan(1000); // Should be near-instant with mocks    // Failure path — should throw quickly
    mockSendOtpEmail.mockRejectedValue(new Error("SMTP failed"));
    const start2 = performance.now();
    await expect(sendResetOtp({ email: TEST_EMAIL })).rejects.toThrow();
    expect(performance.now() - start2).toBeLessThan(1000);

    // Preview path (mail not configured)
      mockEnv.authEmailEnabled = false;
      mockEnv.authOtpPreviewEnabled = true;
      const start3 = performance.now();
      await sendResetOtp({ email: TEST_EMAIL });
      expect(performance.now() - start3).toBeLessThan(1000);
  });
});

describe("resetPassword", () => {
  let resetPassword;
  const TEST_EMAIL = "test@example.com";
  const TEST_OTP = "482916";
  const TEST_NEW_PASSWORD = "NewStr0ng!Pass";
  const MOCK_PASSWORD_HASH = "$2a$12$hashedNewPasswordValue";
  const NOW = Date.now();
  const FUTURE_EXPIRY = NOW + 600_000;
  const MOCK_USER_WITH_OTP = {
    _id: "abc123",
    email: TEST_EMAIL,
    name: "Test User",
    role: "user",
    emailVerified: true,
    resetOtp: "$2a$08$hashedOtpValue",
    resetOtpExpire: FUTURE_EXPIRY,
  };
  const MOCK_OTP = {
    otp: TEST_OTP,
    expiresAt: FUTURE_EXPIRY,
    expiresInMinutes: 10,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset env defaults
    Object.assign(mockEnv, {
      authEmailEnabled: true,
      authEmailUser: "noreply@zerodayguardian.com",
      authEmailAppPassword: "fake-app-password",
      authEmailFrom: "noreply@zerodayguardian.com",
      authEmailFromName: "ZeroDay Guardian Security",
    });

    // Default mock behaviors for resetPassword path
    mockFindOne.mockResolvedValue(MOCK_USER_WITH_OTP);
    mockCreateOtp.mockReturnValue(MOCK_OTP);
    mockBcryptHash.mockResolvedValue(MOCK_PASSWORD_HASH);
    mockUpdateOne.mockResolvedValue({ acknowledged: true, modifiedCount: 1 });

    // In-memory OTP verify returns false by default (testing MongoDB fallback)
    mockVerifyOtp.mockReturnValue(false);
    // bcrypt.compare returns true by default (OTP matches)
    mockBcryptCompare.mockResolvedValue(true);
    // deleteOtp is a no-op by default
    mockDeleteOtp.mockImplementation(() => {});

    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    vi.resetModules();
    const mod = await import("./authService.mjs");
    resetPassword = mod.resetPassword;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── 1. Success: in-memory OTP path ──────────────────────────────────
  it("resets password via in-memory OTP verification (fast path)", async () => {
    mockVerifyOtp.mockReturnValue(true);

    const result = await resetPassword({
      email: TEST_EMAIL,
      otp: TEST_OTP,
      password: TEST_NEW_PASSWORD,
    });

    // Should have used in-memory OTP verification
    expect(mockVerifyOtp).toHaveBeenCalledWith(TEST_EMAIL, TEST_OTP);

    // Should NOT have fallen back to MongoDB bcrypt compare
    expect(mockBcryptCompare).not.toHaveBeenCalled();

    // Should have deleted the OTP from in-memory store
    expect(mockDeleteOtp).toHaveBeenCalledWith(TEST_EMAIL);

    // Should have hashed the new password
    expect(mockBcryptHash).toHaveBeenCalledWith(TEST_NEW_PASSWORD, 12); // BCRYPT_ROUNDS = 12

    // Should have persisted the new password to MongoDB
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { _id: MOCK_USER_WITH_OTP._id },
      {
        $set: expect.objectContaining({
          password: MOCK_PASSWORD_HASH,
          updatedAt: NOW,
        }),
        $unset: expect.objectContaining({
          passwordHash: "",
          resetOtp: "",
          resetOtpExpire: "",
        }),
      }
    );

    // Should return a sanitized user
    expect(result).toBeDefined();
    expect(result.email).toBe(TEST_EMAIL);
  });

  // ── 2. Success: MongoDB bcrypt OTP fallback path ────────────────────
  it("resets password via MongoDB bcrypt OTP fallback", async () => {
    mockVerifyOtp.mockReturnValue(false);
    mockBcryptCompare.mockResolvedValue(true);

    const result = await resetPassword({
      email: TEST_EMAIL,
      otp: TEST_OTP,
      password: TEST_NEW_PASSWORD,
    });

    // Should have tried in-memory first
    expect(mockVerifyOtp).toHaveBeenCalledWith(TEST_EMAIL, TEST_OTP);

    // Should have fallen back to bcrypt compare against MongoDB hash
    expect(mockBcryptCompare).toHaveBeenCalledWith(TEST_OTP, MOCK_USER_WITH_OTP.resetOtp);

    // Should have consumed the OTP
    expect(mockDeleteOtp).toHaveBeenCalledWith(TEST_EMAIL);

    // Should have persisted new password
    expect(mockUpdateOne).toHaveBeenCalled();
    expect(result).toBeDefined();
    expect(result.email).toBe(TEST_EMAIL);
  });

  // ── 3. Throws when user not found ──────────────────────────────────
  it("throws 404 when the user is not found", async () => {
    mockFindOne.mockResolvedValue(null);

    await expect(
      resetPassword({ email: TEST_EMAIL, otp: TEST_OTP, password: TEST_NEW_PASSWORD })
    ).rejects.toMatchObject({
      status: 404,
      code: "user_not_found",
    });

    // Should NOT have attempted OTP verification or password hashing
    expect(mockVerifyOtp).not.toHaveBeenCalled();
    expect(mockBcryptHash).not.toHaveBeenCalled();
  });

  // ── 4. Throws when OTP not requested ────────────────────────────────
  it("throws 400 when no OTP was requested (no resetOtp in DB)", async () => {
    mockVerifyOtp.mockReturnValue(false);
    mockFindOne.mockResolvedValue({
      ...MOCK_USER_WITH_OTP,
      resetOtp: null,
      resetOtpExpire: null,
    });

    await expect(
      resetPassword({ email: TEST_EMAIL, otp: TEST_OTP, password: TEST_NEW_PASSWORD })
    ).rejects.toMatchObject({
      status: 400,
      code: "otp_not_requested",
    });
  });

  // ── 5. Throws when OTP expired ─────────────────────────────────────
  it("throws 400 when the OTP has expired", async () => {
    mockVerifyOtp.mockReturnValue(false);
    mockFindOne.mockResolvedValue({
      ...MOCK_USER_WITH_OTP,
      resetOtpExpire: NOW - 60_000, // expired 1 minute ago
    });

    await expect(
      resetPassword({ email: TEST_EMAIL, otp: TEST_OTP, password: TEST_NEW_PASSWORD })
    ).rejects.toMatchObject({
      status: 400,
      code: "otp_expired",
    });
  });

  // ── 6. Throws when OTP is invalid ──────────────────────────────────
  it("throws 400 when the OTP does not match", async () => {
    mockVerifyOtp.mockReturnValue(false);
    mockBcryptCompare.mockResolvedValue(false);

    await expect(
      resetPassword({ email: TEST_EMAIL, otp: "000000", password: TEST_NEW_PASSWORD })
    ).rejects.toMatchObject({
      status: 400,
      code: "invalid_otp",
    });

    // Should NOT have hashed the password or updated the DB
    expect(mockBcryptHash).not.toHaveBeenCalled();
    expect(mockUpdateOne).not.toHaveBeenCalled();
  });

  // ── 7. Normalizes email before lookup ──────────────────────────────
  it("normalizes email before database lookup", async () => {
    mockVerifyOtp.mockReturnValue(true);

    await resetPassword({
      email: "  Test@Example.COM  ",
      otp: TEST_OTP,
      password: TEST_NEW_PASSWORD,
    });

    // The mocked sanitizeText returns the input as-is, but normalizeEmail
    // also calls .trim().toLowerCase() — so the lookup uses "test@example.com"
    expect(mockVerifyOtp).toHaveBeenCalledWith("test@example.com", TEST_OTP);
  });

  // ── 8. Consumes OTP from in-memory store on success ────────────────
  it("consumes OTP from in-memory store after successful reset", async () => {
    mockVerifyOtp.mockReturnValue(true);

    await resetPassword({
      email: TEST_EMAIL,
      otp: TEST_OTP,
      password: TEST_NEW_PASSWORD,
    });

    expect(mockDeleteOtp).toHaveBeenCalledWith(TEST_EMAIL);
  });

  // ── 9. Consumes OTP even via MongoDB fallback path ─────────────────
  it("consumes OTP from in-memory store after MongoDB fallback path", async () => {
    mockVerifyOtp.mockReturnValue(false);
    mockBcryptCompare.mockResolvedValue(true);

    await resetPassword({
      email: TEST_EMAIL,
      otp: TEST_OTP,
      password: TEST_NEW_PASSWORD,
    });

    // deleteOtp should be called regardless of which verification path succeeded
    expect(mockDeleteOtp).toHaveBeenCalledWith(TEST_EMAIL);
  });

  // ── 10. Persists new password hash to MongoDB ───────────────────────
  it("persists new password bcrypt hash to MongoDB on success", async () => {
    mockVerifyOtp.mockReturnValue(true);

    await resetPassword({
      email: TEST_EMAIL,
      otp: TEST_OTP,
      password: TEST_NEW_PASSWORD,
    });

    expect(mockBcryptHash).toHaveBeenCalledWith(TEST_NEW_PASSWORD, 12);
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { _id: MOCK_USER_WITH_OTP._id },
      expect.objectContaining({
        $set: expect.objectContaining({
          password: MOCK_PASSWORD_HASH,
          updatedAt: NOW,
        }),
      })
    );
  });

  // ── 11. Returns user object after reset ─────────────────────────────
  it("returns a sanitized user object after successful reset", async () => {
    mockVerifyOtp.mockReturnValue(true);

    const result = await resetPassword({
      email: TEST_EMAIL,
      otp: TEST_OTP,
      password: TEST_NEW_PASSWORD,
    });

    expect(result).toBeDefined();
    expect(result._id).toBeDefined();
    expect(result.email).toBe(TEST_EMAIL);
    expect(result.name).toBe("Test User");
    // Password should not be exposed in the returned user
    expect(result.password).toBeUndefined();
  });

  // ── 12. In-memory OTP takes priority over MongoDB ───────────────────
  it("prefers in-memory OTP verification over MongoDB fallback", async () => {
    // Even if bcrypt.compare would fail, in-memory path should succeed
    mockVerifyOtp.mockReturnValue(true);
    mockBcryptCompare.mockResolvedValue(false);

    // In-memory path should be used, skipping bcrypt compare entirely
    await expect(
      resetPassword({ email: TEST_EMAIL, otp: TEST_OTP, password: TEST_NEW_PASSWORD })
    ).resolves.toBeDefined();

    // bcrypt.compare should NOT have been called because in-memory verification succeeded
    expect(mockBcryptCompare).not.toHaveBeenCalled();

    // But bcrypt.hash for the new password SHOULD have been called
    expect(mockBcryptHash).toHaveBeenCalledWith(TEST_NEW_PASSWORD, 12);
  });

  // ── 13. Does not expose password hash in response ───────────────────
  it("does not expose password hash in the returned user", async () => {
    mockVerifyOtp.mockReturnValue(true);

    const result = await resetPassword({
      email: TEST_EMAIL,
      otp: TEST_OTP,
      password: TEST_NEW_PASSWORD,
    });

    expect(result.password).toBeUndefined();
    expect(result.passwordHash).toBeUndefined();
  });
});
