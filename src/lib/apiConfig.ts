const trimTrailingSlash = (value: string) => String(value || "").replace(/\/+$/, "");
const isAbsoluteHttpUrl = (value: string) => /^https?:\/\//i.test(String(value || "").trim());
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);
const DEFAULT_API_BASE = "https://zerodayguardian-backend.onrender.com";

const readProcessEnv = (key: string) => {
  if (typeof process === "undefined" || !process?.env) return "";
  return String(process.env[key] || "");
};

const readWindowEnv = (key: string) => {
  if (typeof window === "undefined") return "";
  return String((window as unknown as Record<string, unknown>)[key] || "");
};

const readWindowOrigin = () => {
  if (typeof window === "undefined") return "";
  return trimTrailingSlash(window.location.origin || "");
};

const normalizeBaseUrl = (value: string) => {
  const raw = trimTrailingSlash(String(value || "").trim());
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    parsed.search = "";
    parsed.hash = "";
    return trimTrailingSlash(parsed.toString());
  } catch {
    return "";
  }
};

const isLocalOrigin = (value: string) => {
  try {
    return LOCAL_HOSTS.has(new URL(value).hostname.toLowerCase());
  } catch {
    return false;
  }
};
const isVercelOrigin = (value: string) => {
  try {
    return new URL(value).hostname.toLowerCase().endsWith(".vercel.app");
  } catch {
    return false;
  }
};
const isRenderOrigin = (value: string) => {
  try {
    return new URL(value).hostname.toLowerCase().endsWith(".onrender.com");
  } catch {
    return false;
  }
};

const BUILD_BACKEND_PUBLIC_URL = normalizeBaseUrl(
  typeof __BACKEND_PUBLIC_URL__ === "string" ? __BACKEND_PUBLIC_URL__ : ""
);
const BUILD_PY_API_PUBLIC_URL = normalizeBaseUrl(
  typeof __PY_API_PUBLIC_URL__ === "string" ? __PY_API_PUBLIC_URL__ : ""
);
const WINDOW_ORIGIN = normalizeBaseUrl(readWindowOrigin());
const sameOriginOverrideRaw = String(import.meta.env.VITE_FORCE_SAME_ORIGIN_API || readWindowEnv("VITE_FORCE_SAME_ORIGIN_API") || "")
  .trim()
  .toLowerCase();
const forceSameOriginApi =
  sameOriginOverrideRaw
    ? sameOriginOverrideRaw === "true"
    : isVercelOrigin(WINDOW_ORIGIN);

const LOCAL_DEV_BACKEND_BASE = isLocalOrigin(WINDOW_ORIGIN) ? WINDOW_ORIGIN : "";
const SAME_ORIGIN_VERCEL_API_BASE = isVercelOrigin(WINDOW_ORIGIN) ? WINDOW_ORIGIN : "";

export const API_BASE_URL = (() => {
  const runtimeProcessBase = normalizeBaseUrl(readProcessEnv("VITE_API_URL") || readProcessEnv("BACKEND_PUBLIC_URL"));
  if (runtimeProcessBase) {
    if (forceSameOriginApi && SAME_ORIGIN_VERCEL_API_BASE && isRenderOrigin(runtimeProcessBase)) return SAME_ORIGIN_VERCEL_API_BASE;
    return runtimeProcessBase;
  }
  const explicitBase = normalizeBaseUrl(String(import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || ""));
  if (explicitBase) {
    if (forceSameOriginApi && SAME_ORIGIN_VERCEL_API_BASE && isRenderOrigin(explicitBase)) return SAME_ORIGIN_VERCEL_API_BASE;
    return explicitBase;
  }
  const runtimeWindowBase = normalizeBaseUrl(readWindowEnv("VITE_API_URL") || readWindowEnv("BACKEND_PUBLIC_URL"));
  if (runtimeWindowBase) {
    if (forceSameOriginApi && SAME_ORIGIN_VERCEL_API_BASE && isRenderOrigin(runtimeWindowBase)) return SAME_ORIGIN_VERCEL_API_BASE;
    return runtimeWindowBase;
  }
  if (BUILD_BACKEND_PUBLIC_URL) {
    if (forceSameOriginApi && SAME_ORIGIN_VERCEL_API_BASE && isRenderOrigin(BUILD_BACKEND_PUBLIC_URL)) return SAME_ORIGIN_VERCEL_API_BASE;
    return BUILD_BACKEND_PUBLIC_URL;
  }
  if (SAME_ORIGIN_VERCEL_API_BASE) return SAME_ORIGIN_VERCEL_API_BASE;
  if (LOCAL_DEV_BACKEND_BASE) return LOCAL_DEV_BACKEND_BASE;
  return DEFAULT_API_BASE;
})();

export const API_BASE = API_BASE_URL;

export const PY_API_BASE_URL = (() => {
  const runtimeProcessPyBase = normalizeBaseUrl(readProcessEnv("PY_API_PUBLIC_URL"));
  if (runtimeProcessPyBase) return runtimeProcessPyBase;
  const explicitPyBase = normalizeBaseUrl(String(import.meta.env.VITE_PY_API_URL || ""));
  if (explicitPyBase) return explicitPyBase;
  const runtimeWindowPyBase = normalizeBaseUrl(readWindowEnv("PY_API_PUBLIC_URL"));
  if (runtimeWindowPyBase) return runtimeWindowPyBase;
  if (BUILD_PY_API_PUBLIC_URL) return BUILD_PY_API_PUBLIC_URL;
  if (API_BASE_URL) return `${API_BASE_URL}/pyapi`;
  if (LOCAL_DEV_BACKEND_BASE) return `${LOCAL_DEV_BACKEND_BASE}/pyapi`;
  return "";
})();

const joinUrl = (baseUrl: string, path: string) => `${trimTrailingSlash(baseUrl)}${path.startsWith("/") ? path : `/${path}`}`;

const resolveAbsoluteUrl = (path: string, baseUrl: string, matcher: RegExp) => {
  const normalizedPath = String(path || "").trim();
  if (!normalizedPath) return normalizedPath;
  if (isAbsoluteHttpUrl(normalizedPath)) return normalizedPath;
  if (!normalizedPath.startsWith("/")) {
    return baseUrl ? joinUrl(baseUrl, normalizedPath) : normalizedPath;
  }
  if (!matcher.test(normalizedPath)) return normalizedPath;
  if (baseUrl) return joinUrl(baseUrl, normalizedPath);
  return WINDOW_ORIGIN ? joinUrl(WINDOW_ORIGIN, normalizedPath) : normalizedPath;
};

export const resolveBackendUrl = (path: string) =>
  resolveAbsoluteUrl(path, API_BASE_URL, /^\/(api|auth)(\/|$)/i);

export const resolveApiUrl = (path: string) =>
  resolveAbsoluteUrl(path, API_BASE_URL, /^\/api(\/|$)/i);

export const resolvePyApiUrl = (path: string) => {
  const normalizedPath = String(path || "").trim();
  if (!normalizedPath) return normalizedPath;
  if (isAbsoluteHttpUrl(normalizedPath)) return normalizedPath;
  if (!PY_API_BASE_URL) return WINDOW_ORIGIN ? joinUrl(WINDOW_ORIGIN, normalizedPath) : normalizedPath;
  if (normalizedPath.startsWith("/pyapi/")) return `${PY_API_BASE_URL}${normalizedPath.slice("/pyapi".length)}`;
  return joinUrl(PY_API_BASE_URL, normalizedPath);
};

export const hasConfiguredApiBase = Boolean(API_BASE_URL && !isLocalOrigin(API_BASE_URL));
