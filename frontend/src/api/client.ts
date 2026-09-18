import { useNotificationStore } from '../store/notificationStore';
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 35000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

interface CustomRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

apiClient.interceptors.response.use(
  (response) => {
    const url = response.config.url || '';
    const method = response.config.method || 'get';
    if (url.endsWith('/discover')) {
      useNotificationStore.getState().addNotification({ type: 'info', title: 'Network scan complete', message: `${response.data.length} ONVIF camera(s) found.` });
    }
    if (method !== 'get' && !url.includes('/auth/refresh')) {
      const message = url.includes('/auth/login') ? 'Logged in successfully.' :
        url.includes('/auth/register') ? 'Account created successfully.' :
        url.endsWith('/disconnect') ? 'Camera disconnected.' :
        url.endsWith('/connect') ? 'Camera connection requested.' :
        url.endsWith('/detection/toggle') ? (response.data.enabled ? 'Detection started.' : 'Detection stopped.') :
        method === 'delete' ? 'Deleted successfully.' : 'Changes saved successfully.';
      useNotificationStore.getState().addNotification({ type: 'success', title: 'Success', message });
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as CustomRequestConfig;

    if (error.response?.status === 401 && originalRequest && !originalRequest.url?.match(/\/auth\/(login|register)$/) && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = useAuthStore.getState().refreshToken;

      if (refreshToken) {
        try {
          const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          const newAccessToken = res.data.accessToken;
          useAuthStore.getState().setAccessToken(newAccessToken);

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          }

          return apiClient(originalRequest);
        } catch (refreshError) {
          useAuthStore.getState().logout();
          return Promise.reject(refreshError);
        }
      } else {
        useAuthStore.getState().logout();
      }
    }

    const url = originalRequest?.url || '';
    if ((originalRequest?.method && originalRequest.method !== 'get') || url.endsWith('/discover')) {
      const detail = (error.response?.data as any)?.message;
      useNotificationStore.getState().addNotification({
        type: 'error', title: url.endsWith('/connect') ? 'Unable to connect camera' : 'Request failed',
        message: Array.isArray(detail) ? detail.join(', ') : detail ||
          (error.code === 'ECONNABORTED' ? 'Request timed out. Check the backend and camera connection.' : 'Cannot reach the backend. Check that it is running.'),
      });
    }
    return Promise.reject(error);
  },
);
