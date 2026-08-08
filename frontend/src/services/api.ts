import axios from 'axios';
import type {
  AuthResponse,
  User,
  Client,
  Juzgado,
  JuzgadoFormData,
  DashboardStats,
  LoginFormData,
  UserFormData,
  ClientFormData,
  Caso,
  CasoFormData,
  CasoHistorialEntry,
  CasoNovedad,
  CasoNovedadFormData,
  Movimiento,
  MovimientoFormData,
  MovimientoStats,
  AdminStats,
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: { 'Content-Type': 'application/json' },
});

// Token refresh state — shared across concurrent requests
let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;

function getTokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

async function ensureFreshToken(currentToken: string): Promise<string> {
  const expiry = getTokenExpiry(currentToken);
  const now = Date.now();
  // Refresh if less than 10 minutes remain and token is still valid
  if (!expiry || expiry <= now || expiry - now > 10 * 60 * 1000) return currentToken;

  if (!isRefreshing) {
    isRefreshing = true;
    refreshPromise = axios
      .post<{ token: string }>(`${API_BASE}/api/auth/refresh`, {}, {
        headers: { Authorization: `Bearer ${currentToken}` },
      })
      .then((r) => {
        const newToken = r.data.token;
        localStorage.setItem('token', newToken);
        return newToken;
      })
      .catch(() => currentToken)
      .finally(() => {
        isRefreshing = false;
        refreshPromise = null;
      });
  }

  return refreshPromise!;
}

// Request interceptor: attach JWT token, refresh if < 10 min remain
api.interceptors.request.use(
  async (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      const fresh = await ensureFreshToken(token);
      config.headers.Authorization = `Bearer ${fresh}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const authApi = {
  login: (data: LoginFormData) =>
    api.post<AuthResponse>('/auth/login', data).then((r) => r.data),

  register: (data: UserFormData) =>
    api.post<AuthResponse>('/auth/register', data).then((r) => r.data),

  getMe: () => api.get<User>('/auth/me').then((r) => r.data),

  forgotPassword: (email: string) =>
    api.post<{ message: string }>('/auth/forgot-password', { email }).then((r) => r.data),

  resetPassword: (token: string, password: string) =>
    api.post<{ message: string }>('/auth/reset-password', { token, password }).then((r) => r.data),

  refresh: () =>
    api.post<{ token: string }>('/auth/refresh').then((r) => r.data),
};

// User endpoints
export const usersApi = {
  getAll: () => api.get<User[]>('/users').then((r) => r.data),

  getAbogados: () => api.get<User[]>('/users/abogados').then((r) => r.data),

  getAuxiliares: () => api.get<User[]>('/users/auxiliares').then((r) => r.data),
  getMyAuxiliares: () => api.get<User[]>('/users/mis-auxiliares').then((r) => r.data),
  addAuxiliar: (auxiliarId: string) => api.post(`/users/mis-auxiliares/${auxiliarId}`).then((r) => r.data),
  removeAuxiliar: (auxiliarId: string) => api.delete(`/users/mis-auxiliares/${auxiliarId}`).then((r) => r.data),

  invite: (data: { email: string; role?: string }) =>
    api.post<{ message: string; user: User }>('/users/invite', data).then((r) => r.data),

  getById: (id: string) => api.get<User>(`/users/${id}`).then((r) => r.data),

  create: (data: UserFormData) =>
    api.post<User>('/users', data).then((r) => r.data),

  update: (id: string, data: Partial<UserFormData> & { active?: boolean }) =>
    api.put<User>(`/users/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    api.delete<{ message: string }>(`/users/${id}`).then((r) => r.data),

  sendPasswordReset: (id: string) =>
    api.post<{ message: string }>(`/users/${id}/reset-password`).then((r) => r.data),

  uploadPhoto: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('photo', file);
    return api
      .post<User>(`/users/${id}/photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  deletePhoto: (id: string) =>
    api.delete<User>(`/users/${id}/photo`).then((r) => r.data),

  changePassword: (id: string, data: { currentPassword: string; newPassword: string }) =>
    api.post<{ message: string }>(`/users/${id}/change-password`, data).then((r) => r.data),
};

// Client endpoints
export const clientsApi = {
  getAll: (options?: { all?: boolean }) =>
    api.get<Client[]>('/clients', { params: options?.all ? { all: 'true' } : undefined }).then((r) => r.data),

  getById: (id: string) => api.get<Client>(`/clients/${id}`).then((r) => r.data),

  getStats: () => api.get<DashboardStats>('/clients/stats').then((r) => r.data),

  create: (data: ClientFormData) =>
    api.post<Client>('/clients', data).then((r) => r.data),

  update: (id: string, data: Partial<ClientFormData> & { active?: boolean }) =>
    api.put<Client>(`/clients/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    api.delete<{ message: string }>(`/clients/${id}`).then((r) => r.data),
};

// Juzgado endpoints
export const juzgadosApi = {
  getAll: () => api.get<Juzgado[]>('/juzgados').then((r) => r.data),

  getById: (id: string) => api.get<Juzgado>(`/juzgados/${id}`).then((r) => r.data),

  create: (data: JuzgadoFormData) =>
    api.post<Juzgado>('/juzgados', data).then((r) => r.data),

  update: (id: string, data: Partial<JuzgadoFormData>) =>
    api.put<Juzgado>(`/juzgados/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    api.delete<{ message: string }>(`/juzgados/${id}`).then((r) => r.data),
};

// Caso endpoints
export const casosApi = {
  getAll: () => api.get<Caso[]>('/casos').then((r) => r.data),

  getById: (id: string) => api.get<Caso>(`/casos/${id}`).then((r) => r.data),

  getHistorial: (id: string) =>
    api.get<CasoHistorialEntry[]>(`/casos/${id}/historial`).then((r) => r.data),

  create: (data: CasoFormData) =>
    api.post<Caso>('/casos', data).then((r) => r.data),

  update: (id: string, data: Partial<CasoFormData>) =>
    api.put<Caso>(`/casos/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    api.delete<{ message: string }>(`/casos/${id}`).then((r) => r.data),
};

// Novedades de caso endpoints
export const casoNovedadesApi = {
  getByCaso: (casoId: string) =>
    api.get<CasoNovedad[]>(`/casos/${casoId}/novedades`).then((r) => r.data),

  create: (casoId: string, data: CasoNovedadFormData) =>
    api.post<CasoNovedad>(`/casos/${casoId}/novedades`, data).then((r) => r.data),

  update: (casoId: string, id: string, data: Partial<CasoNovedadFormData>) =>
    api.put<CasoNovedad>(`/casos/${casoId}/novedades/${id}`, data).then((r) => r.data),

  delete: (casoId: string, id: string) =>
    api.delete<{ message: string }>(`/casos/${casoId}/novedades/${id}`).then((r) => r.data),

  getAgendadas: () =>
    api.get<CasoNovedad[]>('/novedades/agendadas').then((r) => r.data),

  getNotificaciones: () =>
    api.get<CasoNovedad[]>('/novedades/notificaciones').then((r) => r.data),
};

// Google Calendar endpoints
export const googleCalendarApi = {
  getStatus: () =>
    api.get<{ connected: boolean }>('/google-calendar/status').then((r) => r.data),

  getConnectUrl: () =>
    api.get<{ url: string }>('/google-calendar/connect').then((r) => r.data),

  disconnect: () =>
    api.delete<{ message: string }>('/google-calendar/disconnect').then((r) => r.data),
};

// Movimiento endpoints
export const movimientosApi = {
  getAll: () => api.get<Movimiento[]>('/movimientos').then((r) => r.data),

  getStats: () => api.get<MovimientoStats>('/movimientos/stats').then((r) => r.data),

  getByCaso: (casoId: string) =>
    api.get<Movimiento[]>(`/movimientos/caso/${casoId}`).then((r) => r.data),

  getStatsByCaso: (casoId: string) =>
    api.get<MovimientoStats>(`/movimientos/caso/${casoId}/stats`).then((r) => r.data),

  create: (data: MovimientoFormData) =>
    api.post<Movimiento>('/movimientos', data).then((r) => r.data),

  update: (id: string, data: Partial<MovimientoFormData>) =>
    api.put<Movimiento>(`/movimientos/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    api.delete<{ message: string }>(`/movimientos/${id}`).then((r) => r.data),
};

// Admin endpoints
export const adminApi = {
  getStats: () => api.get<AdminStats>('/admin/stats').then((r) => r.data),
};

// WhatsApp endpoints
export const whatsappApi = {
  connect: () =>
    api.post<{ qr: string | null; status: string }>('/whatsapp/connect').then((r) => r.data),

  getStatus: () =>
    api.get<{ status: string; qr: string | null; hasSession?: boolean }>('/whatsapp/status').then((r) => r.data),

  disconnect: () =>
    api.delete<{ message: string }>('/whatsapp/disconnect').then((r) => r.data),

  runExtraction: () =>
    api.post<{ message: string }>('/whatsapp/run-extraction').then((r) => r.data),
};

export default api;
