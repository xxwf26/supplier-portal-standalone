import axios from 'axios';
import { logger } from '@/lib/polyfills/logger';

const axiosForBackend = axios.create({
  baseURL: '',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
axiosForBackend.interceptors.request.use((config) => {
  try {
    const auth = JSON.parse(localStorage.getItem('auth') || '{}');
    if (auth.token) {
      config.headers.Authorization = `Bearer ${auth.token}`;
    }
  } catch {}
  return config;
});

axiosForBackend.interceptors.response.use(
  (response) => response,
  (error) => {
    logger.error('API Error:', error?.response?.status, error?.config?.url);
    if (error?.response?.status === 401) {
      localStorage.removeItem('auth');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export { axiosForBackend, axios };
export default axiosForBackend;