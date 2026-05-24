import {
  apiDeleteJson,
  apiFetch,
  apiGetJson,
  apiPostJson,
  apiPutJson,
  clearAuthState,
  resolvePublicApiUrl,
} from "@/lib/apiClient";

export const apiBaseURL = String(import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

type ApiRequestConfig = RequestInit & {
  url?: string;
  method?: string;
  data?: unknown;
};

const redirectToAuth = () => {
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/auth") return;
  window.location.assign("/auth");
};

const normalizeApiError = (error: unknown) => {
  if (error instanceof TypeError) return new Error("Connection failed");
  const status = Number((error as { status?: number })?.status || 0);
  if (status === 500) return new Error("Server error");
  return error;
};

export const api = {
  defaults: {
    baseURL: apiBaseURL,
    withCredentials: true,
  },
  interceptors: {
    request: {
      use: () => undefined,
    },
    response: {
      use: () => undefined,
    },
  },
  request: async <T = unknown>(config: ApiRequestConfig): Promise<T> => {
    try {
      const method = String(config.method || "GET").toUpperCase();
      const url = String(config.url || "");
      const headers = new Headers(config.headers || {});
      const token = localStorage.getItem("zdg_token");
      if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
      if (config.data !== undefined && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
      const response = await apiFetch(url, {
        ...config,
        method,
        headers,
        body: config.data !== undefined ? JSON.stringify(config.data) : config.body,
      });
      if (response.status === 401) {
        clearAuthState();
        localStorage.clear();
        redirectToAuth();
        throw new Error("Unauthorized");
      }
      if (response.status >= 500) throw new Error("Server error");
      return (await response.json()) as T;
    } catch (error) {
      throw normalizeApiError(error);
    }
  },
  get: <T = unknown>(url: string) => apiGetJson<T>(url),
  post: <T = unknown>(url: string, data?: unknown) => apiPostJson<T>(url, data ?? {}),
  put: <T = unknown>(url: string, data?: unknown) => apiPutJson<T>(url, data ?? {}),
  delete: <T = unknown>(url: string) => apiDeleteJson<T>(url),
  fetch: apiFetch,
  resolveUrl: resolvePublicApiUrl,
};

export default api;
