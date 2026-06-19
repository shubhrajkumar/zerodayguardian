import { Router } from "express";
import rateLimit from "express-rate-limit";

const router = Router();

const headerRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  keyGenerator: (req) => req.ip || req.connection?.remoteAddress || "unknown",
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      status: "error",
      code: "header_rate_limited",
      error: "Too many header lookups. Please wait and retry.",
    });
  },
});

// Headers that are important for security posture analysis
const SECURITY_HEADERS = [
  "strict-transport-security",
  "content-security-policy",
  "x-content-type-options",
  "x-frame-options",
  "x-xss-protection",
  "referrer-policy",
  "permissions-policy",
  "cache-control",
  "access-control-allow-origin",
  "cross-origin-opener-policy",
  "cross-origin-embedder-policy",
  "cross-origin-resource-policy",
];

router.get("/", headerRateLimit, async (req, res) => {
  try {
    let url = String(req.query.url || "").trim();

    if (!url) {
      return res.status(400).json({
        status: "error",
        code: "missing_url",
        error: "URL is required.",
      });
    }

    // Auto-prepend https:// if no protocol
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }

    // Validate URL
    let parsed;
    try {
      parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("Invalid protocol");
      }
    } catch {
      return res.status(400).json({
        status: "error",
        code: "invalid_url",
        error: "URL must be a valid HTTP or HTTPS address (e.g., https://example.com).",
      });
    }

    // Block internal/private IPs to prevent SSRF
    const hostname = parsed.hostname.toLowerCase();
    const isPrivateIp = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.|127\.|0\.0\.0\.0$)/.test(hostname);
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "[::1]" ||
      hostname === "::1" ||
      isPrivateIp ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal")
    ) {
      return res.status(400).json({
        status: "error",
        code: "blocked_target",
        error: "Internal and private hosts are not allowed.",
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let response;
    try {
      response = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": "ZeroDayGuardian/1.0 (security research tool)",
          Accept: "*/*",
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    // Extract headers into a plain object (normalized to lowercase)
    const headerEntries = Array.from(response.headers.entries());
    const rawHeaders = {};
    for (const [key, value] of headerEntries) {
      rawHeaders[key.toLowerCase()] = value;
    }

    // Security header analysis
    const presentSecurity = [];
    const missingSecurity = [];

    for (const sh of SECURITY_HEADERS) {
      if (rawHeaders[sh] !== undefined) {
        presentSecurity.push(sh);
      } else {
        missingSecurity.push(sh);
      }
    }

    // Categorize headers
    const categories = {
      security: {},
      cache: {},
      content: {},
      cors: {},
      other: {},
    };

    for (const [key, value] of Object.entries(rawHeaders)) {
      if (SECURITY_HEADERS.includes(key)) {
        categories.security[key] = value;
      } else if (
        key.startsWith("cache-") ||
        key === "expires" ||
        key === "pragma" ||
        key === "age"
      ) {
        categories.cache[key] = value;
      } else if (
        key.startsWith("content-") ||
        key === "content-type" ||
        key === "content-length" ||
        key === "content-encoding" ||
        key === "content-language" ||
        key === "content-location"
      ) {
        categories.content[key] = value;
      } else if (
        key.startsWith("access-control-") ||
        key.startsWith("cross-origin-")
      ) {
        categories.cors[key] = value;
      } else {
        categories.other[key] = value;
      }
    }

    res.json({
      status: "ok",
      url: response.url || url,
      statusCode: response.status,
      statusText: response.statusText,
      headers: rawHeaders,
      headerCount: Object.keys(rawHeaders).length,
      categories,
      security: {
        score: Math.round((presentSecurity.length / SECURITY_HEADERS.length) * 100),
        present: presentSecurity,
        missing: missingSecurity,
        total: SECURITY_HEADERS.length,
        found: presentSecurity.length,
      },
    });
  } catch (error) {
    const err = error || {};
    if (
      err.name === "AbortError" ||
      err.code === "UND_ERR_ABORTED" ||
      err.type === "aborted"
    ) {
      return res.status(504).json({
        status: "error",
        code: "upstream_timeout",
        error: "Request to target timed out. Try again later.",
      });
    }
    if (err.code === "ENOTFOUND" || err.code === "EAI_AGAIN") {
      return res.status(502).json({
        status: "error",
        code: "dns_failed",
        error: "Could not resolve the target hostname.",
      });
    }
    if (err.code === "ECONNREFUSED" || err.code === "ECONNRESET") {
      return res.status(502).json({
        status: "error",
        code: "connection_failed",
        error: "Connection to the target was refused or reset.",
      });
    }
    return res.status(500).json({
      status: "error",
      code: "header_failed",
      error: "Header inspection failed. Check the URL and try again.",
    });
  }
});

export default router;
