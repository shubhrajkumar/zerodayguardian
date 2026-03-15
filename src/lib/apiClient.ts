import { toast } from "@/hooks/use-toast";
export const ACCESS_TOKEN_KEY = "neurobot_access_token";

const getCookie = (name: string) => {
  const encoded = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`))
    ?.split("=")[1];
  return encoded ? decodeURIComponent(encoded) : "";
};

export const ensureCsrf = async () => {
  if (getCookie("neurobot_csrf")) return;
  await fetch("/api/auth/csrf", { credentials: "include" });
};

export const getStoredAccessToken = () => {
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY) || "";
  } catch {
    return "";
  }
};

export const setStoredAccessToken = (token: string) => {
  try {
    if (token) localStorage.setItem(ACCESS_TOKEN_KEY, token);
  } catch {
    // ignore storage failures
  }
};

export const clearStoredAccessToken = () => {
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch {
    // ignore storage failures
  }
};

export const clearAnonymousClientState = () => {
  try {
    const keep = new Set(["theme", "theme:mode", "app:theme"]);
    const prefixes = ["neurobot:", "lab:", "tools:", "zdg:"];
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (!key || keep.has(key)) continue;
      if (prefixes.some((prefix) => key.startsWith(prefix))) localStorage.removeItem(key);
    }
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
      const key = sessionStorage.key(i);
      if (!key) continue;
      if (prefixes.some((prefix) => key.startsWith(prefix))) sessionStorage.removeItem(key);
    }
  } catch {
    // ignore storage failures
  }
};

let refreshInFlight: Promise<boolean> | null = null;
let redirectingToAuth = false;
let meRequestInFlight: Promise<Response> | null = null;
const meAbortController = new AbortController();

export class ApiError extends Error {
  status: number;

  code: string;

  details?: unknown;

  retryAfterSec?: number;

  constructor(message: string, status: number, code = "request_failed", details?: unknown, retryAfterSec?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryAfterSec = retryAfterSec;
  }
}

const triggerAuthRedirect = () => {
  if (redirectingToAuth) return;
  redirectingToAuth = true;
  toast({
    title: "Session expired, please sign in again.",
  });
  window.setTimeout(() => {
    window.location.assign("/auth");
  }, 700);
};

const tryRefreshSession = async () => {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });
      if (response.ok) {
        const payload = (await response.json()) as { accessToken?: string };
        if (payload?.accessToken) setStoredAccessToken(payload.accessToken);
      }
      return response.ok;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
};

export const apiFetch = async (url: string, init: RequestInit = {}) => {
  const method = String(init.method || "GET").toUpperCase();
  const isAuthMe = url === "/api/auth/me" && method === "GET";
  if (isAuthMe) {
    const token = getStoredAccessToken();
    if (!token) return new Response(null, { status: 401, statusText: "missing_token" });
    if (meRequestInFlight) return meRequestInFlight;
  }

  if (!["GET", "HEAD", "OPTIONS"].includes(method)) await ensureCsrf();
  const csrf = getCookie("neurobot_csrf");
  const bearer = getStoredAccessToken();
  const headers = {
    ...(init.headers || {}),
    ...(csrf && !["GET", "HEAD", "OPTIONS"].includes(method) ? { "X-CSRF-Token": csrf } : {}),
    ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
  };

  const request = () => fetch(url, { ...init, headers, credentials: "include", signal: isAuthMe ? meAbortController.signal : init.signal });
  const execute = async () => {
    const response = await request();
    return response;
  };

  let response = isAuthMe
    ? await (() => {
      meRequestInFlight = execute().finally(() => {
        meRequestInFlight = null;
      });
      return meRequestInFlight;
    })()
    : await execute();

  if (response.status === 429) {
    return response;
  }

  if (response.status !== 401 || url.startsWith("/api/auth/")) return response;

  const refreshed = await tryRefreshSession();
  if (!refreshed) {
    clearStoredAccessToken();
    triggerAuthRedirect();
    return response;
  }

  response = await request();
  if (response.status === 401) {
    clearStoredAccessToken();
    triggerAuthRedirect();
  }
  return response;
};

export const apiGetJson = async <T,>(url: string): Promise<T> => {
  const response = await apiFetch(url);
  if (!response.ok) {
    let detail = "";
    let code = "request_failed";
    let retryAfterSec = 0;
    let responsePayload: { error?: string; message?: string; code?: string; retryAfterSec?: number; llmError?: unknown } | null = null;
    const retryHeader = Number(response.headers.get("retry-after") || 0);
    if (Number.isFinite(retryHeader) && retryHeader > 0) retryAfterSec = retryHeader;
    try {
      responsePayload = (await response.json()) as {
        error?: string;
        message?: string;
        code?: string;
        retryAfterSec?: number;
        llmError?: unknown;
      };
      detail = responsePayload.error || responsePayload.message || responsePayload.code || "";
      code = responsePayload.code || code;
      retryAfterSec = Number(responsePayload.retryAfterSec || retryAfterSec || 0);
    } catch {
      // ignore parse failure
    }
    if (response.status === 429) {
      const friendly = retryAfterSec > 0 ? `Too many requests. Please retry in about ${retryAfterSec}s.` : "Too many requests. Please wait and retry.";
      throw new ApiError(friendly, 429, code || "rate_limited", { url, response: responsePayload }, retryAfterSec || undefined);
    }
    throw new ApiError(detail || `Request failed ${response.status}`, response.status, code, { url, response: responsePayload });
  }
  return response.json() as Promise<T>;
};

export const apiPostJson = async <T,>(url: string, body: unknown): Promise<T> => {
  const response = await apiFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let detail = "";
    let code = "request_failed";
    let retryAfterSec = 0;
    let responsePayload:
      | { error?: string; message?: string; code?: string; details?: string[]; retryAfterSec?: number; llmError?: unknown }
      | null = null;
    const retryHeader = Number(response.headers.get("retry-after") || 0);
    if (Number.isFinite(retryHeader) && retryHeader > 0) retryAfterSec = retryHeader;
    try {
      responsePayload = (await response.json()) as {
        error?: string;
        message?: string;
        code?: string;
        details?: string[];
        retryAfterSec?: number;
        llmError?: unknown;
      };
      detail = responsePayload.error || responsePayload.message || responsePayload.code || responsePayload.details?.[0] || "";
      code = responsePayload.code || code;
      retryAfterSec = Number(responsePayload.retryAfterSec || retryAfterSec || 0);
    } catch {
      // ignore parse failure
    }
    if (response.status === 429) {
      const friendly = retryAfterSec > 0 ? `Too many requests. Please retry in about ${retryAfterSec}s.` : "Too many requests. Please wait and retry.";
      throw new ApiError(friendly, 429, code || "rate_limited", { url, body, response: responsePayload }, retryAfterSec || undefined);
    }
    throw new ApiError(detail || `Request failed ${response.status}`, response.status, code, { url, body, response: responsePayload });
  }
  return response.json() as Promise<T>;
};

export const bootstrapAuthSession = async () => {
  const token = getStoredAccessToken();
  if (!token) return { ok: false, reason: "missing_token" as const };
  try {
    const response = await apiFetch("/api/auth/me", { method: "GET" });
    if (!response.ok) {
      clearStoredAccessToken();
      return { ok: false, reason: "invalid_token" as const };
    }
    return { ok: true as const };
  } catch {
    clearStoredAccessToken();
    return { ok: false, reason: "network_error" as const };
  }
};

// Optional helper for code paths that still use axios.
export const installAxiosAuthInterceptor = (axiosInstance: {
  defaults?: { withCredentials?: boolean };
  interceptors?: {
    request?: { use?: (fn: (config: Record<string, unknown>) => Record<string, unknown>) => void };
    response?: { use?: (onSuccess?: (response: unknown) => unknown, onRejected?: (error: { response?: { status?: number } }) => Promise<never>) => void };
  };
}) => {
  if (!axiosInstance) return;
  if (axiosInstance.defaults) axiosInstance.defaults.withCredentials = true;
  axiosInstance.interceptors?.request?.use?.((config) => {
    const next = { ...config };
    const headers = { ...(next.headers as Record<string, unknown>) };
    const token = getStoredAccessToken();
    if (token && !headers.Authorization) headers.Authorization = `Bearer ${token}`;
    next.headers = headers;
    next.withCredentials = true;
    return next;
  });
  axiosInstance.interceptors?.response?.use?.(
    (response) => response,
    async (error) => {
      const status = Number(error?.response?.status || 0);
      if (status === 401) {
        clearStoredAccessToken();
        triggerAuthRedirect();
      }
      if (status === 429) {
        toast({ title: "You are sending requests too fast. Please retry shortly." });
      }
      return Promise.reject(error);
    }
  );
};
