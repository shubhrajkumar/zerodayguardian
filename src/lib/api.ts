import axios from "axios";
import { getStoredAccessToken, clearStoredAccessToken, getCookie } from "./apiClient";
import { API_BASE_URL } from "./apiConfig";
import { toast } from "@/hooks/use-toast";

// 1. Create central Axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// 2. Request Interceptor: Attach JWT to Authorization Header and CSRF token if mutating
api.interceptors.request.use(
  (config) => {
    const token = getStoredAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Attach CSRF Token for state-changing requests
    const csrfToken = getCookie("neurobot_csrf");
    if (csrfToken && config.method && !["get", "head", "options"].includes(config.method.toLowerCase())) {
      config.headers["X-CSRF-Token"] = csrfToken;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 3. Response Interceptor: Catch 401 unauthorized to clear auth state and redirect to /auth
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response ? error.response.status : 0;
    if (status === 401) {
      // Clear auth state
      clearStoredAccessToken();
      try {
        localStorage.removeItem("auth_state");
      } catch {
        // ignore storage errors
      }

      toast({
        title: "Session expired",
        description: "Please sign in again.",
      });

      setTimeout(() => {
        window.location.assign("/auth");
      }, 700);
    }
    return Promise.reject(error);
  }
);

export default api;
