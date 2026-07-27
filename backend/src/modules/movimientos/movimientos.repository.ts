import prisma from '../../shared/prisma';
import { TipoMovimiento } from '@prisma/client';

export const MOVIMIENTO_INCLUDE = {
  caso: { select: { id: true, titulo: true, numero: true } },
  abogado: { select: { id: true, nombre: true, apellido: true, email: true } },
} as const;

export async function findAll(where: Record<string, unknown>) {
  return prisma.movimiento.findMany({ where, include: MOVIMIENTO_INCLUDE, orderBy: { fecha: 'desc' } });
}

export async function findById(id: string) {
  return prisma.movimiento.findUnique({ where: { id } });
}

export async function findByCaso(casoId: string) {
  return prisma.movimiento.findMany({
    where: { casoId, active: true },
    include: MOVIMIENTO_INCLUDE,
    orderBy: { fecha: 'desc' },
  });
}

export async function findCasoWithAbogados(casoId: string) {
  return prisma.caso.findUnique({ where: { id: casoId }, include: { abogados: true } });
}

export async function aggregateStats(where: Record<string, unknown>) {
  return Promise.all([
    prisma.movimiento.aggregate({ where: { ...where, tipo: 'INGRESO' }, _sum: { monto: true }, _count: true }),
    prisma.movimiento.aggregate({ where: { ...where, tipo: 'EGRESO' }, _sum: { monto: true }, _count: true }),
    prisma.movimiento.count({ where }),
  ]);
}

export async function create(data: {
  casoId?: string | null; abogadoId: string; tipo: TipoMovimiento;
  concepto: string; monto: number; fecha: Date; notas?: string | null;
}) {
  return prisma.movimiento.create({ data, include: MOVIMIENTO_INCLUDE });
}

export async function update(id: string, data: Record<string, unknown>) {
  return prisma.movimiento.update({ where: { id }, data, include: MOVIMIENTO_INCLUDE });
}

export async function deactivate(id: string) {
  return prisma.movimiento.update({ where: { id }, data: { active: false } });
}
