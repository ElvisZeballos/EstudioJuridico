import prisma from '../../shared/prisma';

export const NOVEDAD_INCLUDE = {
  autor: { select: { id: true, nombre: true, apellido: true, email: true, role: true } },
  caso: { select: { id: true, titulo: true } },
} as const;

export async function findByCaso(casoId: string) {
  return prisma.casoNovedad.findMany({
    where: { casoId, active: true },
    include: NOVEDAD_INCLUDE,
    orderBy: { fecha: 'desc' },
  });
}

export async function findAgendadas(casoFilter: object) {
  return prisma.casoNovedad.findMany({
    where: { active: true, fechaAgendada: { not: null }, caso: { active: true, ...casoFilter } },
    include: NOVEDAD_INCLUDE,
    orderBy: { fechaAgendada: 'asc' },
  });
}

export async function findNotificaciones(casoFilter: object) {
  return prisma.casoNovedad.findMany({
    where: { active: true, esNotificacion: true, caso: { active: true, ...casoFilter } },
    include: NOVEDAD_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
}

export async function findById(id: string) {
  return prisma.casoNovedad.findUnique({
    where: { id },
    include: { ...NOVEDAD_INCLUDE, caso: { select: { id: true, titulo: true } } },
  });
}

export async function create(data: {
  casoId: string; autorId: string; titulo: string; contenido: string;
  fecha: Date; fechaAgendada: Date | null;
}) {
  return prisma.casoNovedad.create({ data, include: NOVEDAD_INCLUDE });
}

export async function update(id: string, data: Record<string, unknown>) {
  return prisma.casoNovedad.update({ where: { id }, data, include: NOVEDAD_INCLUDE });
}

export async function deactivate(id: string) {
  return prisma.casoNovedad.update({ where: { id }, data: { active: false } });
}

export async function findCasoWithAccess(casoId: string) {
  return prisma.caso.findUnique({
    where: { id: casoId },
    include: { abogados: true, clientes: true },
  });
}

export async function findClientByUserId(userId: string) {
  return prisma.client.findFirst({ where: { userId } });
}

export async function findUserRefreshToken(userId: string) {
  return prisma.user.findUnique({ where: { id: userId }, select: { googleRefreshToken: true } });
}
