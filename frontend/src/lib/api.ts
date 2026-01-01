import axios from 'axios';

// URL padrão da API - será sobrescrita pelo /api/config em runtime
let apiBaseUrl = '/api/proxy';

// Buscar URL da API do servidor (em runtime)
if (typeof window !== 'undefined') {
  fetch('/api/config')
    .then(res => res.json())
    .then(config => {
      if (config.apiUrl) {
        apiBaseUrl = config.apiUrl;
        api.defaults.baseURL = config.apiUrl;
      }
    })
    .catch(() => {});
}

const api = axios.create({
  baseURL: apiBaseUrl,
});

api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('goapi_token') : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
