import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import http from "node:http";

type JsonLike = Record<string, unknown>;

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

const applyBaseEnv = () => {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = process.env.DATABASE_URL || "mongodb://localhost:27017/neurobot";
  process.env.REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
  process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-session-secret";
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
  process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:8080";
  process.env.OPENAI_BASE_URL = "https://api.openai.com/v1/responses";
  process.env.GOOGLE_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
  process.env.OPENAI_MODEL = "gpt-4.1-mini";
  process.env.GOOGLE_MODEL = "gemini-2.0-flash";
  process.env.OPENAI_API_KEY = "openai-test-key";
  process.env.GOOGLE_API_KEY = "AIza-test-google-key";
  process.env.LLM_API_KEY = "AIza-test-google-key";
  process.env.VERIFY_LLM_ON_STARTUP = "false";
  process.env.OTEL_ENABLED = "false";
  process.env.TRUST_PROXY = "false";
  process.env.LLM_MAX_RETRIES = "0";
};

const jsonResponse = (body: JsonLike, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

const textResponse = (status: number, text: string) => ({
  ok: false,
  status,
  text: async () => text,
});

const importLlm = async () => {
  vi.resetModules();
  return import("../../backend/src/llm/index.mjs");
};

const importApp = async () => {
  vi.resetModules();
  return import("../../backend/src/app.mjs");
};

describe("multi-llm integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    applyBaseEnv();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
  });

  it("fails over from primary provider to fallback provider", async () => {
    process.env.LLM_MODE = "auto";
    process.env.ROUTING_MODE = "failover";
    process.env.PRIMARY_PROVIDER = "openai";
    process.env.FALLBACK_PROVIDER = "google";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(textResponse(503, "upstream unavailable"))
      .mockResolvedValueOnce(
        jsonResponse({
          candidates: [
            {
              content: { parts: [{ text: "google fallback success" }] },
              finishReason: "STOP",
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 5,
            totalTokenCount: 15,
          },
        })
      );
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    const { requestLlm } = await importLlm();
    const text = await requestLlm({
      messages: [{ role: "user", content: "hello" }],
      topic: null,
      timeoutMs: 2000,
      userTier: "free",
      correlationId: "test-failover-1",
    });

    expect(text).toBe("google fallback success");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("switches provider on quota exhaustion", async () => {
    process.env.LLM_MODE = "auto";
    process.env.ROUTING_MODE = "primary";
    process.env.PRIMARY_PROVIDER = "openai";
    process.env.FALLBACK_PROVIDER = "google";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(textResponse(429, "quota exceeded"))
      .mockResolvedValueOnce(
        jsonResponse({
          candidates: [
            {
              content: { parts: [{ text: "google quota-switch success" }] },
              finishReason: "STOP",
            },
          ],
          usageMetadata: {
            promptTokenCount: 8,
            candidatesTokenCount: 3,
            totalTokenCount: 11,
          },
        })
      );
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    const { requestLlm } = await importLlm();
    const text = await requestLlm({
      messages: [{ role: "user", content: "hello" }],
      topic: null,
      timeoutMs: 2000,
      userTier: "free",
      correlationId: "test-quota-1",
    });

    expect(text).toBe("google quota-switch success");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not duplicate generation by failing over after stream tokens already emitted", async () => {
    process.env.LLM_MODE = "auto";
    process.env.ROUTING_MODE = "failover";
    process.env.PRIMARY_PROVIDER = "openai";
    process.env.FALLBACK_PROVIDER = "google";

    const encoder = new TextEncoder();
    const reader = {
      index: 0,
      async read() {
        if (this.index === 0) {
          this.index += 1;
          return { done: false, value: encoder.encode('data: {"delta":"A"}\n\n') };
        }
        throw new Error("stream socket reset");
      },
    };

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: { getReader: () => reader },
      text: async () => "",
    });
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    const { requestLlmStream } = await importLlm();
    const deltas: string[] = [];
    await expect(
      requestLlmStream({
        messages: [{ role: "user", content: "stream now" }],
        topic: null,
        timeoutMs: 2000,
        userTier: "free",
        correlationId: "test-stream-1",
        onDelta: async (delta: string) => deltas.push(delta),
      })
    ).rejects.toThrow("stream socket reset");

    expect(deltas).toEqual(["A"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("exposes secured llm status endpoint via ops secret", async () => {
    process.env.LLM_MODE = "google";
    process.env.ROUTING_MODE = "primary";
    process.env.LLM_OPS_SECRET = "ops-test-secret";

    const { createApp } = await importApp();
    const app = createApp();
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    try {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      const baseUrl = `http://127.0.0.1:${port}`;

      const denied = await fetch(`${baseUrl}/api/neurobot/llm/status`);
      expect(denied.status).toBe(403);

      const allowed = await fetch(`${baseUrl}/api/neurobot/llm/status`, {
        headers: { "x-ops-secret": "ops-test-secret" },
      });
      expect(allowed.status).toBe(200);
      const payload = (await allowed.json()) as {
        status: string;
        providers: Record<string, unknown>;
        routing: { llmMode: string };
      };
      expect(payload.status).toBe("ok");
      expect(payload.routing.llmMode).toBe("google");
      expect(payload.providers).toHaveProperty("openai");
      expect(payload.providers).toHaveProperty("google");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  });

  it("returns SSE error+done without silent fallback when fallback is disabled", async () => {
    process.env.LLM_MODE = "google";
    process.env.ALLOW_LLM_FALLBACK = "false";
    process.env.STREAM_USE_CHECKPOINT_STORE = "false";
    process.env.LLM_MAX_RETRIES = "0";

    const fetchMock = vi.fn().mockResolvedValue(textResponse(503, "upstream unavailable"));
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    const requestRaw = (
      options: http.RequestOptions,
      body?: string
    ): Promise<{ status: number; headers: http.IncomingHttpHeaders; text: string }> =>
      new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          res.on("end", () =>
            resolve({
              status: Number(res.statusCode || 0),
              headers: res.headers,
              text: Buffer.concat(chunks).toString("utf8"),
            })
          );
        });
        req.on("error", reject);
        if (body) req.write(body);
        req.end();
      });

    const { createApp } = await importApp();
    const app = createApp();
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    try {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      const bootstrap = await requestRaw({
        hostname: "127.0.0.1",
        port,
        path: "/api/ping",
        method: "GET",
      });
      const setCookies = Array.isArray(bootstrap.headers["set-cookie"]) ? bootstrap.headers["set-cookie"] : [];
      const csrfCookie = setCookies.find((cookie) => cookie.startsWith("neurobot_csrf=")) || "";
      const sessionCookie = setCookies.find((cookie) => cookie.startsWith("neurobot_ss=")) || "";
      const csrfToken = (csrfCookie.match(/^neurobot_csrf=([^;]+)/) || [])[1] || "";
      const cookieHeader = [csrfCookie, sessionCookie]
        .map((cookie) => cookie.split(";")[0])
        .filter(Boolean)
        .join("; ");

      const streamResponse = await requestRaw(
        {
          hostname: "127.0.0.1",
          port,
          path: "/api/neurobot/chat/stream",
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: cookieHeader,
            "x-csrf-token": csrfToken,
          },
        },
        JSON.stringify({ message: "hello stream" })
      );
      const sse = streamResponse.text;

      expect(streamResponse.status).toBe(200);
      expect(sse).toContain("event: error");
      expect(sse).toContain("event: done");
      expect(sse).toContain("\"status\":\"error\"");
      expect(sse).not.toContain("\"status\":\"fallback\"");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  });
});
