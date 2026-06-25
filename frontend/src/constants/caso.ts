import type { CasoEstado } from '../types';

export const CASO_ESTADOS: {
  value: CasoEstado;
  label: string;
  color: string;
  dotClass: string;
  classes: string;
}[] = [
  {
    value: 'ACTIVO',
    label: 'Activo',
    color: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
    dotClass: 'bg-emerald-500',
    classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  {
    value: 'PENDIENTE',
    label: 'Pendiente',
    color: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    dotClass: 'bg-amber-500',
    classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  {
    value: 'CONCLUIDO',
    label: 'Concluido',
    color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
    dotClass: 'bg-blue-400',
    classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  {
    value: 'ARCHIVADO',
    label: 'Archivado',
    color: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
    dotClass: 'bg-gray-400',
    classes: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  },
];

export const ESTADO_COLORS: Record<CasoEstado, string> = Object.fromEntries(
  CASO_ESTADOS.map((e) => [e.value, e.color]),
) as Record<CasoEstado, string>;

export const ESTADO_LABELS: Record<CasoEstado, string> = Object.fromEntries(
  CASO_ESTADOS.map((e) => [e.value, e.label]),
) as Record<CasoEstado, string>;

export function estadoInfo(estado: CasoEstado) {
  return CASO_ESTADOS.find((e) => e.value === estado) ?? CASO_ESTADOS[0];
}
