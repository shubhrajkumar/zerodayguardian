const trimTrailingSlash = (value: string) => String(value || "").replace(/\/+$/, "");
const isAbsoluteHttpUrl = (value: string) => /^https?:\/\//i.test(String(value || "").trim());
const readProcessEnv = (key: string) => {
  if (typeof process === "undefined" || !process?.env) return "";
  return String(process.env[key] || "");
};
const readWindowEnv = (key: string) => {
  if (typeof window === "undefined") return "";
  return String(((window as unknown as Record<string, unknown>)[key]) || "");
};

const BUILD_BACKEND_PUBLIC_URL = trimTrailingSlash(
  typeof __BACKEND_PUBLIC_URL__ === "string" ? __BACKEND_PUBLIC_URL__ : ""
);
const BUILD_PY_API_PUBLIC_URL = trimTrailingSlash(
  typeof __PY_API_PUBLIC_URL__ === "string" ? __PY_API_PUBLIC_URL__ : ""
);

export const API_BASE_URL = (() => {
  const runtimeProcessBase = trimTrailingSlash(readProcessEnv("BACKEND_PUBLIC_URL"));
  if (runtimeProcessBase) return runtimeProcessBase;
  const explicitBase = trimTrailingSlash(String(import.meta.env.VITE_API_BASE_URL || ""));
  if (explicitBase) return explicitBase;
  const runtimeWindowBase = trimTrailingSlash(readWindowEnv("BACKEND_PUBLIC_URL"));
  if (runtimeWindowBase) return runtimeWindowBase;
  if (BUILD_BACKEND_PUBLIC_URL) return BUILD_BACKEND_PUBLIC_URL;
  return "";
})();

export const PY_API_BASE_URL = (() => {
  const runtimeProcessPyBase = trimTrailingSlash(readProcessEnv("PY_API_PUBLIC_URL"));
  if (runtimeProcessPyBase) return runtimeProcessPyBase;
  const explicitPyBase = trimTrailingSlash(String(import.meta.env.VITE_PY_API_URL || ""));
  if (explicitPyBase) return explicitPyBase;
  const runtimeWindowPyBase = trimTrailingSlash(readWindowEnv("PY_API_PUBLIC_URL"));
  if (runtimeWindowPyBase) return runtimeWindowPyBase;
  if (BUILD_PY_API_PUBLIC_URL) return BUILD_PY_API_PUBLIC_URL;
  if (API_BASE_URL) return `${API_BASE_URL}/pyapi`;
  return "/pyapi";
})();

const resolveAbsoluteOrRelativeUrl = (path: string, baseUrl: string, matcher: RegExp) => {
  const normalizedPath = String(path || "").trim();
  if (!normalizedPath) return normalizedPath;
  if (isAbsoluteHttpUrl(normalizedPath)) return normalizedPath;
  if (!normalizedPath.startsWith("/")) {
    return baseUrl ? `${baseUrl}/${normalizedPath}` : normalizedPath;
  }
  if (!baseUrl || !matcher.test(normalizedPath)) return normalizedPath;
  return `${baseUrl}${normalizedPath}`;
};

export const resolveBackendUrl = (path: string) =>
  resolveAbsoluteOrRelativeUrl(path, API_BASE_URL, /^\/(api|auth)(\/|$)/i);

export const resolveApiUrl = (path: string) =>
  resolveAbsoluteOrRelativeUrl(path, API_BASE_URL, /^\/api(\/|$)/i);

export const resolvePyApiUrl = (path: string) => {
  const normalizedPath = String(path || "").trim();
  if (!normalizedPath) return normalizedPath;
  if (isAbsoluteHttpUrl(normalizedPath)) return normalizedPath;
  if (normalizedPath.startsWith("/pyapi/")) return `${PY_API_BASE_URL}${normalizedPath.slice("/pyapi".length)}`;
  if (!normalizedPath.startsWith("/")) return `${PY_API_BASE_URL}/${normalizedPath}`;
  return `${PY_API_BASE_URL}${normalizedPath}`;
};

export const hasConfiguredApiBase = Boolean(API_BASE_URL);
