import { env } from "../config/env.mjs";

const normalizeOrigin = (value = "") => {
  try {
    return new URL(String(value || "").trim()).origin.toLowerCase();
  } catch {
    return "";
  }
};
const normalizeCookieDomain = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return raw.replace(/^\.+/, "").replace(/\/.*$/, "").replace(/:\d+$/, "").toLowerCase();
  }
};
const LOCALHOST_LIKE_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

const frontendOrigin = normalizeOrigin(env.appBaseUrl || env.corsOrigins?.[0] || env.corsOrigin || "");
const backendOrigin = normalizeOrigin(env.backendPublicUrl || "");
const derivedCookieDomain = normalizeCookieDomain(env.cookieDomain || "");
const cookieDomain = LOCALHOST_LIKE_HOSTS.has(derivedCookieDomain) ? "" : derivedCookieDomain;

/** Whether the frontend and backend are on different origins (cross-site deployment). */
export const usesCrossSiteCookies = Boolean(frontendOrigin && backendOrigin && frontendOrigin !== backendOrigin);

/**
 * Build cookie options with Secure + HttpOnly flags.
 *
 * Security flags:
 * - httpOnly: true  — Prevents client-side JS from reading the cookie (mitigates XSS).
 * - secure: true in production — Ensures cookie is only sent over HTTPS.
 * - sameSite: "none" in production — Required when frontend/backend are on different origins.
 *
 * In local development (HTTP), `secure` is disabled and `sameSite` is "lax"
 * because sameSite="none" requires secure=true per browser spec.
 */
export const buildCookieOptions = (overrides = {}) => {
  const isSecureEnv = env.nodeEnv === "production";
  return {
    path: "/",
    // HttpOnly — prevents XSS-based cookie theft
    httpOnly: true,
    // Secure — only sent over HTTPS in production; local dev on HTTP omits this
    secure: isSecureEnv,
    // SameSite: "none" + Secure required for cross-origin; "lax" for local dev
    sameSite: isSecureEnv ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
    ...overrides,
  };
};
