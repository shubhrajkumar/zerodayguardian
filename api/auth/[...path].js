import "dotenv/config";

const trimTrailingSlash = (value = "") => String(value || "").trim().replace(/\/+$/, "");
const BACKEND_BASE = trimTrailingSlash(
  process.env.BACKEND_PUBLIC_URL ||
  process.env.VITE_API_URL ||
  process.env.VITE_API_BASE_URL ||
  "https://zerodayguardian-backend.onrender.com"
);
const FRONTEND_ORIGIN = "https://zerodayguardian-delta.vercel.app";

const buildTargetUrl = (req) => {
  const incomingUrl = String(req.url || "");
  const suffix = incomingUrl.startsWith("/api/auth") ? incomingUrl.slice("/api/auth".length) : incomingUrl;
  const normalizedSuffix = suffix.startsWith("/") ? suffix : `/${suffix}`;
  return `${BACKEND_BASE}/api/auth${normalizedSuffix}`;
};

const readRequestBody = (req) =>
  new Promise((resolve, reject) => {
    if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
      resolve(Buffer.from(JSON.stringify(req.body)));
      return;
    }
    const chunks = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });

const copyHeadersToUpstream = (req) => {
  const headers = {};
  const pass = [
    "accept",
    "content-type",
    "cookie",
    "origin",
    "referer",
    "user-agent",
    "x-csrf-token",
    "x-request-id",
  ];
  for (const key of pass) {
    const value = req.headers?.[key];
    if (value == null || value === "") continue;
    headers[key] = Array.isArray(value) ? value.join(", ") : String(value);
  }
  return headers;
};

export default async function handler(req, res) {
  const method = String(req.method || "GET").toUpperCase();
  const targetUrl = buildTargetUrl(req);
  const origin = String(req.headers?.origin || "").trim();
  const allowCors = origin.toLowerCase() === FRONTEND_ORIGIN.toLowerCase();

  if (method === "OPTIONS") {
    if (allowCors) res.setHeader("Access-Control-Allow-Origin", FRONTEND_ORIGIN);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CSRF-Token, X-Request-Id, Last-Event-ID");
    if (origin && !allowCors) {
      res.status(403).json({
        status: "error",
        code: "cors_blocked",
        message: "Origin not allowed.",
      });
      return;
    }
    res.status(204).end();
    return;
  }

  try {
    const body = ["GET", "HEAD"].includes(method) ? undefined : await readRequestBody(req);
    const upstream = await fetch(targetUrl, {
      method,
      headers: copyHeadersToUpstream(req),
      body: body && body.length ? body : undefined,
      redirect: "manual",
    });

    res.statusCode = upstream.status;
    if (allowCors) res.setHeader("Access-Control-Allow-Origin", FRONTEND_ORIGIN);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    const setCookie = upstream.headers.getSetCookie?.() || [];
    if (setCookie.length) res.setHeader("set-cookie", setCookie);
    const contentType = upstream.headers.get("content-type");
    if (contentType) res.setHeader("content-type", contentType);
    const location = upstream.headers.get("location");
    if (location) res.setHeader("location", location);
    const cacheControl = upstream.headers.get("cache-control");
    if (cacheControl) res.setHeader("cache-control", cacheControl);

    const text = await upstream.text();
    res.end(text);
  } catch (error) {
    console.error("[Vercel auth proxy] request failed", {
      method,
      targetUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(503).json({
      status: "error",
      code: "auth_proxy_unavailable",
      message: "Auth service temporarily unavailable. Please retry shortly.",
    });
  }
}
