import prisma from '../../shared/prisma';

export async function findAll() {
  return (prisma as any).feriado.findMany({ orderBy: { fecha: 'asc' } });
}

export async function findById(id: string) {
  return (prisma as any).feriado.findUnique({ where: { id } });
}

export async function findByFecha(fecha: Date) {
  return (prisma as any).feriado.findFirst({ where: { fecha } });
}

export async function create(data: { fecha: Date; nombre: string; ambito: string; origen: string }) {
  return (prisma as any).feriado.create({ data });
}

export async function remove(id: string) {
  return (prisma as any).feriado.delete({ where: { id } });
}

export async function getConfiguracion() {
  let config = await (prisma as any).configuracionFeriados.findFirst();
  if (!config) {
    config = await (prisma as any).configuracionFeriados.create({ data: {} });
  }
  return config;
}

export async function updateConfiguracion(
  id: string,
  data: { trasladoJuevesAViernes?: boolean; trasladoDomingoALunes?: boolean }
) {
  return (prisma as any).configuracionFeriados.update({ where: { id }, data });
}