import prisma from '../../shared/prisma';
import { Prisma } from '@prisma/client';

export const CASO_INCLUDE = {
  abogados: {
    include: {
      abogado: { select: { id: true, nombre: true, apellido: true, email: true } },
    },
  },
  clientes: {
    include: {
      cliente: {
        include: {
          user: { select: { nombre: true, apellido: true, email: true } },
        },
      },
    },
  },
  juzgado: { select: { id: true, nombre: true, ciudad: true } },
  abogadosContraparte: {
    select: { id: true, nombre: true, direccion: true, telefono: true },
    orderBy: { createdAt: 'asc' as const },
  },
  demandados: {
    select: { id: true, nombre: true, domicilio: true, carnet: true, telefono: true },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

export async function findAll(where: Record<string, unknown>) {
  return prisma.caso.findMany({ where, include: CASO_INCLUDE, orderBy: { createdAt: 'desc' } });
}

export async function findById(id: string) {
  return prisma.caso.findUnique({ where: { id }, include: CASO_INCLUDE });
}

export async function findByIdWithAbogados(id: string) {
  return prisma.caso.findUnique({ where: { id }, include: { abogados: true } });
}

export async function findClientByUserId(userId: string) {
  return prisma.client.findFirst({ where: { userId } });
}

export async function findByNumero(numero: string) {
  return prisma.caso.findFirst({ where: { numero, active: true } });
}

export async function create(data: Prisma.CasoUncheckedCreateInput) {
  return prisma.caso.create({ data, include: CASO_INCLUDE });
}

export async function update(id: string, data: Record<string, unknown>) {
  return prisma.caso.update({ where: { id }, data, include: CASO_INCLUDE });
}

export async function deactivate(id: string) {
  return prisma.caso.update({ where: { id }, data: { active: false } });
}

export async function findHistorial(casoId: string) {
  return prisma.casoHistorial.findMany({
    where: { casoId },
    include: {
      usuario: { select: { id: true, nombre: true, apellido: true, email: true, role: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createHistorialEntries(entries: {
  casoId: string; usuarioId: string; campo: string; valorAntes: string | null; valorDespues: string | null;
}[]) {
  return prisma.casoHistorial.createMany({ data: entries });
}

export async function deleteAbogados(casoId: string) {
  return prisma.casoAbogado.deleteMany({ where: { casoId } });
}

export async function deleteClientes(casoId: string) {
  return prisma.casoCliente.deleteMany({ where: { casoId } });
}

export async function findJuzgado(id: string) {
  return prisma.juzgado.findUnique({ where: { id }, select: { nombre: true } });
}

export async function findUsersByIds(ids: string[]) {
  return prisma.user.findMany({ where: { id: { in: ids } }, select: { nombre: true, apellido: true } });
}
