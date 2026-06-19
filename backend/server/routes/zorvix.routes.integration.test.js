// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ── Mock groq-sdk ──────────────────────────────────────────────────────
const mockChatCompletionsCreate = vi.fn();

vi.mock("groq-sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockChatCompletionsCreate } },
  })),
}));

// ── Mock logger ────────────────────────────────────────────────────────
vi.mock("../../src/utils/logger.mjs", () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

// ── Test app builder ───────────────────────────────────────────────────
let testApp;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules(); // Fresh module = fresh rate limiter store per test
  process.env.GROQ_API_KEY = "gsk_test_key_12345";

  // Dynamic import gives us a fresh router + rate limiter each time
  const { default: router } = await import("./zorvix.routes.js");
  const app = express();
  app.use(express.json());
  app.use("/api/ai/zorvix", router);
  testApp = app;
});

// ── Tests ──────────────────────────────────────────────────────────────
describe("POST /api/ai/zorvix (integration)", () => {
  // ── 1. Valid input returns 200 with correct shape ────────────────────
  it("returns 200 with { reply, timestamp } for a valid message", async () => {
    mockChatCompletionsCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "What have you tried so far?" } }],
      usage: { prompt_tokens: 50, completion_tokens: 12 },
    });

    const res = await request(testApp)
      .post("/api/ai/zorvix")
      .send({ message: "How do I scan ports?" })
      .expect(200);

    expect(res.body).toEqual({
      reply: "What have you tried so far?",
      timestamp: expect.any(String),
    });
    // Verify the Groq model was called correctly
    expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "llama-3.3-70b-versatile",
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "system" }),
          expect.objectContaining({ role: "user", content: expect.stringContaining("How do I scan ports?") }),
        ]),
      })
    );
  });

  // ── 2. Empty message → 400 ───────────────────────────────────────────
  it("returns 400 when message is empty", async () => {
    const res = await request(testApp)
      .post("/api/ai/zorvix")
      .send({ message: "" })
      .expect(400);

    expect(res.body).toEqual(
      expect.objectContaining({
        error: "Validation failed",
        code: "invalid_input",
      })
    );
    expect(mockChatCompletionsCreate).not.toHaveBeenCalled();
  });

  // ── 3. Missing body → 400 ────────────────────────────────────────────
  it("returns 400 when body is empty", async () => {
    const res = await request(testApp)
      .post("/api/ai/zorvix")
      .send({})
      .expect(400);

    expect(res.body.code).toBe("invalid_input");
    expect(mockChatCompletionsCreate).not.toHaveBeenCalled();
  });

  // ── 4. Whitespace-only message → 400 ─────────────────────────────────
  it("returns 400 for whitespace-only message", async () => {
    const res = await request(testApp)
      .post("/api/ai/zorvix")
      .send({ message: "   \n\n   " })
      .expect(400);

    expect(res.body.code).toBe("invalid_input");
    expect(mockChatCompletionsCreate).not.toHaveBeenCalled();
  });

  // ── 5. Wrong Content-Type → body not parsed → 400 ────────────────────
  it("returns 400 when Content-Type is not JSON (body not parsed)", async () => {
    const res = await request(testApp)
      .post("/api/ai/zorvix")
      .set("Content-Type", "text/plain")
      .send("message=hello")
      .expect(400);

    expect(res.status).toBe(400);
  });

  // ── 6. Response includes ISO 8601 timestamp ──────────────────────────
  it("returns a valid ISO 8601 timestamp", async () => {
    mockChatCompletionsCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "Reply" } }],
      usage: {},
    });

    const res = await request(testApp)
      .post("/api/ai/zorvix")
      .send({ message: "Hello" })
      .expect(200);

    const timestamp = new Date(res.body.timestamp);
    expect(timestamp.toISOString()).toBe(res.body.timestamp);
  });

  // ── 7. userContext is forwarded to Groq ──────────────────────────────
  it("includes userContext in the Groq message", async () => {
    mockChatCompletionsCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "Context-aware reply" } }],
      usage: {},
    });

    await request(testApp)
      .post("/api/ai/zorvix")
      .send({ message: "Help me", userContext: "Day 5: Web App Security" })
      .expect(200);

    const call = mockChatCompletionsCreate.mock.calls[0][0];
    expect(call.messages[1].content).toContain("Day 5: Web App Security");
  });

  // ── 8. GET returns 404 (wrong HTTP method) ───────────────────────────
  it("returns 404 for GET requests", async () => {
    await request(testApp)
      .get("/api/ai/zorvix")
      .expect(404);
  });

  // ── 9. Groq 429 upstream → 429 to client ─────────────────────────────
  it("returns 429 when Groq itself rate-limits (upstream)", async () => {
    const err = Object.assign(new Error("Rate limit"), { status: 429 });
    mockChatCompletionsCreate.mockRejectedValueOnce(err);

    const res = await request(testApp)
      .post("/api/ai/zorvix")
      .send({ message: "Tell me about XSS" })
      .expect(429);

    expect(res.body.code).toBe("rate_limit");
    expect(res.body.retryAfterSec).toBe(30);
  });

  // ── 10. Groq 500 upstream → 502 to client ────────────────────────────
  it("returns 502 when Groq has an upstream server error", async () => {
    const err = Object.assign(new Error("Internal error"), { status: 500 });
    mockChatCompletionsCreate.mockRejectedValueOnce(err);

    const res = await request(testApp)
      .post("/api/ai/zorvix")
      .send({ message: "Hello" })
      .expect(502);

    expect(res.body.code).toBe("upstream_error");
  });

  // ── 11. Content-Type is application/json ─────────────────────────────
  it("returns Content-Type: application/json", async () => {
    mockChatCompletionsCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "Ok" } }],
      usage: {},
    });

    const res = await request(testApp)
      .post("/api/ai/zorvix")
      .send({ message: "Hello" })
      .expect(200);

    expect(res.headers["content-type"]).toMatch(/application\/json/);
  });

  // ── 12. Rate limit: 21st request → 429 ──────────────────────────────
  // This test MUST be last since it exhausts the rate limit for its app instance.
  // vi.resetModules() in beforeEach ensures a fresh store for each test,
  // but this test sends 21 requests within a single test — that's intentional.
  it("returns 429 after exceeding 20 requests in the window", async () => {
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: "Reply" } }],
      usage: {},
    });

    // Send 20 requests — all should succeed (fresh rate limiter store)
    for (let i = 0; i < 20; i++) {
      await request(testApp)
        .post("/api/ai/zorvix")
        .send({ message: `Message ${i}` })
        .expect(200);
    }

    // 21st request should be rate-limited
    const res = await request(testApp)
      .post("/api/ai/zorvix")
      .send({ message: "Message 21" })
      .expect(429);

    expect(res.body).toEqual(
      expect.objectContaining({
        error: "Rate limit exceeded",
        code: "zorvix_rate_limited",
        retryAfterSec: 900,
      })
    );
  });

  // ── 13. RateLimit standard headers present ────────────────────────────
  it("returns standard RateLimit headers", async () => {
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: "Reply" } }],
      usage: {},
    });

    const res = await request(testApp)
      .post("/api/ai/zorvix")
      .send({ message: "Hello" })
      .expect(200);

    // express-rate-limit with standardHeaders: true returns these
    expect(res.headers["ratelimit-limit"]).toBeDefined();
    expect(res.headers["ratelimit-remaining"]).toBeDefined();
    expect(res.headers["ratelimit-reset"]).toBeDefined();
  });
});
