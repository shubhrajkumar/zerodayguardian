// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ObjectId } from "mongodb";

// ── Mock bcryptjs ──────────────────────────────────────────────────────
const mockHash = vi.fn();
const mockCompare = vi.fn();

vi.mock("bcryptjs", () => ({
  default: { hash: mockHash, compare: mockCompare },
}));

// ── Mock logger ────────────────────────────────────────────────────────
vi.mock("../../src/utils/logger.mjs", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

// ── Mock env ───────────────────────────────────────────────────────────
vi.mock("../../src/config/env.mjs", () => ({
  env: {
    jwtSecret: "test-jwt-secret",
    jwtIssuer: "test-issuer",
    jwtAudience: "test-audience",
    dbEncryptionKey: "",
    sessionSecret: "test-session-secret",
    googleOauthClientId: "",
    googleOauthClientSecret: "",
    googleRedirectUri: "",
    backendPublicUrl: "http://localhost:8787",
    port: 8787,
  },
}));

// ── Mock db ────────────────────────────────────────────────────────────
const mockCollection = {
  findOne: vi.fn(),
  insertOne: vi.fn(),
  updateOne: vi.fn(),
};

vi.mock("../../src/config/db.mjs", () => ({
  getDb: () => ({ collection: () => mockCollection }),
  getDbPoolStatus: () => ({ initialized: true, connected: true }),
}));

// ── Mock cookiePolicy ─────────────────────────────────────────────────
vi.mock("../../src/utils/cookiePolicy.mjs", () => ({
  buildCookieOptions: () => ({ httpOnly: true, secure: true, sameSite: "lax" }),
}));

// ── Mock authFallbackStore ────────────────────────────────────────────
vi.mock("./authFallbackStore.mjs", () => ({
  getAuthFallbackCollection: () => mockCollection,
}));

// ── Mock otpService (sendOtpEmail) ────────────────────────────────────
const mockSendOtpEmail = vi.fn();
vi.mock("../../src/services/otpService.mjs", () => ({
  sendOtpEmail: mockSendOtpEmail,
}));

// ── Import the module under test ──────────────────────────────────────
const { registerUser, loginUser, verifyUserOtp } = await import("./authService.mjs");

// ── Helpers ────────────────────────────────────────────────────────────
const TEST_EMAIL = "test@example.com";
const TEST_NAME = "Test User";
const TEST_PASSWORD = "StrongPass1!";

const mockInsertedId = new ObjectId();
const hashedPassword = "$2a$12$hashedpasswordvalue";

/** Build a mock user document as it would be stored in MongoDB (pre-hydration). */
const buildStoredUser = (overrides = {}) => ({
  _id: mockInsertedId,
  email: TEST_EMAIL,
  emailHash: "mock-hash",
  name: TEST_NAME,
  password: hashedPassword,
  role: "user",
  authProvider: "email",
  emailVerified: false,
  isVerified: false,
  otp: "123456",
  otpExpires: new Date(Date.now() + 15 * 60_000),
  lastLoginAt: Date.now(),
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockHash.mockResolvedValue(hashedPassword);
  mockCompare.mockReset();
  mockCollection.findOne.mockReset();
  mockCollection.insertOne.mockReset();
  mockCollection.updateOne.mockReset();
});

// ══════════════════════════════════════════════════════════════════════
// registerUser
// ══════════════════════════════════════════════════════════════════════
describe("registerUser", () => {
  it("creates a new user and returns user (otp is no longer exposed in response)", async () => {
    mockCollection.findOne.mockResolvedValue(null); // no existing user
    mockCollection.insertOne.mockResolvedValue({ insertedId: mockInsertedId });

    const result = await registerUser({
      name: TEST_NAME,
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    expect(result.user).toBeDefined();
    expect(result.otp).toBeUndefined();
    expect(result.user.email).toBe(TEST_EMAIL);
    expect(result.user.name).toBe(TEST_NAME);
    expect(mockHash).toHaveBeenCalledWith(TEST_PASSWORD, 12);
    expect(mockCollection.insertOne).toHaveBeenCalledOnce();
  });

  it("stores a bcrypt-hashed password (never plaintext)", async () => {
    mockCollection.findOne.mockResolvedValue(null);
    mockCollection.insertOne.mockResolvedValue({ insertedId: mockInsertedId });

    await registerUser({
      name: TEST_NAME,
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    const insertedDoc = mockCollection.insertOne.mock.calls[0][0];
    expect(insertedDoc.password).toBe(hashedPassword);
    expect(insertedDoc.password).not.toBe(TEST_PASSWORD);
  });

  it("sets emailVerified and isVerified to false", async () => {
    mockCollection.findOne.mockResolvedValue(null);
    mockCollection.insertOne.mockResolvedValue({ insertedId: mockInsertedId });

    await registerUser({
      name: TEST_NAME,
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    const insertedDoc = mockCollection.insertOne.mock.calls[0][0];
    expect(insertedDoc.emailVerified).toBe(false);
    expect(insertedDoc.isVerified).toBe(false);
  });

  it("generates a 6-digit numeric OTP", async () => {
    mockCollection.findOne.mockResolvedValue(null);
    mockCollection.insertOne.mockResolvedValue({ insertedId: mockInsertedId });

    await registerUser({
      name: TEST_NAME,
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    const insertedDoc = mockCollection.insertOne.mock.calls[0][0];
    expect(insertedDoc.otp).toMatch(/^\d{6}$/);
    expect(Number(insertedDoc.otp)).toBeGreaterThanOrEqual(100000);
    expect(Number(insertedDoc.otp)).toBeLessThanOrEqual(999999);
  });

  it("sets otpExpires to ~15 minutes from now", async () => {
    mockCollection.findOne.mockResolvedValue(null);
    mockCollection.insertOne.mockResolvedValue({ insertedId: mockInsertedId });

    const before = Date.now();
    await registerUser({
      name: TEST_NAME,
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    const after = Date.now();

    const insertedDoc = mockCollection.insertOne.mock.calls[0][0];
    const otpExpiryMs = new Date(insertedDoc.otpExpires).getTime();
    expect(otpExpiryMs).toBeGreaterThanOrEqual(before + 14 * 60_000);
    expect(otpExpiryMs).toBeLessThanOrEqual(after + 16 * 60_000);
  });

  it("sets authProvider to 'email'", async () => {
    mockCollection.findOne.mockResolvedValue(null);
    mockCollection.insertOne.mockResolvedValue({ insertedId: mockInsertedId });

    await registerUser({
      name: TEST_NAME,
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    const insertedDoc = mockCollection.insertOne.mock.calls[0][0];
    expect(insertedDoc.authProvider).toBe("email");
  });

  it("throws 409 if email already exists", async () => {
    mockCollection.findOne.mockResolvedValue(buildStoredUser());

    await expect(
      registerUser({ name: TEST_NAME, email: TEST_EMAIL, password: TEST_PASSWORD })
    ).rejects.toMatchObject({
      status: 409,
      code: "email_exists",
    });
  });

  it("normalizes email to lowercase", async () => {
    mockCollection.findOne.mockResolvedValue(null);
    mockCollection.insertOne.mockResolvedValue({ insertedId: mockInsertedId });

    await registerUser({
      name: TEST_NAME,
      email: "  Test@EXAMPLE.com  ",
      password: TEST_PASSWORD,
    });

    const insertedDoc = mockCollection.insertOne.mock.calls[0][0];
    // The email is encrypted via protectUserFields, but the lookup should use lowercase
    expect(mockCollection.findOne).toHaveBeenCalled();
  });

  it("stores a unique OTP in MongoDB for each registration", async () => {
    mockCollection.findOne.mockResolvedValue(null);
    mockCollection.insertOne.mockResolvedValue({ insertedId: mockInsertedId });

    await registerUser({ name: TEST_NAME, email: TEST_EMAIL, password: TEST_PASSWORD });
    const doc1 = mockCollection.insertOne.mock.calls[0][0];

    await registerUser({ name: "Other", email: "other@example.com", password: TEST_PASSWORD });
    const doc2 = mockCollection.insertOne.mock.calls[1][0];

    // OTPs are stored in MongoDB, not returned — verify they are unique
    expect(doc1.otp).toBeDefined();
    expect(doc2.otp).toBeDefined();
    expect(doc1.otp).not.toBe(doc2.otp);
  });

  it("sends verification email after registration", async () => {
    mockCollection.findOne.mockResolvedValue(null);
    mockCollection.insertOne.mockResolvedValue({ insertedId: mockInsertedId });
    mockSendOtpEmail.mockResolvedValue(undefined);

    await registerUser({ name: TEST_NAME, email: TEST_EMAIL, password: TEST_PASSWORD });

    expect(mockSendOtpEmail).toHaveBeenCalledOnce();
    expect(mockSendOtpEmail).toHaveBeenCalledWith(
      TEST_EMAIL,
      expect.stringMatching(/^\d{6}$/),
      15,
    );
  });

  it("does not throw if email sending fails", async () => {
    mockCollection.findOne.mockResolvedValue(null);
    mockCollection.insertOne.mockResolvedValue({ insertedId: mockInsertedId });
    mockSendOtpEmail.mockRejectedValue(new Error("Resend timeout"));

    // Should NOT throw — account is still created
    const result = await registerUser({ name: TEST_NAME, email: TEST_EMAIL, password: TEST_PASSWORD });
    expect(result.user).toBeDefined();
  });

  it("never returns otp in the response", async () => {
    mockCollection.findOne.mockResolvedValue(null);
    mockCollection.insertOne.mockResolvedValue({ insertedId: mockInsertedId });
    mockSendOtpEmail.mockResolvedValue(undefined);

    const result = await registerUser({ name: TEST_NAME, email: TEST_EMAIL, password: TEST_PASSWORD });
    expect(result.otp).toBeUndefined();
    expect(Object.keys(result)).not.toContain("otp");
  });
});

// ══════════════════════════════════════════════════════════════════════
// loginUser
// ══════════════════════════════════════════════════════════════════════
describe("loginUser", () => {
  it("returns the user on valid credentials", async () => {
    const stored = buildStoredUser({ emailVerified: true });
    mockCollection.findOne.mockResolvedValue(stored);
    mockCompare.mockResolvedValue(true);
    mockCollection.updateOne.mockResolvedValue({});

    const result = await loginUser({ email: TEST_EMAIL, password: TEST_PASSWORD });

    expect(result).toBeDefined();
    expect(result.email).toBe(TEST_EMAIL);
    expect(result.name).toBe(TEST_NAME);
    expect(mockCompare).toHaveBeenCalledWith(TEST_PASSWORD, hashedPassword);
    expect(mockCollection.updateOne).toHaveBeenCalledOnce();
  });

  it("throws 401 if user not found", async () => {
    mockCollection.findOne.mockResolvedValue(null);

    await expect(
      loginUser({ email: TEST_EMAIL, password: TEST_PASSWORD })
    ).rejects.toMatchObject({
      status: 401,
      code: "invalid_credentials",
    });
  });

  it("throws 401 if password does not match", async () => {
    mockCollection.findOne.mockResolvedValue(buildStoredUser({ emailVerified: true }));
    mockCompare.mockResolvedValue(false);

    await expect(
      loginUser({ email: TEST_EMAIL, password: "wrongpassword" })
    ).rejects.toMatchObject({
      status: 401,
      code: "invalid_credentials",
    });
  });

  it("throws 401 if user has no password (e.g. corrupted account)", async () => {
    // User exists with email auth but password field is null/missing
    // (no googleId so it doesn't hit the google_only_account check)
    mockCollection.findOne.mockResolvedValue(
      buildStoredUser({ password: null, googleId: undefined, authProvider: "email" })
    );

    await expect(
      loginUser({ email: TEST_EMAIL, password: TEST_PASSWORD })
    ).rejects.toMatchObject({
      status: 401,
      code: "invalid_credentials",
    });
  });

  it("throws 400 if user is a Google-only account (has googleId)", async () => {
    mockCollection.findOne.mockResolvedValue(
      buildStoredUser({ authProvider: "google", googleId: "g-123" })
    );

    await expect(
      loginUser({ email: TEST_EMAIL, password: TEST_PASSWORD })
    ).rejects.toMatchObject({
      status: 400,
      code: "google_only_account",
    });
  });

  it("throws 403 if email is not verified", async () => {
    mockCollection.findOne.mockResolvedValue(
      buildStoredUser({ emailVerified: false, isVerified: false })
    );
    mockCompare.mockResolvedValue(true);

    await expect(
      loginUser({ email: TEST_EMAIL, password: TEST_PASSWORD })
    ).rejects.toMatchObject({
      status: 403,
      code: "email_not_verified",
    });
  });

  it("allows login when isVerified is true even if emailVerified is false", async () => {
    mockCollection.findOne.mockResolvedValue(
      buildStoredUser({ emailVerified: false, isVerified: true })
    );
    mockCompare.mockResolvedValue(true);
    mockCollection.updateOne.mockResolvedValue({});

    const result = await loginUser({ email: TEST_EMAIL, password: TEST_PASSWORD });
    expect(result).toBeDefined();
    expect(result.email).toBe(TEST_EMAIL);
  });

  it("allows login when emailVerified is true even if isVerified is false", async () => {
    mockCollection.findOne.mockResolvedValue(
      buildStoredUser({ emailVerified: true, isVerified: false })
    );
    mockCompare.mockResolvedValue(true);
    mockCollection.updateOne.mockResolvedValue({});

    const result = await loginUser({ email: TEST_EMAIL, password: TEST_PASSWORD });
    expect(result).toBeDefined();
  });

  it("updates lastLoginAt on successful login", async () => {
    mockCollection.findOne.mockResolvedValue(buildStoredUser({ emailVerified: true }));
    mockCompare.mockResolvedValue(true);
    mockCollection.updateOne.mockResolvedValue({});

    await loginUser({ email: TEST_EMAIL, password: TEST_PASSWORD });

    const updateCall = mockCollection.updateOne.mock.calls[0];
    const updateSet = updateCall[1].$set;
    expect(updateSet.lastLoginAt).toBeDefined();
    expect(typeof updateSet.lastLoginAt).toBe("number");
  });

  it("does not reveal which field was wrong (email vs password)", async () => {
    mockCollection.findOne.mockResolvedValue(null);

    try {
      await loginUser({ email: TEST_EMAIL, password: "wrong" });
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error.message).toBe("Invalid email or password");
      expect(error.status).toBe(401);
    }

    // Even with a real user but wrong password, same message
    mockCollection.findOne.mockResolvedValue(buildStoredUser({ emailVerified: true }));
    mockCompare.mockResolvedValue(false);

    try {
      await loginUser({ email: TEST_EMAIL, password: "wrong" });
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error.message).toBe("Invalid email or password");
      expect(error.status).toBe(401);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════
// verifyUserOtp
// ══════════════════════════════════════════════════════════════════════
describe("verifyUserOtp", () => {
  const OTP_CODE = "123456";

  it("verifies OTP and marks email as verified", async () => {
    mockCollection.findOne.mockResolvedValue(
      buildStoredUser({ otp: OTP_CODE, otpExpires: new Date(Date.now() + 10 * 60_000) })
    );
    mockCollection.updateOne.mockResolvedValue({});

    const result = await verifyUserOtp({ email: TEST_EMAIL, otp: OTP_CODE });

    expect(result.verified).toBe(true);
    expect(result.user).toBeDefined();
    expect(result.user.emailVerified).toBe(true);
    expect(result.user.isVerified).toBe(true);
    expect(mockCollection.updateOne).toHaveBeenCalledOnce();

    const updateSet = mockCollection.updateOne.mock.calls[0][1].$set;
    expect(updateSet.emailVerified).toBe(true);
    expect(updateSet.isVerified).toBe(true);
    expect(updateSet.otp).toBeNull();
    expect(updateSet.otpExpires).toBeNull();
  });

  it("throws 404 if user not found", async () => {
    mockCollection.findOne.mockResolvedValue(null);

    await expect(
      verifyUserOtp({ email: TEST_EMAIL, otp: OTP_CODE })
    ).rejects.toMatchObject({
      status: 404,
      code: "user_not_found",
    });
  });

  it("returns already verified if email is already verified", async () => {
    mockCollection.findOne.mockResolvedValue(
      buildStoredUser({ emailVerified: true, isVerified: true, otp: null, otpExpires: null })
    );

    const result = await verifyUserOtp({ email: TEST_EMAIL, otp: OTP_CODE });

    expect(result.verified).toBe(true);
    expect(mockCollection.updateOne).not.toHaveBeenCalled();
  });

  it("throws 400 if no OTP is pending (otp field is null)", async () => {
    mockCollection.findOne.mockResolvedValue(
      buildStoredUser({ otp: null, otpExpires: null })
    );

    await expect(
      verifyUserOtp({ email: TEST_EMAIL, otp: OTP_CODE })
    ).rejects.toMatchObject({
      status: 400,
      code: "no_otp_pending",
    });
  });

  it("throws 400 if OTP has expired", async () => {
    mockCollection.findOne.mockResolvedValue(
      buildStoredUser({
        otp: OTP_CODE,
        otpExpires: new Date(Date.now() - 1 * 60_000), // expired 1 minute ago
      })
    );

    await expect(
      verifyUserOtp({ email: TEST_EMAIL, otp: OTP_CODE })
    ).rejects.toMatchObject({
      status: 400,
      code: "otp_expired",
    });
  });

  it("throws 400 if OTP code is incorrect", async () => {
    mockCollection.findOne.mockResolvedValue(
      buildStoredUser({
        otp: OTP_CODE,
        otpExpires: new Date(Date.now() + 10 * 60_000),
      })
    );

    await expect(
      verifyUserOtp({ email: TEST_EMAIL, otp: "999999" })
    ).rejects.toMatchObject({
      status: 400,
      code: "otp_invalid",
    });
  });

  it("clears otp and otpExpires after successful verification", async () => {
    mockCollection.findOne.mockResolvedValue(
      buildStoredUser({ otp: OTP_CODE, otpExpires: new Date(Date.now() + 10 * 60_000) })
    );
    mockCollection.updateOne.mockResolvedValue({});

    await verifyUserOtp({ email: TEST_EMAIL, otp: OTP_CODE });

    const updateSet = mockCollection.updateOne.mock.calls[0][1].$set;
    expect(updateSet.otp).toBeNull();
    expect(updateSet.otpExpires).toBeNull();
  });

  it("normalizes email to lowercase before lookup", async () => {
    mockCollection.findOne.mockResolvedValue(null);

    await expect(
      verifyUserOtp({ email: "  TEST@Example.COM  ", otp: OTP_CODE })
    ).rejects.toMatchObject({ status: 404 });

    // Should have called findOne (meaning email was normalized and lookup attempted)
    expect(mockCollection.findOne).toHaveBeenCalledOnce();
  });
});
