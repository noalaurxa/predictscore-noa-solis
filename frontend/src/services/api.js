import axios from 'axios';

const createInstance = (baseURL) => {
  const instance = axios.create({
    baseURL,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Interceptor de peticiones para inyectar automáticamente el JWT
  instance.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  return instance;
};

export const authApi = createInstance(import.meta.env.VITE_AUTH_API_URL || 'http://localhost:3001');
export const matchApi = createInstance(import.meta.env.VITE_MATCH_API_URL || 'http://localhost:3002');
export const predictionApi = createInstance(import.meta.env.VITE_PREDICTION_API_URL || 'http://localhost:3003');

// Para compatibilidad hacia atrás
const api = authApi;
export default api;

