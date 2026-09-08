const DEFAULT_API_BASE_URL = '/api';

const normalizeBaseUrl = (baseUrl) => baseUrl.replace(/\/+$/, '');

const joinUrl = (baseUrl, endpoint) => {
  const normalizedBase = normalizeBaseUrl(baseUrl);
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${normalizedBase}${normalizedEndpoint}`;
};

export const getApiBaseUrl = () => {
  return normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL);
};

export const getWebSocketUrl = (path) => {
  const configuredBase = import.meta.env.VITE_WS_BASE_URL;
  if (configuredBase) {
    return joinUrl(configuredBase, path);
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${protocol}//${window.location.host}${normalizedPath}`;
};

export const apiCall = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = {
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(joinUrl(getApiBaseUrl(), endpoint), {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Token expired or unauthorized
    localStorage.removeItem('token');
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong');
  }
  return data;
};
