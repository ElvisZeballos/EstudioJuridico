import axios from 'axios';
import type {
  AuthResponse,
  User,
  Client,
  DashboardStats,
  LoginFormData,
  UserFormData,
  ClientFormData,
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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
};

// User endpoints
export const usersApi = {
  getAll: () => api.get<User[]>('/users').then((r) => r.data),

  getById: (id: string) => api.get<User>(`/users/${id}`).then((r) => r.data),

  create: (data: UserFormData) =>
    api.post<User>('/users', data).then((r) => r.data),

  update: (id: string, data: Partial<UserFormData> & { active?: boolean }) =>
    api.put<User>(`/users/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    api.delete<{ message: string }>(`/users/${id}`).then((r) => r.data),

  uploadPhoto: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('photo', file);
    return api
      .post<User>(`/users/${id}/photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },
};

// Client endpoints
export const clientsApi = {
  getAll: () => api.get<Client[]>('/clients').then((r) => r.data),

  getById: (id: string) => api.get<Client>(`/clients/${id}`).then((r) => r.data),

  getStats: () => api.get<DashboardStats>('/clients/stats').then((r) => r.data),

  create: (data: ClientFormData) =>
    api.post<Client>('/clients', data).then((r) => r.data),

  update: (id: string, data: Partial<ClientFormData> & { active?: boolean }) =>
    api.put<Client>(`/clients/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    api.delete<{ message: string }>(`/clients/${id}`).then((r) => r.data),
};

export default api;
