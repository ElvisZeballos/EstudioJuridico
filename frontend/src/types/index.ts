export type Role = 'ADMIN' | 'ABOGADO' | 'CLIENTE' | 'AUXILIAR';

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

export interface ClientReferencia {
  id?: string;
  nombre: string;
  relacion: string;
  telefono: string;
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
  referencias: ClientReferencia[];
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

export type CasoEstado = 'ACTIVO' | 'PENDIENTE' | 'CONCLUIDO' | 'ARCHIVADO';

export interface CasoAbogadoContraparte {
  id?: string;
  nombre: string;
  direccion?: string;
  telefono?: string;
}

export interface CasoDemandado {
  id?: string;
  nombre: string;
  domicilio?: string;
  carnet?: string;
  telefono?: string;
}

export interface CasoNovedad {
  id: string;
  casoId: string;
  autorId: string;
  autor: { id: string; nombre: string; apellido: string; email: string; role: Role };
  caso?: { id: string; titulo: string };
  titulo: string;
  contenido: string;
  fecha: string;
  fechaAgendada?: string | null;
  googleCalendarEventId?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CasoNovedadFormData {
  titulo: string;
  contenido: string;
  fecha: string;
  fechaAgendada?: string | null;
}

export interface CasoHistorialEntry {
  id: string;
  casoId: string;
  usuarioId: string;
  usuario: { id: string; nombre: string; apellido: string; email: string; role: Role };
  campo: string;
  valorAntes: string | null;
  valorDespues: string | null;
  createdAt: string;
}

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
  juzgadoId?: string | null;
  juzgado?: { id: string; nombre: string; ciudad?: string | null } | null;
  abogados: {
    abogadoId: string;
    abogado: { id: string; nombre: string; apellido: string; email: string };
  }[];
  clientes: {
    clienteId: string;
    cliente: { id: string; nombre: string; apellido: string; email: string };
  }[];
  abogadosContraparte: CasoAbogadoContraparte[];
  demandados: CasoDemandado[];
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
  juzgadoId?: string;
  abogadosContraparte: CasoAbogadoContraparte[];
  demandados: CasoDemandado[];
}

export type TipoMovimiento = 'INGRESO' | 'EGRESO';

export interface Movimiento {
  id: string;
  casoId: string;
  caso: { id: string; titulo: string; numero?: string | null };
  abogadoId: string;
  abogado: { id: string; nombre: string; apellido: string; email: string };
  tipo: TipoMovimiento;
  concepto: string;
  monto: number;
  fecha: string;
  notas?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MovimientoFormData {
  casoId: string;
  tipo: TipoMovimiento;
  concepto: string;
  monto: number | string;
  fecha: string;
  notas?: string;
}

export interface MovimientoStats {
  totalIngresos: number;
  totalEgresos: number;
  balance: number;
  totalMovimientos: number;
  cantIngresos: number;
  cantEgresos: number;
}

export interface AdminStats {
  server: {
    uptime: number;
    nodeVersion: string;
    env: string;
    platform: string;
    memory: { heapUsedMB: number; heapTotalMB: number; rssMB: number };
  };
  database: {
    connected: boolean;
    latencyMs: number;
    provider: string;
    url: string;
  };
  storage: {
    uploadsDirMB: number;
    diskAvailableGB: number | null;
    diskTotalGB: number | null;
  };
  counts: {
    totalUsers: number;
    activeUsers: number;
    totalClients: number;
    totalCasos: number;
  };
  generatedAt: string;
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
  referencias: ClientReferencia[];
}
