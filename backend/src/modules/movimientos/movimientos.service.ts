import { TipoMovimiento } from '@prisma/client';
import { logger } from '../../config/logger';
import * as movimientosRepository from './movimientos.repository';

function buildStatsResponse(ingresos: { _sum: { monto: unknown }; _count: number }, egresos: { _sum: { monto: unknown }; _count: number }, total: number) {
  const totalIngresos = Number(ingresos._sum.monto ?? 0);
  const totalEgresos = Number(egresos._sum.monto ?? 0);
  return {
    totalIngresos,
    totalEgresos,
    balance: totalIngresos - totalEgresos,
    totalMovimientos: total,
    cantIngresos: ingresos._count,
    cantEgresos: egresos._count,
  };
}

export async function getAll(userId: string, role: string) {
  const where: Record<string, unknown> = role === 'ABOGADO'
    ? { active: true, abogadoId: userId }
    : { active: true };
  return movimientosRepository.findAll(where);
}

export async function getByCaso(casoId: string, userId: string, role: string) {
  const caso = await movimientosRepository.findCasoWithAbogados(casoId);
  if (!caso || !caso.active) return { error: 'Caso no encontrado', status: 404 as const };

  if (role === 'ABOGADO' && !caso.abogados.some((a) => a.abogadoId === userId)) {
    return { error: 'Acceso denegado', status: 403 as const };
  }

  const movimientos = await movimientosRepository.findByCaso(casoId);
  return { movimientos };
}

export async function getStats(userId: string, role: string) {
  const where: Record<string, unknown> = role === 'ABOGADO'
    ? { active: true, abogadoId: userId }
    : { active: true };
  const [ingresos, egresos, total] = await movimientosRepository.aggregateStats(where);
  return buildStatsResponse(ingresos, egresos, total);
}

export async function getStatsByCaso(casoId: string, userId: string, role: string) {
  const caso = await movimientosRepository.findCasoWithAbogados(casoId);
  if (!caso || !caso.active) return { error: 'Caso no encontrado', status: 404 as const };

  if (role === 'ABOGADO' && !caso.abogados.some((a) => a.abogadoId === userId)) {
    return { error: 'Acceso denegado', status: 403 as const };
  }

  const [ingresos, egresos, total] = await movimientosRepository.aggregateStats({ casoId, active: true });
  return buildStatsResponse(ingresos, egresos, total);
}

export async function create(
  data: { casoId?: string; tipo: string; concepto: string; monto: string | number; fecha: string; notas?: string; abogadoId?: string },
  userId: string,
  role: string,
  actorLog: object
) {
  const { casoId, tipo, concepto, monto, fecha, notas } = data;

  if (!tipo || !concepto || !monto || !fecha) {
    return { error: 'Tipo, concepto, monto y fecha son requeridos', status: 400 as const };
  }
  if (!['INGRESO', 'EGRESO'].includes(tipo)) {
    return { error: 'Tipo debe ser INGRESO o EGRESO', status: 400 as const };
  }

  if (casoId) {
    const caso = await movimientosRepository.findCasoWithAbogados(casoId);
    if (!caso || !caso.active) return { error: 'Caso no encontrado', status: 404 as const };
    if (role === 'ABOGADO' && !caso.abogados.some((a) => a.abogadoId === userId)) {
      return { error: 'No tienes acceso a este caso', status: 403 as const };
    }
  }

  const abogadoId = role === 'ADMIN' ? (data.abogadoId || userId) : userId;

  const movimiento = await movimientosRepository.create({
    casoId: casoId || null,
    abogadoId,
    tipo: tipo as TipoMovimiento,
    concepto,
    monto: parseFloat(String(monto)),
    fecha: new Date(fecha),
    notas: notas || null,
  });

  logger.info('MOVIMIENTOS: creado', { ...actorLog, movimientoId: movimiento.id, tipo, monto, casoId: casoId || 'global' });
  return { movimiento };
}

export async function update(
  id: string,
  userId: string,
  role: string,
  data: { tipo?: string; concepto?: string; monto?: string | number; fecha?: string; notas?: string },
  actorLog: object
) {
  const existing = await movimientosRepository.findById(id);
  if (!existing || !existing.active) return { error: 'Movimiento no encontrado', status: 404 as const };

  if (role === 'ABOGADO' && existing.abogadoId !== userId) {
    return { error: 'Acceso denegado', status: 403 as const };
  }

  const { tipo, concepto, monto, fecha, notas } = data;
  const updateData: Record<string, unknown> = {
    ...(tipo !== undefined && { tipo }),
    ...(concepto !== undefined && { concepto }),
    ...(monto !== undefined && { monto: parseFloat(String(monto)) }),
    ...(fecha !== undefined && { fecha: new Date(fecha) }),
    ...(notas !== undefined && { notas: notas || null }),
  };

  const updated = await movimientosRepository.update(id, updateData);
  logger.info('MOVIMIENTOS: modificado', { ...actorLog, movimientoId: id });
  return { movimiento: updated };
}

export async function deactivate(id: string, userId: string, role: string, actorLog: object) {
  const existing = await movimientosRepository.findById(id);
  if (!existing || !existing.active) return { error: 'Movimiento no encontrado', status: 404 as const };

  if (role === 'ABOGADO' && existing.abogadoId !== userId) {
    return { error: 'Acceso denegado', status: 403 as const };
  }

  await movimientosRepository.deactivate(id);
  logger.info('MOVIMIENTOS: eliminado', { ...actorLog, movimientoId: id });
  return {};
}
