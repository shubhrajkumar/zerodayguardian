// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock groq-sdk ──────────────────────────────────────────────────────
const mockChatCompletionsCreate = vi.fn();

vi.mock("groq-sdk", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: { completions: { create: mockChatCompletionsCreate } },
    })),
  };
});

// ── Mock logger ────────────────────────────────────────────────────────
vi.mock("../../src/utils/logger.mjs", () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

// ── Helpers ────────────────────────────────────────────────────────────
const makeReq = (body = {}, overrides = {}) => ({
  body,
  requestId: "test-req-1",
  ...overrides,
});

const makeRes = () => {
  const res = { _status: 0, _body: null };
  res.status = vi.fn().mockImplementation((s) => {
    res._status = s;
    return res;
  });
  res.json = vi.fn().mockImplementation((b) => {
    res._body = b;
    return res;
  });
  return res;
};

// ── Tests ──────────────────────────────────────────────────────────────
describe("chatWithZorvix", () => {
  const originalEnv = process.env.GROQ_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GROQ_API_KEY = "gsk_test_key_12345";
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.GROQ_API_KEY;
    } else {
      process.env.GROQ_API_KEY = originalEnv;
    }
  });

  // Helper: get a fresh controller import (resets the Groq singleton)
  const freshController = async () => {
    vi.resetModules();
    const mod = await import("./zorvixAI.controller.js");
    return mod.chatWithZorvix;
  };

  // ── 1. Valid input → 200 ─────────────────────────────────────────────
  it("returns 200 with a valid message and Groq reply", async () => {
    const chatWithZorvix = await freshController();

    mockChatCompletionsCreate.mockResolvedValueOnce({
      choices: [
        { message: { content: "What have you tried so far?" } },
      ],
      usage: { prompt_tokens: 50, completion_tokens: 12 },
    });

    const req = makeReq({ message: "How do I scan ports?" });
    const res = makeRes();

    await chatWithZorvix(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        reply: "What have you tried so far?",
        timestamp: expect.any(String),
      })
    );
    // Verify Groq was called with the correct model
    expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "llama3-70b-8192" })
    );
    // Verify system prompt is included
    const call = mockChatCompletionsCreate.mock.calls[0][0];
    expect(call.messages[0].role).toBe("system");
    expect(call.messages[0].content).toContain("Zorvix");
    expect(call.messages[1].role).toBe("user");
    expect(call.messages[1].content).toContain("How do I scan ports?");
  });

  // ── 2. Valid input with userContext ───────────────────────────────────
  it("appends userContext to the user message when provided", async () => {
    const chatWithZorvix = await freshController();

    mockChatCompletionsCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "Context-aware reply" } }],
      usage: { prompt_tokens: 60, completion_tokens: 5 },
    });

    const req = makeReq({
      message: "Help me with this lab",
      userContext: "Day 3: Network Recon",
    });
    const res = makeRes();

    await chatWithZorvix(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const call = mockChatCompletionsCreate.mock.calls[0][0];
    expect(call.messages[1].content).toContain("Day 3: Network Recon");
  });

  // ── 3. Empty message → 400 ───────────────────────────────────────────
  it("returns 400 when message is empty", async () => {
    const chatWithZorvix = await freshController();

    const req = makeReq({ message: "" });
    const res = makeRes();

    await chatWithZorvix(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Validation failed",
        code: "invalid_input",
      })
    );
    expect(mockChatCompletionsCreate).not.toHaveBeenCalled();
  });

  // ── 4. Whitespace-only message → 400 ─────────────────────────────────
  it("returns 400 when message is only whitespace", async () => {
    const chatWithZorvix = await freshController();

    const req = makeReq({ message: "   \n\n   " });
    const res = makeRes();

    await chatWithZorvix(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "invalid_input" })
    );
    expect(mockChatCompletionsCreate).not.toHaveBeenCalled();
  });

  // ── 5. Missing body → 400 ────────────────────────────────────────────
  it("returns 400 when req.body is undefined", async () => {
    const chatWithZorvix = await freshController();

    const req = makeReq(undefined);
    req.body = undefined;
    const res = makeRes();

    await chatWithZorvix(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockChatCompletionsCreate).not.toHaveBeenCalled();
  });

  // ── 6. Missing API key → 500 ─────────────────────────────────────────
  it("returns 500 when GROQ_API_KEY is not set", async () => {
    delete process.env.GROQ_API_KEY;
    const chatWithZorvix = await freshController();

    const req = makeReq({ message: "Hello" });
    const res = makeRes();

    await chatWithZorvix(req, res);

    // getClient() throws status:500 → catch block routes to 502 (upstream_error)
    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "upstream_error",
      })
    );
    expect(mockChatCompletionsCreate).not.toHaveBeenCalled();
  });

  // ── 7. Groq 429 rate limit → 429 ─────────────────────────────────────
  it("returns 429 when Groq rate-limits the request", async () => {
    const chatWithZorvix = await freshController();

    const rateLimitError = Object.assign(
      new Error("Rate limit reached for model"),
      { status: 429, statusCode: 429 }
    );
    mockChatCompletionsCreate.mockRejectedValueOnce(rateLimitError);

    const req = makeReq({ message: "Tell me about SQL injection" });
    const res = makeRes();

    await chatWithZorvix(req, res);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Rate limited",
        code: "rate_limit",
        retryAfterSec: 30,
      })
    );
  });

  // ── 8. Groq 401 auth error → 500 ─────────────────────────────────────
  it("returns 500 when Groq rejects the API key (401)", async () => {
    const chatWithZorvix = await freshController();

    const authError = Object.assign(new Error("Invalid API key"), {
      status: 401,
    });
    mockChatCompletionsCreate.mockRejectedValueOnce(authError);

    const req = makeReq({ message: "Hello" });
    const res = makeRes();

    await chatWithZorvix(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "groq_auth_error" })
    );
  });

  // ── 9. Groq 400 bad request → 400 ────────────────────────────────────
  it("returns 400 when Groq rejects the payload", async () => {
    const chatWithZorvix = await freshController();

    const badReqError = Object.assign(new Error("Invalid model"), {
      status: 400,
    });
    mockChatCompletionsCreate.mockRejectedValueOnce(badReqError);

    const req = makeReq({ message: "Hello" });
    const res = makeRes();

    await chatWithZorvix(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "bad_request" })
    );
  });

  // ── 10. Groq 500 upstream error → 502 ────────────────────────────────
  it("returns 502 when Groq has a server-side error", async () => {
    const chatWithZorvix = await freshController();

    const serverError = Object.assign(new Error("Internal server error"), {
      status: 500,
    });
    mockChatCompletionsCreate.mockRejectedValueOnce(serverError);

    const req = makeReq({ message: "Hello" });
    const res = makeRes();

    await chatWithZorvix(req, res);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "upstream_error" })
    );
  });

  // ── 11. Network error → 502 ──────────────────────────────────────────
  it("returns 502 on network/DNS failure", async () => {
    const chatWithZorvix = await freshController();

    const netError = Object.assign(
      new Error("getaddrinfo ENOTFOUND api.groq.com"),
      { code: "ENOTFOUND" }
    );
    mockChatCompletionsCreate.mockRejectedValueOnce(netError);

    const req = makeReq({ message: "Hello" });
    const res = makeRes();

    await chatWithZorvix(req, res);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "network_error" })
    );
  });

  // ── 12. Empty Groq reply → 500 ───────────────────────────────────────
  it("returns 500 when Groq returns an empty response", async () => {
    const chatWithZorvix = await freshController();

    mockChatCompletionsCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "" } }],
      usage: { prompt_tokens: 50, completion_tokens: 0 },
    });

    const req = makeReq({ message: "Hello" });
    const res = makeRes();

    await chatWithZorvix(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "empty_response" })
    );
  });

  // ── 13. Input sanitisation ───────────────────────────────────────────
  it("truncates messages exceeding MAX_MESSAGE_LENGTH", async () => {
    const chatWithZorvix = await freshController();

    mockChatCompletionsCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "Ok" } }],
      usage: {},
    });

    const longMessage = "a".repeat(5000);
    const req = makeReq({ message: longMessage });
    const res = makeRes();

    await chatWithZorvix(req, res);

    // Should still succeed — sanitiser trims to 4000
    expect(res.status).toHaveBeenCalledWith(200);
    const call = mockChatCompletionsCreate.mock.calls[0][0];
    expect(call.messages[1].content.length).toBeLessThanOrEqual(4000);
  });

  // ── 14. Groq 403 auth error → 500 ────────────────────────────────────
  it("returns 500 when Groq returns 403 forbidden", async () => {
    const chatWithZorvix = await freshController();

    const forbiddenError = Object.assign(new Error("Forbidden"), {
      status: 403,
    });
    mockChatCompletionsCreate.mockRejectedValueOnce(forbiddenError);

    const req = makeReq({ message: "Hello" });
    const res = makeRes();

    await chatWithZorvix(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "groq_auth_error" })
    );
  });

  // ── 15. Groq 404 model not found → 500 ───────────────────────────────
  it("returns 500 when the Groq model is not found (404)", async () => {
    const chatWithZorvix = await freshController();

    const notFoundError = Object.assign(new Error("Model not found"), {
      status: 404,
    });
    mockChatCompletionsCreate.mockRejectedValueOnce(notFoundError);

    const req = makeReq({ message: "Hello" });
    const res = makeRes();

    await chatWithZorvix(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "model_not_found" })
    );
  });
});
