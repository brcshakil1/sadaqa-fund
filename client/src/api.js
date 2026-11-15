import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' });

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem('token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const isLogin = err.config && err.config.url && err.config.url.includes('/auth/login');
    if (err.response && err.response.status === 401 && !isLogin) {
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const errMsg = (e) =>
  (e.response && e.response.data && e.response.data.message) ||
  (e.code === 'ERR_NETWORK' ? 'Cannot reach the server. If it was idle, wait a minute and try again.' : e.message) ||
  'Something went wrong';

export default api;
