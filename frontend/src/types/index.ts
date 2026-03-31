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

export interface Juzgado {
  id: string;
  nombre: string;
  tipo?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  telefono?: string | null;
  notas?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface JuzgadoFormData {
  nombre: string;
  tipo?: string;
  direccion?: string;
  ciudad?: string;
  telefono?: string;
  notas?: string;
}

export type CasoEstado = 'ACTIVO' | 'EN_PROCESO' | 'CERRADO' | 'SUSPENDIDO';

export interface Caso {
  id: string;
  titulo: string;
  descripcion?: string | null;
  estado: CasoEstado;
  numero?: string | null;
  fechaInicio?: string | null;
  fechaCierre?: string | null;
  notas?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  abogados: {
    abogadoId: string;
    abogado: { id: string; nombre: string; apellido: string; email: string };
  }[];
  clientes: {
    clienteId: string;
    cliente: { id: string; nombre: string; apellido: string; email: string };
  }[];
}

export interface CasoFormData {
  titulo: string;
  descripcion?: string;
  estado?: CasoEstado;
  numero?: string;
  fechaInicio?: string;
  fechaCierre?: string;
  notas?: string;
  abogadoIds: string[];
  clienteIds: string[];
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
