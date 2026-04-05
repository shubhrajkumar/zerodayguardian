import { apiFetch } from "@/lib/apiClient";
import { recordRuntimeDebugEvent } from "@/lib/runtimeDiagnostics";

const trimTrailingSlash = (value: string) => String(value || "").replace(/\/+$/, "");

const resolvePyApiBase = () => {
  const explicitPyBase = trimTrailingSlash(String(import.meta.env.VITE_PY_API_URL || ""));
  if (explicitPyBase) return explicitPyBase;

  const apiBase = trimTrailingSlash(String(import.meta.env.VITE_API_BASE_URL || ""));
  if (apiBase) return `${apiBase}/pyapi`;

  if (!import.meta.env.DEV) return "/pyapi";

  return "/pyapi";
};

const PY_API_BASE = resolvePyApiBase();

export class PyApiError extends Error {
  code: string;
  status?: number;
  requestId?: string;
  retryable?: boolean;
  userMessage: string;

  constructor(message: string, options?: { code?: string; status?: number; requestId?: string; retryable?: boolean; userMessage?: string }) {
    super(message);
    this.name = "PyApiError";
    this.code = options?.code || "pyapi_error";
    this.status = options?.status;
    this.requestId = options?.requestId;
    this.retryable = options?.retryable;
    this.userMessage = options?.userMessage || "Something went wrong while talking to the training service.";
  }
}

const unwrapPayload = <T,>(payload: unknown): T => {
  if (payload && typeof payload === "object" && "data" in (payload as Record<string, unknown>)) {
    return (payload as { data: T }).data;
  }
  return payload as T;
};

export const resolvePublicPyApiUrl = (path: string) => {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("/pyapi/")) return `${PY_API_BASE}${path.slice("/pyapi".length)}`;
  if (!path.startsWith("/")) return `${PY_API_BASE}/${path}`;
  return `${PY_API_BASE}${path}`;
};

const normalizeUrl = (path: string) => resolvePublicPyApiUrl(path);

const buildPyApiError = async (response: Response) => {
  let detail = "";
  let code = "pyapi_error";
  let requestId = response.headers.get("x-request-id") || "";
  let retryable = response.status >= 500;
  let userMessage = "";
  try {
    const payload = (await response.json()) as {
      error?: string;
      message?: string;
      code?: string;
      detail?: string;
      request_id?: string;
      retryable?: boolean;
    };
    detail = String(payload?.error || payload?.message || payload?.detail || payload?.code || "").trim();
    code = String(payload?.code || code);
    requestId = String(payload?.request_id || requestId || "");
    retryable = typeof payload?.retryable === "boolean" ? payload.retryable : retryable;
    userMessage = String(payload?.message || "").trim();
  } catch {
    detail = "";
  }
  const technicalMessage = detail ? `Python API error ${response.status}: ${detail}` : `Python API error ${response.status}`;
  const friendlyMessage =
    response.status >= 500
      ? "The training engine is having a temporary issue. Your progress is safe, and retrying in a moment should help."
      : response.status === 404
        ? "That training resource is not available yet. We can usually recover by syncing your account and retrying."
        : response.status === 401 || response.status === 403
          ? "Your session with the training service expired. Please sign in again."
          : userMessage || "We couldn't complete that training request right now.";
  return new PyApiError(technicalMessage, {
    code,
    status: response.status,
    requestId,
    retryable,
    userMessage: friendlyMessage,
  });
};

export const getPyApiUserMessage = (error: unknown, fallback = "We couldn't reach the training service right now.") => {
  if (error instanceof PyApiError) {
    return error.requestId ? `${error.userMessage} Reference: ${error.requestId}.` : error.userMessage;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

export const pyGetJson = async <T,>(path: string): Promise<T> => {
  try {
    const response = await apiFetch(normalizeUrl(path), {
      method: "GET",
    });
    if (!response.ok) {
      throw await buildPyApiError(response);
    }
    const payload = unwrapPayload<T>(await response.json());
    recordRuntimeDebugEvent({
      level: "info",
      source: "pyGetJson",
      message: `Python API GET ${path} succeeded`,
      metadata: { path, requestId: response.headers.get("x-request-id") || "" },
    });
    return payload;
  } catch (error) {
    if (error instanceof PyApiError) throw error;
    throw new PyApiError("Python API unreachable", {
      code: "pyapi_unreachable",
      userMessage: "The training service is unavailable right now. Please retry in a moment.",
      retryable: true,
    });
  }
};

export const pyPostJson = async <T,>(path: string, body: unknown): Promise<T> => {
  try {
    const response = await apiFetch(normalizeUrl(path), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw await buildPyApiError(response);
    }
    const payload = unwrapPayload<T>(await response.json());
    recordRuntimeDebugEvent({
      level: "info",
      source: "pyPostJson",
      message: `Python API POST ${path} succeeded`,
      metadata: { path, requestId: response.headers.get("x-request-id") || "" },
    });
    return payload;
  } catch (error) {
    if (error instanceof PyApiError) throw error;
    throw new PyApiError("Python API unreachable", {
      code: "pyapi_unreachable",
      userMessage: "The training service is unavailable right now. Please retry in a moment.",
      retryable: true,
    });
  }
};

export const pyPutJson = async <T,>(path: string, body: unknown): Promise<T> => {
  try {
    const response = await apiFetch(normalizeUrl(path), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw await buildPyApiError(response);
    }
    const payload = unwrapPayload<T>(await response.json());
    recordRuntimeDebugEvent({
      level: "info",
      source: "pyPutJson",
      message: `Python API PUT ${path} succeeded`,
      metadata: { path, requestId: response.headers.get("x-request-id") || "" },
    });
    return payload;
  } catch (error) {
    if (error instanceof PyApiError) throw error;
    throw new PyApiError("Python API unreachable", {
      code: "pyapi_unreachable",
      userMessage: "The training service is unavailable right now. Please retry in a moment.",
      retryable: true,
    });
  }
};
