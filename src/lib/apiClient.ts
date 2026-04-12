import { toast } from "@/hooks/use-toast";
import { resolveApiUrl, resolveBackendUrl } from "@/lib/apiConfig";
import { recordClientDiagnostic, recordRuntimeDebugEvent } from "@/lib/runtimeDiagnostics";
export const ACCESS_TOKEN_KEY = "neurobot_access_token";
const REFRESH_BLOCK_KEY = "neurobot_refresh_block_until";

const verboseApiLogging =
  import.meta.env.DEV ||
  String(import.meta.env.VITE_ENABLE_FIREBASE_DIAGNOSTICS || "").trim().toLowerCase() === "true";
const logDebug = (...args: unknown[]) => {
  if (!verboseApiLogging) return;
  console.info(...args);
};
const logDebugError = (...args: unknown[]) => {
  if (!verboseApiLogging) return;
  console.error(...args);
};

export const resolvePublicApiUrl = (url: string) => resolveApiUrl(url);
const CSRF_TOKEN_KEY = "neurobot_csrf_token";
let csrfTokenCache = "";

export const getCookie = (name: string) => {
  const encoded = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`))
    ?.split("=")[1];
  return encoded ? decodeURIComponent(encoded) : "";
};

const getStoredCsrfToken = () => {
  if (csrfTokenCache) return csrfTokenCache;
  try {
    const stored = sessionStorage.getItem(CSRF_TOKEN_KEY) || "";
    if (stored) csrfTokenCache = stored;
    return stored;
  } catch {
    return csrfTokenCache;
  }
};

const setStoredCsrfToken = (token: string) => {
  const normalized = String(token || "").trim();
  csrfTokenCache = normalized;
  try {
    if (normalized) sessionStorage.setItem(CSRF_TOKEN_KEY, normalized);
    else sessionStorage.removeItem(CSRF_TOKEN_KEY);
  } catch {
    // ignore storage failures
  }
  return normalized;
};

const clearStoredCsrfToken = () => {
  setStoredCsrfToken("");
};

export const ensureCsrf = async (forceRefresh = false) => {
  const existingToken = !forceRefresh ? getStoredCsrfToken() : "";
  if (existingToken) {
    logDebug(`[CSRF] Using existing token: ${existingToken.substring(0, 8)}...`);
    return existingToken;
  }

  logDebug(forceRefresh ? "[CSRF] Refreshing CSRF token from backend" : "[CSRF] No cached CSRF token found, fetching");

  try {
    const response = await fetch(resolveApiUrl("/api/auth/csrf"), {
      credentials: "include",
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`CSRF endpoint failed: ${response.status}`);
    }

    const payload = (await response.json().catch(() => ({}))) as { csrfToken?: string };
    const token = setStoredCsrfToken(String(payload?.csrfToken || "").trim() || getCookie("neurobot_csrf"));
    if (!token) {
      throw new Error("CSRF token was not returned by the backend");
    }

    logDebug(`[CSRF] Backend CSRF token ready: ${token.substring(0, 8)}...`);
    return token;
  } catch (error) {
    logDebugError("CSRF token fetch failed:", error);
    throw new Error("Unable to establish CSRF session. Check backend availability and try again.");
  }
};

export const getStoredAccessToken = () => {
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY) || "";
  } catch {
    return "";
  }
};

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const [, payload = ""] = String(token || "").split(".");
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const isStoredAccessTokenExpired = (token: string, skewSeconds = 30) => {
  const payload = decodeJwtPayload(token);
  const exp = Number(payload?.exp || 0);
  if (!exp) return false;
  return exp <= Math.floor(Date.now() / 1000) + skewSeconds;
};

export const setStoredAccessToken = (token: string) => {
  try {
    if (token) {
      localStorage.setItem(ACCESS_TOKEN_KEY, token);
      localStorage.removeItem(REFRESH_BLOCK_KEY);
    }
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
    const keep = new Set(["theme", "theme:mode", "app:theme", "auth_state"]);
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

// Enhanced authentication state management
type StoredAuthState = {
  isAuthenticated: boolean;
  user?: Record<string, unknown>;
  timestamp?: number;
};

export const getStoredAuthState = (): StoredAuthState | null => {
  try {
    const cachedAuth = localStorage.getItem("auth_state");
    if (cachedAuth) {
      const authData = JSON.parse(cachedAuth);
      if (authData.isAuthenticated && authData.user) {
        return authData;
      }
    }
    return null;
  } catch (error) {
    logDebugError("[API] Error reading stored auth state:", error);
    return null;
  }
};

export const setStoredAuthState = (authData: StoredAuthState): void => {
  try {
    localStorage.setItem("auth_state", JSON.stringify(authData));
  } catch (error) {
    logDebugError("[API] Error storing auth state:", error);
  }
};

export const clearAuthState = (): void => {
  try {
    localStorage.removeItem("auth_state");
    localStorage.removeItem(REFRESH_BLOCK_KEY);
    clearStoredAccessToken();
    clearStoredCsrfToken();
    document.cookie = "session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  } catch (error) {
    logDebugError("[API] Error clearing auth state:", error);
  }
};

export const checkAuthPersistence = async (): Promise<boolean> => {
  // First check cached auth state
  const cachedAuth = getStoredAuthState();
  if (cachedAuth && cachedAuth.isAuthenticated && cachedAuth.user) {
    logDebug("[API] Using cached authentication state");
    return true;
  }
  
  // If no cached data, check with server
  try {
    const response = await apiFetch("/api/auth/status", { method: "GET" });
    if (response.ok) {
      const data = await response.json();
      if (data.authenticated && data.user) {
        setStoredAuthState({
          isAuthenticated: true,
          user: data.user,
          timestamp: Date.now()
        });
        return true;
      }
    }
    return false;
  } catch (error) {
    logDebugError("[API] Auth persistence check failed:", error);
    return false;
  }
};

let refreshInFlight: Promise<boolean> | null = null;
let redirectingToAuth = false;
let meRequestInFlight: Promise<Response> | null = null;
const meAbortController = new AbortController();
const AUTO_RETRY_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
const makeRequestId = () => `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export class ApiError extends Error {
  status: number;

  code: string;

  details?: unknown;

  retryAfterSec?: number;

  requestId?: string;

  constructor(message: string, status: number, code = "request_failed", details?: unknown, retryAfterSec?: number, requestId?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryAfterSec = retryAfterSec;
    this.requestId = requestId;
  }
}

const emitAssistantSignal = (detail: {
  kind: "api_failure";
  url: string;
  method: string;
  status: number;
  code?: string;
}) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("assistant:signal", { detail }));
};

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

const runRefreshRequest = (url: string) => {
  const csrf = getStoredCsrfToken();
  return fetch(url, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
    },
    body: "{}",
  });
};

const getRefreshBlockUntil = () => {
  try {
    return Number(localStorage.getItem(REFRESH_BLOCK_KEY) || 0);
  } catch {
    return 0;
  }
};

const setRefreshBlockFor = (durationMs: number) => {
  try {
    localStorage.setItem(REFRESH_BLOCK_KEY, String(Date.now() + durationMs));
  } catch {
    // ignore storage failures
  }
};

const tryRefreshSession = async () => {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      if (getRefreshBlockUntil() > Date.now()) {
        return false;
      }
      await ensureCsrf();
      const refreshCandidates = [
        resolveApiUrl("/api/auth/refresh"),
        resolveBackendUrl("/auth/refresh"),
      ].filter((value, index, all) => Boolean(value) && all.indexOf(value) === index);

      for (const refreshUrl of refreshCandidates) {
        let response = await runRefreshRequest(refreshUrl);
        if (response.status === 403) {
          await ensureCsrf(true);
          response = await runRefreshRequest(refreshUrl);
        }
        if (response.status === 404) continue;
        if (response.ok) {
          const payload = (await response.json()) as { accessToken?: string };
          if (payload?.accessToken) setStoredAccessToken(payload.accessToken);
          else setRefreshBlockFor(30_000);
        } else if (response.status === 401 || response.status === 403) {
          clearAuthState();
          setRefreshBlockFor(5 * 60_000);
        } else if (response.status >= 500) {
          setRefreshBlockFor(30_000);
        }
        return response.ok;
      }
      clearAuthState();
      setRefreshBlockFor(5 * 60_000);
      return false;
    } catch {
      setRefreshBlockFor(30_000);
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
};

export const apiFetch = async (url: string, init: RequestInit = {}) => {
  const requestUrl = resolveApiUrl(url);
  const method = String(init.method || "GET").toUpperCase();
  const startTime = Date.now();
  const isAuthMe = url === "/api/users/profile" && method === "GET";
  const cachedAuth = getStoredAuthState();
  const requestId = makeRequestId();
  const maxAttempts = method === "GET" ? 2 : (requestUrl.includes("/pyapi/mission-control") ? 2 : 1);

  logDebug(`[API] ${method} ${requestUrl} - Starting request`);

  if (isAuthMe) {
    let token = getStoredAccessToken();
    if (!token) {
      if (!cachedAuth?.isAuthenticated) {
        logDebug(`[API] ${method} ${url} - No cached auth state, returning 401 without refresh`);
        return new Response(null, { status: 401, statusText: "signed_out" });
      }
      logDebug(`[API] ${method} ${url} - No access token, attempting refresh before profile request`);
      const refreshed = await tryRefreshSession();
      if (!refreshed) {
        logDebug(`[API] ${method} ${url} - No refresh session available, returning 401`);
        return new Response(null, { status: 401, statusText: "missing_token" });
      }
      token = getStoredAccessToken();
      if (!token) {
        logDebug(`[API] ${method} ${url} - Refresh succeeded without access token, returning 401`);
        return new Response(null, { status: 401, statusText: "missing_token" });
      }
    }
    if (isStoredAccessTokenExpired(token)) {
      logDebug(`[API] ${method} ${url} - Access token expired, attempting refresh before profile request`);
      const refreshed = await tryRefreshSession();
      if (!refreshed) {
        clearStoredAccessToken();
        return new Response(null, { status: 401, statusText: "expired_token" });
      }
      token = getStoredAccessToken();
      if (!token) {
        return new Response(null, { status: 401, statusText: "missing_token" });
      }
    }
    if (meRequestInFlight) {
      logDebug(`[API] ${method} ${url} - Reusing in-flight request`);
      return meRequestInFlight;
    }
  }

  // Ensure CSRF token for state-changing requests
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    logDebug(`[API] ${method} ${url} - Ensuring CSRF token`);
    await ensureCsrf();
  }

  const csrf = getStoredCsrfToken();
  let bearer = getStoredAccessToken();
  if (!bearer && cachedAuth?.isAuthenticated && !url.startsWith("/api/auth/")) {
    logDebug(`[API] ${method} ${url} - Missing bearer with authenticated session, attempting refresh`);
    const refreshed = await tryRefreshSession();
    if (refreshed) {
      bearer = getStoredAccessToken();
    }
  }
  
  logDebug(`[API] ${method} ${url} - Headers:`, {
    hasCsrf: !!csrf,
    hasBearer: !!bearer,
    csrfPreview: csrf ? csrf.substring(0, 8) + "..." : "none",
    bearerPreview: bearer ? "Bearer " + bearer.substring(0, 8) + "..." : "none"
  });

  const buildHeaders = (overrideBearer?: string) => {
    const requestHeaders = new Headers(init.headers || {});
    requestHeaders.set("X-Request-Id", requestId);
    const csrfToken = getStoredCsrfToken();
    if (csrfToken && !["GET", "HEAD", "OPTIONS"].includes(method)) requestHeaders.set("X-CSRF-Token", csrfToken);
    else requestHeaders.delete("X-CSRF-Token");
    const activeBearer = overrideBearer ?? getStoredAccessToken();
    if (activeBearer) requestHeaders.set("Authorization", `Bearer ${activeBearer}`);
    else requestHeaders.delete("Authorization");
    return requestHeaders;
  };

  const request = (overrideBearer?: string) =>
    fetch(requestUrl, {
      ...init,
      headers: buildHeaders(overrideBearer),
      credentials: "include",
      signal: isAuthMe ? meAbortController.signal : init.signal,
    });
  const execute = async () => {
    const response = await request();
    const duration = Date.now() - startTime;
    logDebug(`[API] ${method} ${requestUrl} - Response: ${response.status} (${duration}ms)`);
    recordRuntimeDebugEvent({
      level: response.ok ? "info" : "warning",
      source: "apiFetch",
      message: `${method} ${requestUrl} -> ${response.status}`,
      metadata: { requestId, duration, status: response.status },
    });
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

  let attempt = 1;
  while (attempt < maxAttempts && AUTO_RETRY_STATUS.has(response.status)) {
    const retryAfterHeader = Number(response.headers.get("retry-after") || 0);
    const backoffMs = retryAfterHeader > 0 ? retryAfterHeader * 1000 : 300 * attempt;
    recordRuntimeDebugEvent({
      level: "warning",
      source: "apiFetch",
      message: `Auto-retrying ${method} ${requestUrl}`,
      metadata: { requestId, attempt, backoffMs, status: response.status },
    });
    await sleep(backoffMs);
    response = await execute();
    attempt += 1;
  }

  const duration = Date.now() - startTime;
  logDebug(`[API] ${method} ${requestUrl} - Final response: ${response.status} (${duration}ms)`);
  if (!response.ok) {
    recordClientDiagnostic({
      level: response.status >= 500 ? "error" : "warning",
      message: `${method} ${requestUrl} failed with ${response.status}`,
      source: "apiFetch",
    });
  }

  if (response.status === 403 && !["GET", "HEAD", "OPTIONS"].includes(method)) {
    const failurePayload = await response.clone().json().catch(() => null) as { code?: string } | null;
    if (failurePayload?.code === "csrf_token_mismatch") {
      logDebug(`[API] ${method} ${requestUrl} - CSRF mismatch, refreshing backend token and retrying once`);
      clearStoredCsrfToken();
      await ensureCsrf(true);
      response = await execute();
    }
  }

  if (response.status === 429) {
    logDebug(`[API] ${method} ${requestUrl} - Rate limited (429)`);
    return response;
  }

  if (isAuthMe && response.status === 401) {
    logDebug(`[API] ${method} ${requestUrl} - Auth/me failed, clearing token`);
    clearStoredAccessToken();
    return response;
  }

  if (response.status === 401 && !bearer && !url.startsWith("/api/auth/")) {
    logDebug(`[API] ${method} ${requestUrl} - No bearer token, attempting refresh before returning 401`);
    const refreshed = await tryRefreshSession();
    if (!refreshed) {
      logDebug(`[API] ${method} ${requestUrl} - Refresh unavailable, returning 401`);
      return response;
    }
    const refreshedBearer = getStoredAccessToken();
    if (!refreshedBearer) {
      logDebug(`[API] ${method} ${requestUrl} - Refresh succeeded without stored bearer, returning 401`);
      return response;
    }
    response = await request(refreshedBearer);
  }

  if (response.status !== 401 || url.startsWith("/api/auth/")) return response;

  logDebug(`[API] ${method} ${requestUrl} - Got 401, attempting session refresh`);
  const refreshed = await tryRefreshSession();
  if (!refreshed) {
    logDebug(`[API] ${method} ${requestUrl} - Session refresh failed, redirecting to auth`);
    clearStoredAccessToken();
    triggerAuthRedirect();
    return response;
  }

  logDebug(`[API] ${method} ${requestUrl} - Session refreshed, retrying request`);
  response = await request();
  if (response.status === 401) {
    logDebug(`[API] ${method} ${requestUrl} - Still 401 after refresh, redirecting to auth`);
    clearStoredAccessToken();
    triggerAuthRedirect();
  }
  
  const finalDuration = Date.now() - startTime;
  logDebug(`[API] ${method} ${requestUrl} - Completed: ${response.status} (${finalDuration}ms)`);
  return response;
};

export const apiGetJson = async <T,>(url: string): Promise<T> => {
  const response = await apiFetch(url);
  if (!response.ok) {
    let detail = "";
    let code = "request_failed";
    let retryAfterSec = 0;
    let responsePayload: { error?: string; message?: string; code?: string; retryAfterSec?: number; requestId?: string; llmError?: unknown } | null = null;
    const retryHeader = Number(response.headers.get("retry-after") || 0);
    if (Number.isFinite(retryHeader) && retryHeader > 0) retryAfterSec = retryHeader;
    try {
      responsePayload = (await response.json()) as {
        error?: string;
        message?: string;
        code?: string;
        retryAfterSec?: number;
        requestId?: string;
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
      emitAssistantSignal({ kind: "api_failure", url, method: "GET", status: 429, code: code || "rate_limited" });
      throw new ApiError(
        friendly,
        429,
        code || "rate_limited",
        { url, response: responsePayload },
        retryAfterSec || undefined,
        responsePayload?.requestId
      );
    }
    emitAssistantSignal({ kind: "api_failure", url, method: "GET", status: response.status, code });
    throw new ApiError(
      detail || `Request failed ${response.status}`,
      response.status,
      code,
      { url, response: responsePayload },
      undefined,
      responsePayload?.requestId
    );
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
      | { error?: string; message?: string; code?: string; details?: string[]; retryAfterSec?: number; requestId?: string; llmError?: unknown }
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
        requestId?: string;
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
      emitAssistantSignal({ kind: "api_failure", url, method: "POST", status: 429, code: code || "rate_limited" });
      throw new ApiError(
        friendly,
        429,
        code || "rate_limited",
        { url, body, response: responsePayload },
        retryAfterSec || undefined,
        responsePayload?.requestId
      );
    }
    emitAssistantSignal({ kind: "api_failure", url, method: "POST", status: response.status, code });
    throw new ApiError(
      detail || `Request failed ${response.status}`,
      response.status,
      code,
      { url, body, response: responsePayload },
      undefined,
      responsePayload?.requestId
    );
  }
  return response.json() as Promise<T>;
};

export const apiPutJson = async <T,>(url: string, body: unknown): Promise<T> => {
  const response = await apiFetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let detail = "";
    let code = "request_failed";
    let retryAfterSec = 0;
    let responsePayload:
      | { error?: string; message?: string; code?: string; details?: string[]; retryAfterSec?: number; requestId?: string; llmError?: unknown }
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
        requestId?: string;
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
      emitAssistantSignal({ kind: "api_failure", url, method: "PUT", status: 429, code: code || "rate_limited" });
      throw new ApiError(
        friendly,
        429,
        code || "rate_limited",
        { url, body, response: responsePayload },
        retryAfterSec || undefined,
        responsePayload?.requestId
      );
    }
    emitAssistantSignal({ kind: "api_failure", url, method: "PUT", status: response.status, code });
    throw new ApiError(
      detail || `Request failed ${response.status}`,
      response.status,
      code,
      { url, body, response: responsePayload },
      undefined,
      responsePayload?.requestId
    );
  }
  return response.json() as Promise<T>;
};

export const apiDeleteJson = async <T,>(url: string): Promise<T> => {
  const response = await apiFetch(url, {
    method: "DELETE",
  });
  if (!response.ok) {
    let detail = "";
    let code = "request_failed";
    let retryAfterSec = 0;
    let responsePayload:
      | { error?: string; message?: string; code?: string; details?: string[]; retryAfterSec?: number; requestId?: string; llmError?: unknown }
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
        requestId?: string;
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
      emitAssistantSignal({ kind: "api_failure", url, method: "DELETE", status: 429, code: code || "rate_limited" });
      throw new ApiError(
        friendly,
        429,
        code || "rate_limited",
        { url, response: responsePayload },
        retryAfterSec || undefined,
        responsePayload?.requestId
      );
    }
    emitAssistantSignal({ kind: "api_failure", url, method: "DELETE", status: response.status, code });
    throw new ApiError(
      detail || `Request failed ${response.status}`,
      response.status,
      code,
      { url, response: responsePayload },
      undefined,
      responsePayload?.requestId
    );
  }
  return response.json() as Promise<T>;
};

export const bootstrapAuthSession = async () => {
  let token = getStoredAccessToken();
  const cachedAuth = getStoredAuthState();
  const oauthRedirectActive =
    typeof window !== "undefined" &&
    (window.location.search.includes("oauth=google") || window.location.search.includes("oauth=success"));
  if (!token) {
    if (!cachedAuth?.isAuthenticated && !oauthRedirectActive) return { ok: false, reason: "signed_out" as const };
    const refreshed = await tryRefreshSession();
    if (!refreshed) return { ok: false, reason: "missing_token" as const };
    token = getStoredAccessToken();
    if (!token) return { ok: false, reason: "missing_token" as const };
  }
  try {
    const response = await apiFetch("/api/users/profile", { method: "GET" });
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
