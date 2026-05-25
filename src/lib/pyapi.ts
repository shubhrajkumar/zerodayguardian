import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

const pyapi = axios.create({
  baseURL: import.meta.env.VITE_PYAPI_URL || import.meta.env.VITE_API_URL,
  withCredentials: true,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// REQUEST INTERCEPTOR
pyapi.interceptors.request.use((config) => {
  const token = localStorage.getItem("zdg_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

// RESPONSE INTERCEPTOR
let isRefreshing = false;
let failedQueue: Array<{ resolve: (value?: unknown) => void; reject: (reason?: any) => void }> = [];

pyapi.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
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
          const response = await axios.post(
            `${import.meta.env.VITE_API_URL}/api/auth/refresh`,
            { refreshToken },
            { withCredentials: true }
          );
          
          const newToken = response.data.accessToken;
          localStorage.setItem('zdg_token', newToken);
          
          failedQueue.forEach(p => p.resolve(newToken));
          failedQueue = [];
          
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return pyapi(originalRequest);
          
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

export default pyapi;
