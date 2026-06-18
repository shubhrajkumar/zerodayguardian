/**
 * groqDirect — Client-side Groq API integration that fetches directly
 * from the browser using VITE_GROQ_API_KEY. Provides a self-healing
 * fallback chain so the user never sees a frozen "Not Responding" state.
 *
 * Architecture:
 *   1. Check if VITE_GROQ_API_KEY is available
 *   2. Fetch Groq API with 10s timeout + AbortController
 *   3. On any error → local mentor engine fallback
 */

import { generateLocalMentorResponse } from "@/lib/localMentorEngine";

// ── Configuration ──

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";
const TIMEOUT_MS = 10_000;
const MAX_TOKENS = 512;

// ── System Prompt ──

const ZORVIX_DIRECT_SYSTEM_PROMPT =
  "You are Zorvix, a cynical but elite AI cyber security mentor. Respond in sharp, short markdown bullet points using heavy hacker terminology.";

// ── Fallback response bank (array-picked for variety) ──

const FALLBACK_RESPONSES = [
  `Zorvix Core: Uplink interrupted by perimeter firewall. Check your VITE_GROQ_API_KEY config, Operator.

**Local Assessment:**
- API handshake failed at the transport layer
- No live model reachable — running fallback knowledge base
- Your question is noted and will be replayed when uplink restores

**Recommendation:**
- Verify the Groq API key in your \`.env\` file
- Ensure \`VITE_GROQ_API_KEY\` is set to a valid Groq key
- The local mentor engine can still guide you through most beginner-to-intermediate concepts`,

  `Zorvix Core: Backend AI endpoint unreachable. Switching to local guidance mode.

**Diagnostics:**
- Live API: TIMEOUT (no response within 10s window)
- Fallback engine: ACTIVE
- Session state: Preserved

**Next move:**
Your question hit the local knowledge base instead of the live model. Retry once the API key is configured, or continue learning with the built-in curriculum.`,

  `Zorvix Core: CORS policy blocked the outbound request to the AI provider.

**Issue:**
- The browser refused the connection to api.groq.com
- Direct Groq fetch requires the key to be embedded at build time via \`VITE_GROQ_API_KEY\`

**Workaround:**
- Local simulation engine is active and answering in real-time
- All core mentorship features work in fallback mode
- Live model responses resume when the backend proxy is configured`,

  `Zorvix Core: Uplink unstable. Running isolated mentor protocol.

**Threat Level:** Local fallback — no external data exfiltration possible.

**Capabilities in this mode:**
- ✅ Cybersecurity concept explanations
- ✅ Step-by-step lab guidance
- ✅ Career path mentorship
- ❌ Real-time threat intelligence
- ❌ Live code generation

**Push through.** The local knowledge base covers all 60 missions. Type your question and I'll guide you.`,
];

// ── Response type ──

export interface GroqDirectResult {
  reply: string;
  source: "live" | "fallback";
  error?: string;
}

// ── Core function ──

/**
 * Query the Groq API directly from the browser.
 * Falls back to the local mentor engine on any failure.
 * Never throws — always returns a reply string.
 */
export const queryGroqDirect = async (
  message: string,
  context?: { topic?: string; skillLevel?: string }
): Promise<GroqDirectResult> => {
  const trimmed = message.trim();
  if (!trimmed) {
    return {
      reply: "Zorvix Core: Empty input detected. Type a question or command to proceed, Operator.",
      source: "fallback",
    };
  }

  // ── Step 1: Check API key ──
  const apiKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined;
  if (!apiKey || !apiKey.trim() || apiKey === "your_groq_api_key_here") {
    return useLocalFallback(trimmed, context, "VITE_GROQ_API_KEY is not configured in .env");
  }

  // ── Step 2: Strict try/catch with 10s timeout ──
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: ZORVIX_DIRECT_SYSTEM_PROMPT },
          { role: "user", content: trimmed },
        ],
        temperature: 0.7,
        max_tokens: MAX_TOKENS,
      }),
      signal: controller.signal,
    });

    window.clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const errorCode = (errorBody as Record<string, unknown>)?.error?.code || response.status;
      const errorMessage = typeof errorCode === "string" ? errorCode : `HTTP ${response.status}`;
      return useLocalFallback(trimmed, context, `Groq API error: ${errorMessage}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const reply = data?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return useLocalFallback(trimmed, context, "Groq returned empty response");
    }

    return { reply, source: "live" };
  } catch (error) {
    window.clearTimeout(timeoutId);

    let errorReason = "Unknown error";
    if (error instanceof DOMException && error.name === "AbortError") {
      errorReason = "Request timed out after 10s";
    } else if (error instanceof TypeError) {
      errorReason = "Network error — CORS or DNS failure";
    } else {
      errorReason = String((error as Error)?.message || error);
    }

    return useLocalFallback(trimmed, context, errorReason);
  }
};

// ── Fallback logic ──

const useLocalFallback = (
  message: string,
  context?: { topic?: string; skillLevel?: string },
  errorReason?: string
): GroqDirectResult => {
  // Pick a random fallback response from the bank (50% chance) or use the
  // context-aware localMentorEngine for a more tailored answer
  const usePredefinedFallback = Math.random() < 0.5;

  if (usePredefinedFallback) {
    const randomIndex = Math.floor(Math.random() * FALLBACK_RESPONSES.length);
    const reply = FALLBACK_RESPONSES[randomIndex];
    return { reply, source: "fallback", error: errorReason };
  }

  const localResponse = generateLocalMentorResponse(message, {
    topic: context?.topic,
    skillLevel: (context?.skillLevel as "beginner" | "intermediate" | "advanced" | undefined) || "intermediate",
  });

  return {
    reply: `**[Local Mentor — Live AI unreachable]**\n\n${localResponse.text.replace(/^\*\*\[Local Mentor Mode — AI backend unavailable\]\*\*\n\n/, "")}`,
    source: "fallback",
    error: errorReason,
  };
};
