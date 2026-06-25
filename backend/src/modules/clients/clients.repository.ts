import prisma from '../../shared/prisma';

export const CLIENT_INCLUDE = {
  user: {
    select: {
      id: true, nombre: true, apellido: true, email: true,
      dni: true, telefono: true, direccion: true, fechaNacimiento: true,
      active: true, photoPath: true,
    },
  },
  abogado: { select: { id: true, nombre: true, apellido: true, email: true } },
  referencias: {
    select: { id: true, nombre: true, relacion: true, telefono: true },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

export async function findAll(where: Record<string, unknown>) {
  return prisma.client.findMany({ where, include: CLIENT_INCLUDE, orderBy: { createdAt: 'desc' } });
}

export async function findById(id: string) {
  return prisma.client.findUnique({ where: { id }, include: CLIENT_INCLUDE });
}

export async function findByUserId(userId: string) {
  return prisma.client.findFirst({ where: { userId, active: true }, include: CLIENT_INCLUDE });
}

export async function create(data: {
  userId: string;
  abogadoId?: string | null;
  notas?: string | null;
  referencias?: { nombre: string; relacion: string; telefono: string }[];
}) {
  return prisma.client.create({
    data: {
      userId: data.userId,
      abogadoId: data.abogadoId ?? null,
      notas: data.notas ?? null,
      referencias: data.referencias && data.referencias.length > 0
        ? { create: data.referencias }
        : undefined,
    },
    include: CLIENT_INCLUDE,
  });
}

export async function update(id: string, clientData: Record<string, unknown>, userUpdate?: Record<string, unknown>, userId?: string) {
  if (userUpdate && Object.keys(userUpdate).length > 0 && userId) {
    await prisma.user.update({ where: { id: userId }, data: userUpdate });
  }
  return prisma.client.update({ where: { id }, data: clientData, include: CLIENT_INCLUDE });
}

export async function deactivate(id: string, userId: string) {
  await prisma.client.update({ where: { id }, data: { active: false } });
  await prisma.user.update({ where: { id: userId }, data: { active: false } });
}

export async function countStats(userId: string, role: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const byAbogado = role === 'ABOGADO'
    ? { casos: { some: { caso: { abogados: { some: { abogadoId: userId } } } } } }
    : {};
  const clientFilter = { active: true, ...byAbogado };
  const recentFilter = { active: true, createdAt: { gte: thirtyDaysAgo }, ...byAbogado };
  return Promise.all([
    prisma.client.count({ where: clientFilter }),
    prisma.user.count({ where: { active: true } }),
    prisma.user.count({ where: { active: true, role: 'ABOGADO' } }),
    prisma.client.count({ where: recentFilter }),
  ]);
}
