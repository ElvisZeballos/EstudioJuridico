import { CasoEstado } from '@prisma/client';

/**
 * Calcula el estado "real" de un caso: si tiene fecha de cierre y ya pasó,
 * se considera Concluido aunque el campo guardado diga otra cosa —
 * excepto si ya está Archivado (eso es siempre decisión manual del abogado).
 * Espejo de frontend/src/constants/caso.ts → getEstadoEfectivo().
 */
export function getEstadoEfectivo(estado: CasoEstado, fechaCierre: Date | null): CasoEstado {
  if (estado === 'ARCHIVADO' || !fechaCierre) return estado;

  const cierreStr = fechaCierre.toISOString().slice(0, 10);
  const hoyStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });

  return cierreStr <= hoyStr ? 'CONCLUIDO' : estado;
}