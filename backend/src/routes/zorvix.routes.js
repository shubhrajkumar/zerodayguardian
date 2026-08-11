import { Router } from "express";
import rateLimit from "express-rate-limit";
import { chatWithZorvix } from "../controllers/zorvixAI.controller.js";

const router = Router();

// ── Rate limiter ───────────────────────────────────────────────────────
// 20 requests per 15 minutes per IP. Prevents a single user from burning
// through the Groq free-tier quota and degrading the experience for
// other students. Uses standard headers so clients can self-throttle.
const zorvixRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers (less info leakage)
  keyGenerator: (req) => {
    // Combine IP + authenticated user ID when available for fairer limiting
    const userId = req.user?.sub || req.user?.id || "anon";
    return `${req.ip}:${userId}`;
  },
  handler: (_req, res) => {
    res.status(429).json({
      error: "Rate limit exceeded",
      message:
        "Too many Zorvix requests. Please wait before sending another message.",
      code: "zorvix_rate_limited",
      retryAfterSec: 15 * 60, // 15 minutes in seconds
    });
  },
});

// ── POST /api/ai/zorvix ────────────────────────────────────────────────
// Public endpoint — no auth required so unauthenticated students can
// still experience the Socratic mentor (rate-limited by IP).
router.post("/", zorvixRateLimit, chatWithZorvix);

export default router;
