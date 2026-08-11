import axios, { AxiosResponse, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, PY_API_BASE_URL } from '@/lib/apiConfig';

const CSRF_TOKEN_KEY = 'neurobot_csrf_token';

const getCsrfTokenFromSession = (): string => {
  try { return sessionStorage.getItem(CSRF_TOKEN_KEY) || ''; } catch { return ''; }
};
const getCsrfTokenFromCookie = (): string => {
  try {
    return document.cookie.split('; ').find((entry) => entry.startsWith('neurobot_csrf='))?.split('=')[1] || '';
  } catch { return ''; }
};
const getCsrfToken = () => getCsrfTokenFromSession() || getCsrfTokenFromCookie();

const pyapi = axios.create({
  baseURL: PY_API_BASE_URL,
  withCredentials: true,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// REQUEST INTERCEPTOR
pyapi.interceptors.request.use(async (config) => {
  // Session auth is cookie-based — the browser sends httpOnly cookies automatically.
  // Attach CSRF token for state-changing requests
  const method = (config.method || 'get').toLowerCase();
  if (!['get', 'head', 'options'].includes(method)) {
    let csrf = getCsrfToken();
    if (!csrf) {
      try {
        const csrfUrl = API_BASE_URL ? `${API_BASE_URL}/api/auth/csrf` : '/api/auth/csrf';
        const resp = await fetch(csrfUrl, { credentials: 'include', headers: { Accept: 'application/json' } });
        if (resp.ok) {
          const body = await resp.json().catch(() => ({}));
          csrf = body?.csrfToken || getCsrfTokenFromCookie();
        }
      } catch { /* CSRF fetch failed */ }
    }
    if (csrf) config.headers['X-CSRF-Token'] = csrf;
  }
  return config;
}, (error) => Promise.reject(error));

// RESPONSE INTERCEPTOR
let isRefreshing = false;
let failedQueue: Array<{ resolve: (value?: unknown) => void; reject: (reason?: unknown) => void }> = [];

pyapi.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean } | undefined;
    
    if (originalRequest && error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        });
      }
      
      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await axios.post(
          `${API_BASE_URL || ''}/api/auth/refresh`,
          {},
          { withCredentials: true }
        );

        failedQueue.forEach(p => p.resolve(undefined));
        failedQueue = [];

        return pyapi(originalRequest);
      } catch (refreshError) {
        failedQueue.forEach(p => p.reject(refreshError));
        failedQueue = [];
        window.location.assign('/auth');
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    
    if (error.response?.status === 500) {
      console.error('Server error:', error.response.data);
    }
    
    return Promise.reject(error);
  }
);

export default pyapi;
