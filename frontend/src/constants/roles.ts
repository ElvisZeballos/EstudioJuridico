import type { Role } from '../types';

export const ROLE_BADGE_CLASS: Record<Role, string> = {
  ADMIN: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  ABOGADO: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  CLIENTE: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  AUXILIAR: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrador',
  ABOGADO: 'Abogado',
  CLIENTE: 'Cliente',
  AUXILIAR: 'Auxiliar',
};

export const ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'ABOGADO', label: 'Abogado' },
  { value: 'CLIENTE', label: 'Cliente' },
  { value: 'AUXILIAR', label: 'Auxiliar' },
] as const;

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
