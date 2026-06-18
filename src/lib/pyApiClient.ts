import pyapi from "@/lib/pyapi";
import { AxiosError } from "axios";
import { resolvePyApiUrl } from "@/lib/apiConfig";
import { recordRuntimeDebugEvent } from "@/lib/runtimeDiagnostics";

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

export const resolvePublicPyApiUrl = (path: string) => resolvePyApiUrl(path);

const normalizeUrl = (path: string) => {
  // The axios instance already has PY_API_BASE_URL as its baseURL,
  // so resolvePyApiUrl would double-prefix (e.g., /pyapi/pyapi/users).
  // Just return the path as-is and let axios combine it with baseURL.
  if (/^https?:\/\//i.test(path)) return path;
  return path.startsWith("/") ? path : `/${path}`;
};

const buildPyApiErrorFromAxios = (error: AxiosError) => {
  const response = error.response;
  const status = response?.status || 0;
  const data = (response?.data || {}) as Record<string, unknown>;
  const detail = String(data?.error || data?.message || data?.detail || data?.code || "").trim();
  const code = String(data?.code || "pyapi_error");
  const requestId = String(data?.request_id || response?.headers?.["x-request-id"] || "");
  const retryable = typeof data?.retryable === "boolean" ? data.retryable : status >= 500;
  const userMessage = String(data?.message || "").trim();

  const technicalMessage = detail ? `Python API error ${status}: ${detail}` : `Python API error ${status}`;
  const friendlyMessage =
    status >= 500
      ? "The training engine is having a temporary issue. Your progress is safe, and retrying in a moment should help."
      : status === 404
        ? "That training resource is not available yet. We can usually recover by syncing your account and retrying."
        : status === 401 || status === 403
          ? "Your session with the training service expired. Please sign in again."
          : userMessage || "We couldn't complete that training request right now.";
  return new PyApiError(technicalMessage, {
    code,
    status,
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
    const response = await pyapi.get(normalizeUrl(path));
    const payload = unwrapPayload<T>(response.data);
    recordRuntimeDebugEvent({
      level: "info",
      source: "pyGetJson",
      message: `Python API GET ${path} succeeded`,
      metadata: { path, requestId: response.headers?.["x-request-id"] || "" },
    });
    return payload;
  } catch (error) {
    if (error instanceof AxiosError) throw buildPyApiErrorFromAxios(error);
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
    const response = await pyapi.post(normalizeUrl(path), body);
    const payload = unwrapPayload<T>(response.data);
    recordRuntimeDebugEvent({
      level: "info",
      source: "pyPostJson",
      message: `Python API POST ${path} succeeded`,
      metadata: { path, requestId: response.headers?.["x-request-id"] || "" },
    });
    return payload;
  } catch (error) {
    if (error instanceof AxiosError) throw buildPyApiErrorFromAxios(error);
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
    const response = await pyapi.put(normalizeUrl(path), body);
    const payload = unwrapPayload<T>(response.data);
    recordRuntimeDebugEvent({
      level: "info",
      source: "pyPutJson",
      message: `Python API PUT ${path} succeeded`,
      metadata: { path, requestId: response.headers?.["x-request-id"] || "" },
    });
    return payload;
  } catch (error) {
    if (error instanceof AxiosError) throw buildPyApiErrorFromAxios(error);
    if (error instanceof PyApiError) throw error;
    throw new PyApiError("Python API unreachable", {
      code: "pyapi_unreachable",
      userMessage: "The training service is unavailable right now. Please retry in a moment.",
      retryable: true,
    });
  }
};
