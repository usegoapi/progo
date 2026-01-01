import axios from 'axios';

// Criar instância do axios
const api = axios.create();

// Flag para saber se já carregou a config
let configLoaded = false;
let configPromise: Promise<void> | null = null;

// Função para carregar a config
const loadConfig = async () => {
  if (configLoaded) return;
  if (configPromise) return configPromise;

  configPromise = (async () => {
    try {
      const res = await fetch('/api/config');
      const config = await res.json();
      if (config.apiUrl) {
        api.defaults.baseURL = config.apiUrl;
      }
    } catch {
      // Fallback - tentar URL relativa
      api.defaults.baseURL = '';
    }
    configLoaded = true;
  })();

  return configPromise;
};

// Interceptor para garantir que a config foi carregada antes de cada request
api.interceptors.request.use(async (config) => {
  // Carregar config se ainda não foi carregada
  if (typeof window !== 'undefined' && !configLoaded) {
    await loadConfig();
  }

  // Adicionar token de autenticação
  const token = typeof window !== 'undefined' ? localStorage.getItem('goapi_token') : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Se 401, pode ser token expirado
    if (error.response?.status === 401) {
      // Não remover token automaticamente, deixar o frontend decidir
    }
    return Promise.reject(error);
  }
);

export default api;
