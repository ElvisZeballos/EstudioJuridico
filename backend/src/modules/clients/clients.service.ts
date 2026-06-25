import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { encryptIfDefined, decryptIfDefined } from '../../config/encryption';
import { logger } from '../../config/logger';
import prisma from '../../shared/prisma';
import * as clientsRepository from './clients.repository';

type ClientRaw = Awaited<ReturnType<typeof clientsRepository.findById>>;

export function decryptClient(client: NonNullable<ClientRaw>) {
  return {
    id: client.id,
    userId: client.userId,
    abogadoId: client.abogadoId,
    abogado: client.abogado ?? null,
    notas: decryptIfDefined(client.notas),
    active: client.active,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
    referencias: client.referencias ?? [],
    nombre: client.user.nombre,
    apellido: client.user.apellido,
    email: client.user.email,
    dni: decryptIfDefined(client.user.dni) ?? '',
    telefono: decryptIfDefined(client.user.telefono),
    direccion: decryptIfDefined(client.user.direccion),
    fechaNacimiento: decryptIfDefined(client.user.fechaNacimiento),
    photoPath: client.user.photoPath,
    userActive: client.user.active,
  };
}

export async function getAll(userId: string, role: string, queryAll?: string) {
  if (role === 'CLIENTE') {
    const clientProfile = await clientsRepository.findByUserId(userId);
    if (!clientProfile) return [];
    return [decryptClient(clientProfile)];
  }

  const whereClause: Record<string, unknown> = { active: true };
  if (role === 'ABOGADO' && queryAll !== 'true') {
    whereClause.casos = {
      some: { caso: { abogados: { some: { abogadoId: userId } } } },
    };
  } else if (role === 'AUXILIAR') {
    const { getAbogadosByAuxiliar } = await import('../users/users.repository');
    const abogadoIds = await getAbogadosByAuxiliar(userId);
    if (abogadoIds.length === 0) return [];
    whereClause.casos = {
      some: { caso: { abogados: { some: { abogadoId: { in: abogadoIds } } } } },
    };
  }

  const clients = await clientsRepository.findAll(whereClause);
  return clients.map(decryptClient);
}

export async function getById(id: string, userId: string, role: string) {
  const client = await clientsRepository.findById(id);
  if (!client) return { error: 'Client not found', status: 404 as const };

  if (role === 'CLIENTE' && client.userId !== userId) {
    return { error: 'Access denied', status: 403 as const };
  }

  return { client: decryptClient(client) };
}

export async function create(
  data: {
    nombre: string; apellido: string; email: string; dni?: string; telefono?: string;
    direccion?: string; fechaNacimiento?: string; notas?: string; abogadoId?: string;
    referencias?: { nombre: string; relacion: string; telefono: string }[];
  },
  actorLog: object
) {
  const { nombre, apellido, email, dni, telefono, direccion, fechaNacimiento, notas, abogadoId, referencias } = data;

  if (!nombre || !apellido || !email) {
    return { error: 'nombre, apellido y email son requeridos', status: 400 as const };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: 'El email ya está registrado', status: 409 as const };

  const refs = Array.isArray(referencias)
    ? referencias.filter((r) => r.nombre && r.relacion && r.telefono)
    : [];

  const user = await prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash(uuidv4(), 12),
      nombre,
      apellido,
      role: 'CLIENTE',
      active: false,
      dni: encryptIfDefined(dni),
      telefono: encryptIfDefined(telefono),
      direccion: encryptIfDefined(direccion),
      fechaNacimiento: encryptIfDefined(fechaNacimiento),
    },
  });

  const client = await clientsRepository.create({
    userId: user.id,
    abogadoId: abogadoId || null,
    notas: encryptIfDefined(notas),
    referencias: refs,
  });

  logger.info('CLIENTES: cliente creado', { ...actorLog, nuevoClienteId: client.id, nuevoUserId: user.id, email });
  return { client: decryptClient(client) };
}

export async function update(
  id: string,
  role: string,
  actorRole: string,
  data: Record<string, unknown>,
  actorLog: object
) {
  if (role === 'CLIENTE') return { error: 'Access denied', status: 403 as const };

  const existing = await clientsRepository.findById(id);
  if (!existing) return { error: 'Client not found', status: 404 as const };

  const { notas, abogadoId, active, referencias, nombre, apellido, dni, telefono, direccion, fechaNacimiento } = data as Record<string, unknown>;

  const userUpdate: Record<string, unknown> = {};
  if (nombre !== undefined) userUpdate.nombre = nombre;
  if (apellido !== undefined) userUpdate.apellido = apellido;
  if (dni !== undefined) userUpdate.dni = encryptIfDefined(dni as string);
  if (telefono !== undefined) userUpdate.telefono = encryptIfDefined(telefono as string);
  if (direccion !== undefined) userUpdate.direccion = encryptIfDefined(direccion as string);
  if (fechaNacimiento !== undefined) userUpdate.fechaNacimiento = encryptIfDefined(fechaNacimiento as string);

  const clientUpdate: Record<string, unknown> = {};
  if (notas !== undefined) clientUpdate.notas = encryptIfDefined(notas as string);
  if (active !== undefined) clientUpdate.active = active;
  if (actorRole === 'ADMIN' && abogadoId !== undefined) {
    clientUpdate.abogadoId = abogadoId || null;
  }
  if (Array.isArray(referencias)) {
    clientUpdate.referencias = {
      deleteMany: {},
      create: (referencias as { nombre: string; relacion: string; telefono: string }[])
        .filter((r) => r.nombre && r.relacion && r.telefono),
    };
  }

  const updated = await clientsRepository.update(id, clientUpdate, userUpdate, existing.userId);
  logger.info('CLIENTES: cliente modificado', { ...actorLog, targetClientId: id });
  return { client: decryptClient(updated) };
}

export async function deactivate(id: string, actorLog: object) {
  const existing = await clientsRepository.findById(id);
  if (!existing) return { error: 'Client not found', status: 404 as const };

  await clientsRepository.deactivate(id, existing.userId);
  logger.info('CLIENTES: cliente desactivado', { ...actorLog, targetClientId: id });
  return {};
}

export async function getStats(userId: string, role: string) {
  const [totalClients, totalUsers, abogados, recentClients] = await clientsRepository.countStats(userId, role);
  return { totalClients, totalUsers, abogados, recentClients };
}
