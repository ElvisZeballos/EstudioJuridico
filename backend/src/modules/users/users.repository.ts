import prisma from '../../shared/prisma';
import { Prisma } from '@prisma/client';

export const USER_SELECT = {
  id: true, email: true, role: true, nombre: true, apellido: true,
  dni: true, telefono: true, direccion: true, fechaNacimiento: true,
  photoPath: true, active: true, deactivatedAt: true, createdAt: true, updatedAt: true,
} as const;

export async function findAll() {
  return prisma.user.findMany({
    select: {
      id: true, email: true, role: true, nombre: true, apellido: true,
      photoPath: true, active: true, deactivatedAt: true, createdAt: true, updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function findById(id: string) {
  return prisma.user.findUnique({ where: { id }, select: USER_SELECT });
}

export async function findByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function findAllWithEncryptedFields() {
  return prisma.user.findMany({ select: { id: true, telefono: true } });
}

export async function findAllWithDni() {
  return prisma.user.findMany({ select: { id: true, dni: true } });
}

export async function create(data: Prisma.UserCreateInput) {
  return prisma.user.create({ data, select: USER_SELECT });
}

export async function update(id: string, data: Prisma.UserUpdateInput) {
  return prisma.user.update({ where: { id }, data, select: USER_SELECT });
}

export async function deactivate(id: string) {
  return prisma.user.update({ where: { id }, data: { active: false, deactivatedAt: new Date() } });
}

export async function findAllAbogados() {
  return prisma.user.findMany({
    where: { role: 'ABOGADO', active: true },
    select: { id: true, nombre: true, apellido: true, email: true, role: true },
    orderBy: { apellido: 'asc' },
  });
}

export async function createPasswordResetToken(userId: string, token: string, expiresAt: Date) {
  return prisma.passwordResetToken.create({ data: { token, userId, expiresAt } });
}

export async function invalidatePendingResetTokens(userId: string) {
  return prisma.passwordResetToken.updateMany({
    where: { userId, used: false },
    data: { used: true },
  });
}

export async function createClient(userId: string) {
  return prisma.client.create({ data: { userId } });
}

// ─── Abogado-Auxiliar ─────────────────────────────────────────────────────────

export async function getAuxiliaresByAbogado(abogadoId: string) {
  try {
    const rows = await (prisma as any).abogadoAuxiliar.findMany({
      where: { abogadoId },
      include: { auxiliar: { select: { id: true, nombre: true, apellido: true, email: true, role: true, active: true, photoPath: true } } },
    });
    return rows.map((r: any) => r.auxiliar);
  } catch {
    return [];
  }
}

export async function getAbogadosByAuxiliar(auxiliarId: string): Promise<string[]> {
  try {
    const rows = await (prisma as any).abogadoAuxiliar.findMany({
      where: { auxiliarId },
      select: { abogadoId: true },
    });
    return rows.map((r: any) => r.abogadoId) as string[];
  } catch {
    // tabla aún no creada — retornar vacío para que el auxiliar vea nada
    return [];
  }
}

export async function addAuxiliar(abogadoId: string, auxiliarId: string) {
  return (prisma as any).abogadoAuxiliar.upsert({
    where: { abogadoId_auxiliarId: { abogadoId, auxiliarId } },
    update: {},
    create: { abogadoId, auxiliarId },
  });
}

export async function removeAuxiliar(abogadoId: string, auxiliarId: string) {
  return (prisma as any).abogadoAuxiliar.delete({
    where: { abogadoId_auxiliarId: { abogadoId, auxiliarId } },
  });
}

export async function findAuxiliares() {
  return prisma.user.findMany({
    where: { role: 'AUXILIAR', active: true },
    select: { id: true, nombre: true, apellido: true, email: true, role: true },
    orderBy: { apellido: 'asc' },
  });
}
