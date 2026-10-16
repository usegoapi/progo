import axios from 'axios';

const api = axios.create({ timeout: 60_000 });

let configPromise: Promise<void> | null = null;

/** Define a URL da API (injetada pelo servidor no carregamento da página). */
export function setApiBaseUrl(url: string) {
  if (url) api.defaults.baseURL = url;
}

/** Fallback: busca a configuração pública caso ainda não tenha sido definida. */
const ensureBaseUrl = () => {
  if (api.defaults.baseURL || typeof window === 'undefined') return Promise.resolve();
  if (!configPromise) {
    configPromise = fetch('/api/config')
      .then((res) => res.json())
      .then((config) => setApiBaseUrl(config.apiUrl))
      .catch(() => undefined);
  }
  return configPromise;
};

api.interceptors.request.use(async (config) => {
  await ensureBaseUrl();
  config.baseURL = config.baseURL || api.defaults.baseURL;
  const token = typeof window !== 'undefined' ? localStorage.getItem('goapi_token') : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('goapi_token');
      localStorage.removeItem('goapi_user');
      if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/qr/')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

/** Mensagem de erro amigável a partir de uma resposta da API. */
export function apiErrorMessage(error: any, fallback = 'Não foi possível concluir a operação.') {
  if (error?.code === 'ERR_NETWORK' || (!error?.response && error?.request)) {
    return 'Não foi possível conectar à API. Verifique se o servidor está online.';
  }
  const message = error?.response?.data?.message;
  if (Array.isArray(message)) return message.join('\n');
  return typeof message === 'string' ? message : fallback;
}

export default api;
