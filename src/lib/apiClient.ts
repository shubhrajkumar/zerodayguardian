import { toast } from "@/hooks/use-toast";
import { resolveApiUrl, resolveBackendUrl } from "@/lib/apiConfig";
import { recordClientDiagnostic, recordRuntimeDebugEvent } from "@/lib/runtimeDiagnostics";

// Session auth lives in httpOnly cookies set by the backend — the client never
// persists tokens to localStorage. CSRF tokens are stored in sessionStorage only.

const REFRESH_BLOCK_KEY = "neurobot_refresh_block_until";
const CSRF_TOKEN_KEY = "neurobot_csrf_token";

const verboseApiLogging =
  String(import.meta.env.VITE_ENABLE_FIREBASE_DIAGNOSTICS || "").trim().toLowerCase() === "true";
const logDebug = (...args: unknown[]) => {
  if (!verboseApiLogging) return;
  // Use console.debug so messages are hidden at default log level in dev tools
  console.debug(...args);
};
const logDebugError = (...args: unknown[]) => {
  if (!verboseApiLogging) return;
  console.error(...args);
};

export const resolvePublicApiUrl = (url: string) => resolveApiUrl(url);

export const getCookie = (name: string) => {
  const encoded = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`))
    ?.split("=")[1];
  return encoded ? decodeURIComponent(encoded) : "";
};

const getStoredCsrfToken = () => {
  try {
    return sessionStorage.getItem(CSRF_TOKEN_KEY) || "";
  } catch {
    return "";
  }
};

const setStoredCsrfToken = (token: string) => {
  const normalized = String(token || "").trim();
  try {
    if (normalized) sessionStorage.setItem(CSRF_TOKEN_KEY, normalized);
    else sessionStorage.removeItem(CSRF_TOKEN_KEY);
  } catch {
    // ignore storage failures
  }
  return normalized;
};

const getCsrfToken = () => getStoredCsrfToken() || getCookie("neurobot_csrf");

export const ensureCsrf = async () => {
  const existingToken = getCsrfToken();
  if (existingToken) {
    logDebug(`[CSRF] Using existing token: ${existingToken.substring(0, 8)}...`);
    return existingToken;
  }

  logDebug("[CSRF] No existing token found, fetching new CSRF token");

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

    logDebug(`[CSRF] Successfully fetched new token: ${token.substring(0, 8)}...`);
    return token;
  } catch (error) {
    logDebugError("CSRF token fetch failed:", error);
    throw new Error("Unable to establish CSRF session. Check backend availability and try again.");
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

/**
 * Purge any legacy token keys that may remain from older sessions, plus CSRF
 * state. The actual auth session is revoked server-side via /api/auth/logout
 * which clears the httpOnly cookies.
 */
export const clearAuthState = (): void => {
  try {
    localStorage.removeItem("zdg_token");
    localStorage.removeItem("zdg_refresh");
    localStorage.removeItem("auth_state");
    localStorage.removeItem("zdg_user");
    localStorage.removeItem("neurobot_access_token");
    localStorage.removeItem(REFRESH_BLOCK_KEY);
    setStoredCsrfToken("");
    // Expire the session cookies in the browser (best-effort — the server also
    // clears them via /api/auth/logout)
    document.cookie = "zdg_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = "zdg_refresh=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = "neurobot_at=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = "neurobot_rt=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = "session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  } catch (error) {
    logDebugError("[API] Error clearing auth state:", error);
  }
};

let refreshInFlight: Promise<boolean> | null = null;
let redirectingToAuth = false;
const AUTO_RETRY_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const AUTH_ROUTE_PATTERN = /^\/api\/auth\//i;
const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
const isNetworkFetchError = (error: unknown) => {
  if (!(error instanceof TypeError)) return false;
  const message = String(error.message || "").toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("network error") ||
    message.includes("load failed") ||
    message.includes("connection")
  );
};
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

const toNetworkApiError = (error: unknown, url: string, method: string) => {
  // Trigger server wake-up banner for network errors (likely cold start)
  triggerServerWakeUp();
  return new ApiError(
    "Backend connection was interrupted. Retrying usually fixes this on cold start.",
    503,
    "network_error",
    { url, method, cause: String((error as Error)?.message || error) }
  );
};

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

let serverWakeUpShown = false;

const triggerServerWakeUp = () => {
  if (serverWakeUpShown) return;
  serverWakeUpShown = true;
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("server-waking-up"));
  // Reset the flag after 60 seconds so it can fire again if needed
  setTimeout(() => { serverWakeUpShown = false; }, 60_000);
};

const triggerAuthRedirect = () => {
  if (redirectingToAuth) return;

  // Don't redirect on public routes — landing page, auth page, etc.
  const currentPath =
    typeof window !== "undefined" ? window.location.pathname : "";
  const publicRoutes = [
    "/",
    "/auth",
    "/about",
    "/privacy",
    "/terms",
    "/contact",
    "/labs",
    "/labs/demo-nmap",
    "/demo/assessment",
    "/demo/roadmap",
  ];
  if (publicRoutes.some((route) => currentPath === route || currentPath.startsWith(route + "/"))) {
    return;
  }

  redirectingToAuth = true;
  toast({
    title: "Session expired, please sign in again.",
  });
  window.setTimeout(() => {
    window.location.assign("/auth");
  }, 700);
};

const runRefreshRequest = async (url: string) => {
  const csrf = getCsrfToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(csrf ? { "X-CSRF-Token": csrf } : {}),
  };
  return fetch(url, {
    method: "POST",
    credentials: "include",
    headers,
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
          await ensureCsrf();
          response = await runRefreshRequest(refreshUrl);
        }
        if (response.status === 404) continue;
        if (response.ok) {
          return true;
        }
        if (response.status === 401 || response.status === 403) {
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
  const requestId = makeRequestId();
  const isAuthRoute = AUTH_ROUTE_PATTERN.test(url);
  const maxAttempts =
    method === "GET" ? 2 : isAuthRoute ? 3 : requestUrl.includes("/pyapi/mission-control") ? 2 : 1;
  const maxNetworkAttempts = isAuthRoute ? 3 : method === "GET" ? 2 : 1;

  // Reset server wake-up flag on each new request
  if (!isAuthRoute) {
    serverWakeUpShown = false;
  }

  logDebug(`[API] ${method} ${requestUrl} - Starting request`);

  // Ensure CSRF token for state-changing requests
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    logDebug(`[API] ${method} ${requestUrl} - Ensuring CSRF token`);
    await ensureCsrf();
  }

  const csrf = getCsrfToken();

  logDebug(`[API] ${method} ${requestUrl} - Headers:`, {
    hasCsrf: !!csrf,
    csrfPreview: csrf ? csrf.substring(0, 8) + "..." : "none",
  });

  const headers = {
    ...(init.headers || {}),
    "X-Request-Id": requestId,
    ...(csrf && !["GET", "HEAD", "OPTIONS"].includes(method) ? { "X-CSRF-Token": csrf } : {}),
  };

  const request = () => fetch(requestUrl, { ...init, headers, credentials: "include" });
  const execute = async () => {
    let lastNetworkError: unknown = null;
    for (let networkAttempt = 1; networkAttempt <= maxNetworkAttempts; networkAttempt += 1) {
      try {
        const response = await request();
        const duration = Date.now() - startTime;
        logDebug(`[API] ${method} ${requestUrl} - Response: ${response.status} (${duration}ms)`);
        recordRuntimeDebugEvent({
          level: response.ok ? "info" : "warning",
          source: "apiFetch",
          message: `${method} ${requestUrl} -> ${response.status}`,
          metadata: { requestId, duration, status: response.status, networkAttempt },
        });
        return response;
      } catch (error) {
        if (!isNetworkFetchError(error) || networkAttempt >= maxNetworkAttempts) {
          if (isNetworkFetchError(error)) throw toNetworkApiError(error, url, method);
          throw error;
        }
        lastNetworkError = error;
        const backoffMs = 450 * networkAttempt;
        recordRuntimeDebugEvent({
          level: "warning",
          source: "apiFetch",
          message: `Network retry ${networkAttempt} for ${method} ${requestUrl}`,
          metadata: { requestId, backoffMs, cause: String((error as Error)?.message || error) },
        });
        await sleep(backoffMs);
      }
    }
    throw toNetworkApiError(lastNetworkError, url, method);
  };

  let response = await execute();

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

  if (response.status === 429) {
    logDebug(`[API] ${method} ${requestUrl} - Rate limited (429)`);
    return response;
  }

  if (response.status !== 401 || isAuthRoute) return response;

  logDebug(`[API] ${method} ${requestUrl} - Got 401, attempting session refresh`);
  const refreshed = await tryRefreshSession();
  if (!refreshed) {
    logDebug(`[API] ${method} ${requestUrl} - Session refresh failed, redirecting to auth`);
    triggerAuthRedirect();
    return response;
  }

  logDebug(`[API] ${method} ${requestUrl} - Session refreshed, retrying request`);
  response = await request();
  if (response.status === 401) {
    logDebug(`[API] ${method} ${requestUrl} - Still 401 after refresh, redirecting to auth`);
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
    // 403 Forbidden — provide actionable guidance
    if (response.status === 403) {
      const message = detail || "Access denied. This may be a CORS, CSRF, or permission issue."
        + (code === "cors_blocked" ? " The backend is blocking requests from this origin." : "")
        + (code === "rbac_forbidden" ? " You do not have permission to access this resource." : "")
        + (code === "csrf_failed" ? " Session expired — please reload the page." : "");
      emitAssistantSignal({ kind: "api_failure", url, method: "GET", status: 403, code });
      throw new ApiError(message, 403, code, { url, response: responsePayload }, undefined, responsePayload?.requestId);
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
    if (response.status === 403) {
      const message = detail || "Access denied. This may be a CORS, CSRF, or permission issue."
        + (code === "cors_blocked" ? " The backend is blocking requests from this origin." : "")
        + (code === "rbac_forbidden" ? " You do not have permission to access this resource." : "")
        + (code === "csrf_failed" ? " Session expired — please reload the page." : "");
      emitAssistantSignal({ kind: "api_failure", url, method: "POST", status: 403, code });
      throw new ApiError(message, 403, code, { url, body, response: responsePayload }, undefined, responsePayload?.requestId);
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
    if (response.status === 403) {
      const message = detail || "Access denied. This may be a CORS, CSRF, or permission issue."
        + (code === "cors_blocked" ? " The backend is blocking requests from this origin." : "")
        + (code === "rbac_forbidden" ? " You do not have permission to access this resource." : "")
        + (code === "csrf_failed" ? " Session expired — please reload the page." : "");
      emitAssistantSignal({ kind: "api_failure", url, method: "PUT", status: 403, code });
      throw new ApiError(message, 403, code, { url, body, response: responsePayload }, undefined, responsePayload?.requestId);
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
    if (response.status === 403) {
      const message = detail || "Access denied. This may be a CORS, CSRF, or permission issue."
        + (code === "cors_blocked" ? " The backend is blocking requests from this origin." : "")
        + (code === "rbac_forbidden" ? " You do not have permission to access this resource." : "")
        + (code === "csrf_failed" ? " Session expired — please reload the page." : "");
      emitAssistantSignal({ kind: "api_failure", url, method: "DELETE", status: 403, code });
      throw new ApiError(message, 403, code, { url, response: responsePayload }, undefined, responsePayload?.requestId);
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

// Optional helper for code paths that still use axios.
export const installAxiosAuthInterceptor = (axiosInstance: {
  defaults?: { withCredentials?: boolean };
  interceptors?: {
    request?: { use?: (fn: (config: Record<string, unknown>) => Record<string, unknown>) => void };
    response?: { use?: (onSuccess?: (response: unknown) => unknown, onRejected?: (error: { response?: { status?: number } }) => Promise<never>) => void };
  };
}) => {
  if (!axiosInstance) return;
  // Auth is cookie-based — the browser sends httpOnly cookies automatically.
  if (axiosInstance.defaults) axiosInstance.defaults.withCredentials = true;
  axiosInstance.interceptors?.request?.use?.((config) => {
    const next = { ...config };
    next.withCredentials = true;
    return next;
  });
  axiosInstance.interceptors?.response?.use?.(
    (response) => response,
    async (error) => {
      const status = Number(error?.response?.status || 0);
      if (status === 401) {
        const refreshed = await tryRefreshSession();
        if (!refreshed) triggerAuthRedirect();
      }
      if (status === 429) {
        toast({ title: "You are sending requests too fast. Please retry shortly." });
      }
      return Promise.reject(error);
    }
  );
};
