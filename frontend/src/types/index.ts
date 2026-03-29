export type Role = 'ADMIN' | 'ABOGADO' | 'CLIENTE';

export interface User {
  id: string;
  email: string;
  role: Role;
  nombre: string;
  apellido: string;
  dni?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  fechaNacimiento?: string | null;
  photoPath?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  telefono?: string | null;
  direccion?: string | null;
  fechaNacimiento?: string | null;
  notas?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  abogadoId?: string | null;
  abogado?: {
    id: string;
    nombre: string;
    apellido: string;
    email: string;
  } | null;
  userId?: string | null;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface DashboardStats {
  totalClients: number;
  totalUsers: number;
  abogados: number;
  recentClients: number;
}

export interface ApiError {
  error: string;
}

export interface LoginFormData {
  email: string;
  password: string;
}

export interface UserFormData {
  email: string;
  password?: string;
  nombre: string;
  apellido: string;
  role?: Role;
  dni?: string;
  telefono?: string;
  direccion?: string;
  fechaNacimiento?: string;
}

export interface ClientFormData {
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  telefono?: string;
  direccion?: string;
  fechaNacimiento?: string;
  notas?: string;
  abogadoId?: string;
}
