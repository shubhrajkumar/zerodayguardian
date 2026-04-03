import { requestLlm, classifyLlmError } from "../../src/services/llmService.mjs";
import { sanitizeText } from "../../src/utils/security.mjs";
import { env } from "../../src/config/env.mjs";
import { canAttempt, recordFailure, recordSuccess } from "./circuitBreaker.js";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withTimeout = async (promise, timeoutMs = 20_000) => {
  let timer = null;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error("chat_timeout");
          error.code = "chat_timeout";
          reject(error);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

export const runChat = async ({ message, requestId = "", topic = null }) => {
  const clean = sanitizeText(message || "").trim();
  if (!clean) {
    const error = new Error("Message is required");
    error.status = 400;
    throw error;
  }

  if (!canAttempt()) {
    const error = new Error("Mentor service is temporarily degraded. Please retry shortly.");
    error.status = 503;
    error.code = "circuit_open";
    throw error;
  }

  const attemptDelays = [1000, 2000, 4000];
  let lastError = null;

  for (let i = 0; i < attemptDelays.length; i += 1) {
    try {
      const reply = await withTimeout(
        requestLlm({
          messages: [
            {
              id: `user-${Date.now()}`,
              role: "user",
              content: clean,
              timestamp: Date.now(),
            },
          ],
          topic,
          correlationId: requestId,
          timeoutMs: Math.min(20_000, env.llmCriticalTimeoutMs),
        }),
        20_000
      );
      recordSuccess("chat_endpoint");
      return { reply: String(reply || "") };
    } catch (error) {
      lastError = error;
      recordFailure("chat_endpoint");
      const failure = classifyLlmError(error);
      if (!failure.retryable || i === attemptDelays.length - 1) break;
      await delay(attemptDelays[i]);
    }
  }

  throw lastError || new Error("chat_failed");
};
