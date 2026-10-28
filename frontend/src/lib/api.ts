import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from "axios";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Request interceptor: Inject dynamic baseURL, Bearer token, or Diner ID if present
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== "undefined") {
      // 1. Explicit environment variable if configured
      if (process.env.NEXT_PUBLIC_API_URL) {
        config.baseURL = process.env.NEXT_PUBLIC_API_URL;
      } else if (
        window.location.hostname.endsWith(".vercel.app") ||
        window.location.protocol === "https:"
      ) {
        // 2. Production Vercel deployment: Backend is hosted at /api/v1 on the same origin
        config.baseURL = "/api/v1";
      } else {
        // 3. Localhost and Wi-Fi LAN IP testing
        const host =
          window.location.hostname === "localhost"
            ? "127.0.0.1"
            : window.location.hostname;
        config.baseURL = `http://${host}:8000/api/v1`;
      }

      const token = localStorage.getItem("mezflow_token");
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      const dinerId = localStorage.getItem("mezflow_diner_id");
      if (dinerId && config.headers && !config.headers["X-Diner-ID"]) {
        config.headers["X-Diner-ID"] = dinerId;
      }
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// Response interceptor: Uniform error format
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail?: string }>) => {
    const message =
      error.response?.data?.detail ||
      error.message ||
      "An unexpected network error occurred.";
    return Promise.reject(new Error(message));
  }
);

export default apiClient;
