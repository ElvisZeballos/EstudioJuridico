import prisma from '../../shared/prisma';

export async function findAll() {
  return prisma.juzgado.findMany({ where: { active: true }, orderBy: { nombre: 'asc' } });
}

export async function findById(id: string) {
  return prisma.juzgado.findUnique({ where: { id } });
}

export async function create(data: {
  nombre: string; tipo?: string | null; direccion?: string | null;
  ciudad?: string | null; telefono?: string | null; notas?: string | null;
}) {
  return prisma.juzgado.create({ data });
}

export async function update(id: string, data: Record<string, unknown>) {
  return prisma.juzgado.update({ where: { id }, data });
}

export async function deactivate(id: string) {
  return prisma.juzgado.update({ where: { id }, data: { active: false } });
}
