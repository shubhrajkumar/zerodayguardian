import axios from 'axios';
import { API_BASE_URL } from '@/lib/apiConfig';
import toast from 'react-hot-toast';

const resolvedBaseUrl = API_BASE_URL || '';

const api = axios.create({
  baseURL: resolvedBaseUrl,
  withCredentials: true,
  timeout: 35000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// ── Request deduplication ──
// Prevents firing duplicate GET requests for the same URL simultaneously
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pendingRequests = new Map<string, Promise<any>>();

// Extend the Axios request config type to support our custom _retry flag
interface ExtendedRequestConfig {
  _retry?: boolean;
  [key: string]: unknown;
}

function getRequestKey(config: { method?: string; url?: string; params?: Record<string, unknown> }): string {
  return `${config.method}:${config.url}:${JSON.stringify(config.params || {})}`;
}

const getCsrfTokenFromCookie = (): string => {
  try {
    return document.cookie.split('; ').find((entry) => entry.startsWith('neurobot_csrf='))?.split('=')[1] || '';
  } catch { return ''; }
};
const getCsrfTokenFromSession = (): string => {
  try { return sessionStorage.getItem('neurobot_csrf_token') || ''; } catch { return ''; }
};
const getCsrfToken = () => getCsrfTokenFromSession() || getCsrfTokenFromCookie();

// REQUEST INTERCEPTOR
api.interceptors.request.use(async (config) => {
  const token = localStorage.getItem('zdg_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Attach CSRF token for state-changing requests (required by backend)
  const method = (config.method || 'get').toLowerCase();
  if (!['get', 'head', 'options'].includes(method)) {
    let csrf = getCsrfToken();
    if (!csrf) {
      // Fetch a fresh CSRF token if none exists
      try {
        const csrfUrl = resolvedBaseUrl ? `${resolvedBaseUrl}/api/auth/csrf` : '/api/auth/csrf';
        const resp = await fetch(csrfUrl, { credentials: 'include', headers: { Accept: 'application/json' } });
        if (resp.ok) {
          const body = await resp.json().catch(() => ({}));
          csrf = body?.csrfToken || getCsrfTokenFromCookie();
        }
      } catch { /* CSRF fetch failed — will retry on next request */ }
    }
    if (csrf) config.headers['X-CSRF-Token'] = csrf;
  }

  const extConfig = config as typeof config & ExtendedRequestConfig;

  // Deduplicate GET requests — set key immediately to prevent concurrent duplicates
  if (config.method?.toLowerCase() === 'get' && !extConfig._retry) {
    const key = getRequestKey(config);
    if (pendingRequests.has(key)) {
      return Promise.reject(new axios.Cancel('Duplicate request cancelled'));
    }
    pendingRequests.set(key, Promise.resolve());
  }
  
  return config;
}, (error) => Promise.reject(error));

// RESPONSE INTERCEPTOR
let isRefreshing = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let failedQueue: Array<{ resolve: (value: any) => void; reject: (reason?: unknown) => void }> = [];

// Retry on timeout or 503 (max 2 times) — handles Render cold starts
api.interceptors.response.use(
  (response) => {
    // Fire success event to dismiss WakeUpLoader
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('api:success'));
    }
    // Clean up dedup lock on success
    const extConfig = response.config as typeof response.config & ExtendedRequestConfig;
    if (response.config.method?.toLowerCase() === 'get' && !extConfig._retry) {
      const key = getRequestKey(response.config);
      pendingRequests.delete(key);
    }
    return response;
  },
  async (error) => {
    // Clean up dedup lock on error (skip cancelled/deduplicated requests)
    const extConfig = error.config as typeof error.config & ExtendedRequestConfig;
    if (error.config && error.config.method?.toLowerCase() === 'get' && !extConfig._retry) {
      const key = getRequestKey(error.config);
      pendingRequests.delete(key);
    }
    
    // Skip processing for cancelled/deduplicated requests
    // Return a silent resolved response instead of rejecting to avoid
    // 'Uncaught (in promise) CanceledError' noise in the console.
    if (axios.isCancel(error)) {
      return Promise.resolve({
        data: {},
        status: 0,
        statusText: 'cancelled',
        headers: {},
        config: error.config || {},
      });
    }
    
    const originalRequest = error.config as typeof error.config & ExtendedRequestConfig;
    
    // Retry on timeout (ECONNABORTED) or 503 — Render cold start handling
    if (
      (error.code === 'ECONNABORTED' || error.response?.status === 503) &&
      !originalRequest._retryCount
    ) {
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
      if (originalRequest._retryCount <= 2) {
        // Fire custom event for WakeUpLoader
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('api:coldstart', {
            detail: { retryCount: originalRequest._retryCount }
          }));
        }
        toast.error('Server is waking up, retrying...', { duration: 3000, id: 'coldstart-retry' });
        const retryDelay = 3000 * originalRequest._retryCount;
        await new Promise(r => setTimeout(r, retryDelay));
        return api(originalRequest);
      }
    }
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        });
      }
      
      originalRequest._retry = true;
      isRefreshing = true;
      
      const storedRefresh = localStorage.getItem('zdg_refresh');

      if (storedRefresh) {
        try {
          const refreshUrl = resolvedBaseUrl ? `${resolvedBaseUrl}/api/auth/refresh` : '/api/auth/refresh';
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          // Send refresh token as Authorization Bearer header as fallback
          // when cookies are unavailable (third-party context, cross-origin, etc.)
          headers.Authorization = `Bearer ${storedRefresh}`;
          const response = await axios.post(
            refreshUrl,
            { refreshToken: storedRefresh },
            { withCredentials: true, headers }
          );
          
          const newToken = response.data.accessToken;
          localStorage.setItem('zdg_token', newToken);
          
          failedQueue.forEach(p => p.resolve(newToken));
          failedQueue = [];
          
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
          
        } catch (refreshError) {
          failedQueue.forEach(p => p.reject(refreshError));
          failedQueue = [];
          localStorage.clear();
          window.location.href = '/auth';
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      } else {
        localStorage.clear();
        window.location.href = '/auth';
      }
    }
    
    // 403 Forbidden — provide actionable error message
    if (error.response?.status === 403) {
      const code = error.response?.data?.code || '';
      const message =
        code === 'cors_blocked'
          ? 'Access denied: the backend is blocking requests from this origin. Check CORS_ORIGIN on the server.'
          : code === 'rbac_forbidden'
            ? 'Access denied: you do not have permission to access this resource.'
            : code === 'csrf_failed'
              ? 'Session expired — please reload the page.'
              : 'Access denied (403 Forbidden). This may be a CORS, CSRF, or permission issue.';
      toast.error(message, { duration: 5000, id: 'forbidden-error' });
    }

    // 500s are logged at debug level only to avoid noisy console output
    // (Render cold starts and backend crashes are expected during development)
    
    return Promise.reject(error);
  }
);

export default api;