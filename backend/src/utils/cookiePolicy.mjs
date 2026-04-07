import { env } from "../config/env.mjs";

const normalizeOrigin = (value = "") => {
  try {
    return new URL(String(value || "").trim()).origin.toLowerCase();
  } catch {
    return "";
  }
};

const frontendOrigin = normalizeOrigin(env.appBaseUrl || env.corsOrigins?.[0] || env.corsOrigin || "");
const backendOrigin = normalizeOrigin(env.backendPublicUrl || "");

export const usesCrossSiteCookies = Boolean(frontendOrigin && backendOrigin && frontendOrigin !== backendOrigin);

export const buildCookieOptions = (overrides = {}) => {
  const secure = usesCrossSiteCookies || env.nodeEnv === "production";
  return {
    path: "/",
    secure,
    sameSite: usesCrossSiteCookies ? "none" : env.nodeEnv === "production" ? "strict" : "lax",
    ...overrides,
  };
};
