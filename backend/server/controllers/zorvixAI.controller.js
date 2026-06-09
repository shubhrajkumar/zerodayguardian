import Groq from "groq-sdk";
import { logError, logInfo, logWarn } from "../../src/utils/logger.mjs";

// ── Groq client singleton ──────────────────────────────────────────────
// Lazy-init to avoid crashing on startup if GROQ_API_KEY is unset.
let groqClient = null;

const getClient = () => {
  if (groqClient) return groqClient;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw Object.assign(
      new Error("GROQ_API_KEY environment variable is not configured."),
      { status: 500, code: "groq_missing_key" }
    );
  }
  groqClient = new Groq({ apiKey });
  return groqClient;
};

// ── System prompt ──────────────────────────────────────────────────────
// Socratic method prevents script-kiddie behavior and forces learners to
// understand the "why" behind exploits rather than copy-pasting payloads.
const ZORVIX_SYSTEM_PROMPT = [
  "You are Zorvix, an elite cybersecurity mentor for ZeroDay Guardian.",
  "NEVER give direct answers or exploit code.",
  "Guide users using Socratic questioning, hint at methodologies (OSINT, recon, enumeration), and emphasize defensive/ethical practices.",
  "If they ask for malicious payloads, refuse and explain the legal/ethical boundary.",
  "Keep responses under 300 words. Use markdown formatting.",
].join(" ");

const MAX_MESSAGE_LENGTH = 4000;

// ── Input sanitiser ────────────────────────────────────────────────────
const sanitizeInput = (value = "") =>
  String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH);

// ── Main controller ────────────────────────────────────────────────────
/**
 * POST /api/ai/zorvix
 * Body: { message: string, userContext?: string }
 * Returns: { reply: string, timestamp: string }
 */
export const chatWithZorvix = async (req, res) => {
  const startedAt = Date.now();

  try {
    // ── 1. Validate input ──
    const { message, userContext } = req.body || {};
    const sanitizedMessage = sanitizeInput(message);

    if (!sanitizedMessage) {
      return res.status(400).json({
        error: "Validation failed",
        message: "A non-empty 'message' field is required.",
        code: "invalid_input",
      });
    }

    if (sanitizedMessage.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        error: "Validation failed",
        message: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters.`,
        code: "message_too_long",
      });
    }

    // ── 2. Build messages array ──
    // userContext lets the frontend pass session metadata (roadmap day,
    // active lab, etc.) so the mentor can give contextual guidance.
    const contextBlock =
      userContext && typeof userContext === "string"
        ? `\n\n[Student context: ${sanitizeInput(userContext).slice(0, 600)}]`
        : "";

    const messages = [
      { role: "system", content: ZORVIX_SYSTEM_PROMPT },
      { role: "user", content: sanitizedMessage + contextBlock },
    ];

    // ── 3. Call Groq API ──
    const client = getClient();
    const completion = await client.chat.completions.create({
      model: "llama3-70b-8192",
      messages,
      temperature: 0.7,
      max_tokens: 1024,
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() || "";

    if (!reply) {
      logWarn("Groq returned empty reply", {
        requestId: req.requestId || "",
        model: "llama3-70b-8192",
        usage: completion.usage || null,
      });
      return res.status(500).json({
        error: "Empty response",
        message: "The AI model returned an empty response. Please retry.",
        code: "empty_response",
      });
    }

    // ── 4. Return success ──
    const latencyMs = Date.now() - startedAt;
    logInfo("Zorvix Groq chat completed", {
      requestId: req.requestId || "",
      messageLength: sanitizedMessage.length,
      replyLength: reply.length,
      latencyMs,
      model: "llama3-70b-8192",
    });

    return res.status(200).json({
      reply,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const latencyMs = Date.now() - startedAt;

    // ── Groq SDK structured error (APIError) ──
    const status = Number(error?.status || error?.statusCode || 0);
    const errorMessage = String(error?.message || "Unknown error");

    // 400: Bad request / invalid model / malformed payload
    if (status === 400) {
      logWarn("Groq 400 Bad Request", {
        requestId: req.requestId || "",
        message: errorMessage,
        latencyMs,
      });
      return res.status(400).json({
        error: "Bad request",
        message: "The request was rejected by the AI provider. Check input format.",
        code: "bad_request",
      });
    }

    // 401/403: Authentication / authorization failure
    if (status === 401 || status === 403) {
      logError("Groq auth failure — check GROQ_API_KEY", error, {
        requestId: req.requestId || "",
        status,
        latencyMs,
      });
      return res.status(500).json({
        error: "Provider authentication failed",
        message: "The AI provider API key is invalid or expired.",
        code: "groq_auth_error",
      });
    }

    // 429: Rate limit / quota exceeded
    if (status === 429) {
      logWarn("Groq rate limit / quota exceeded", {
        requestId: req.requestId || "",
        message: errorMessage,
        latencyMs,
      });
      return res.status(429).json({
        error: "Rate limited",
        message:
          "You've hit the AI provider rate limit. Please wait a moment and retry.",
        code: "rate_limit",
        retryAfterSec: 30,
      });
    }

    // 404: Model not found
    if (status === 404) {
      logError("Groq model not found", error, {
        requestId: req.requestId || "",
        model: "llama3-70b-8192",
        latencyMs,
      });
      return res.status(500).json({
        error: "Model unavailable",
        message: "The requested AI model is not available.",
        code: "model_not_found",
      });
    }

    // 500+: Groq server-side error
    if (status >= 500) {
      logError("Groq upstream error", error, {
        requestId: req.requestId || "",
        status,
        latencyMs,
      });
      return res.status(502).json({
        error: "Provider error",
        message: "The AI provider encountered a server error. Please retry.",
        code: "upstream_error",
      });
    }

    // ── Network / DNS / timeout / unknown errors ──
    const isNetworkError =
      error?.code === "ECONNREFUSED" ||
      error?.code === "ENOTFOUND" ||
      error?.code === "ETIMEDOUT" ||
      error?.code === "ECONNRESET" ||
      /network|dns|timeout|fetch/i.test(errorMessage);

    if (isNetworkError) {
      logError("Groq network error", error, {
        requestId: req.requestId || "",
        code: error?.code || "",
        latencyMs,
      });
      return res.status(502).json({
        error: "Network error",
        message:
          "Could not reach the AI provider. Check network connectivity.",
        code: "network_error",
      });
    }

    // Catch-all: unknown / unexpected errors
    logError("Zorvix Groq chat failed (unexpected)", error, {
      requestId: req.requestId || "",
      status,
      message: errorMessage,
      latencyMs,
    });
    return res.status(500).json({
      error: "Internal error",
      message: "An unexpected error occurred. Please retry.",
      code: "internal_error",
    });
  }
};
