import axios from 'axios';
import { API_BASE_URL } from '@/lib/apiConfig';

const resolvedBaseUrl = import.meta.env.VITE_API_URL || API_BASE_URL || '';

const api = axios.create({
  baseURL: resolvedBaseUrl,
  withCredentials: true,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// ── Request deduplication ──
// Prevents firing duplicate GET requests for the same URL simultaneously
const pendingRequests = new Map<string, Promise<any>>();

function getRequestKey(config: any): string {
  return `${config.method}:${config.url}:${JSON.stringify(config.params || {})}`;
}

// REQUEST INTERCEPTOR
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('zdg_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Deduplicate GET requests — set key immediately to prevent concurrent duplicates
  if (config.method?.toLowerCase() === 'get' && !config._retry) {
    const key = getRequestKey(config);
    if (pendingRequests.has(key)) {
      return Promise.reject(new axios.Cancel('Duplicate request cancelled'));
    }
    pendingRequests.set(key, true);
  }
  
  return config;
}, (error) => Promise.reject(error));

// RESPONSE INTERCEPTOR
let isRefreshing = false;
let failedQueue: any[] = [];

api.interceptors.response.use(
  (response) => {
    // Clean up dedup lock on success
    if (response.config.method?.toLowerCase() === 'get' && !response.config._retry) {
      const key = getRequestKey(response.config);
      pendingRequests.delete(key);
    }
    return response;
  },
  async (error) => {
    // Clean up dedup lock on error (skip cancelled/deduplicated requests)
    if (error.config && error.config.method?.toLowerCase() === 'get' && !(error.config as any)._retry) {
      const key = getRequestKey(error.config);
      pendingRequests.delete(key);
    }
    
    // Skip processing for cancelled/deduplicated requests
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }
    
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        });
      }
      
      originalRequest._retry = true;
      isRefreshing = true;
      
      const refreshToken = localStorage.getItem('zdg_refresh');
      
      if (refreshToken) {
        try {
          const refreshUrl = resolvedBaseUrl ? `${resolvedBaseUrl}/api/auth/refresh` : '/api/auth/refresh';
          const response = await axios.post(
            refreshUrl,
            { refreshToken },
            { withCredentials: true }
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
    
    if (error.response?.status === 500) {
      console.error('Server error:', error.response.data);
    }
    
    return Promise.reject(error);
  }
);

export default api;