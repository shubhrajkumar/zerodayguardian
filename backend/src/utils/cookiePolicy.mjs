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

export const usesCrossSiteCookies = Boolean(frontendOrigin && backendOrigin && frontendOrigin !== backendOrigin);

export const buildCookieOptions = (overrides = {}) => {
  const isProduction = env.nodeEnv === "production";
  const secure = isProduction ? true : usesCrossSiteCookies;
  const sameSite = isProduction ? "none" : usesCrossSiteCookies ? "none" : "lax";
  return {
    path: "/",
    secure,
    sameSite,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
    ...overrides,
  };
};
