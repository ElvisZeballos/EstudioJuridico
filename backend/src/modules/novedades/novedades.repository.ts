import prisma from '../../shared/prisma';

export const NOVEDAD_INCLUDE = {
  autor: { select: { id: true, nombre: true, apellido: true, email: true, role: true } },
  caso: { select: { id: true, titulo: true } },
} as const;

// Igual que NOVEDAD_INCLUDE, pero trae también quién la vio y los abogados del caso
// (para calcular `leida`). El servicio los quita antes de responder.
const NOVEDAD_INCLUDE_VISTAS = {
  autor: NOVEDAD_INCLUDE.autor,
  caso: { select: { id: true, titulo: true, abogados: { select: { abogadoId: true } } } },
  vistas: { select: { abogadoId: true } },
} as const;

export async function findByCaso(casoId: string) {
  return prisma.casoNovedad.findMany({
    where: { casoId, active: true },
    include: NOVEDAD_INCLUDE_VISTAS,
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
    include: NOVEDAD_INCLUDE_VISTAS,
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

export async function findByIdConVistas(id: string) {
  return prisma.casoNovedad.findUnique({
    where: { id },
    select: {
      id: true,
      active: true,
      esNotificacion: true,
      caso: { select: { active: true, abogados: { select: { abogadoId: true } } } },
    },
  });
}

export async function marcarVista(novedadId: string, abogadoIds: string[]) {
  return prisma.novedadVista.createMany({
    data: abogadoIds.map((abogadoId) => ({ novedadId, abogadoId })),
    skipDuplicates: true,
  });
}

export async function desmarcarVista(novedadId: string, abogadoIds: string[]) {
  return prisma.novedadVista.deleteMany({ where: { novedadId, abogadoId: { in: abogadoIds } } });
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
