import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest } from '../middleware/auth';
import { encryptIfDefined, decryptIfDefined } from '../config/encryption';
import { logger } from '../config/logger';

const prisma = new PrismaClient();

function actor(req: AuthRequest) {
  return {
    actorId: req.user?.id,
    actorEmail: req.user?.email,
    actorRole: req.user?.role,
    ip: req.ip || req.socket.remoteAddress,
  };
}

interface ClientRaw {
  id: string;
  userId: string;
  abogadoId: string | null;
  notas: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    nombre: string;
    apellido: string;
    email: string;
    dni: string | null;
    telefono: string | null;
    direccion: string | null;
    fechaNacimiento: string | null;
    active: boolean;
    photoPath: string | null;
  };
  abogado?: { id: string; nombre: string; apellido: string; email: string } | null;
  referencias?: { id: string; nombre: string; relacion: string; telefono: string }[];
}

function decryptClient(client: ClientRaw) {
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
    // Personal data from User — single source of truth
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

const CLIENT_INCLUDE = {
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
};

export async function getAllClients(req: AuthRequest, res: Response): Promise<void> {
  try {
    const whereClause: Record<string, unknown> = { active: true };

    if (req.user?.role === 'ABOGADO' && req.query.all !== 'true') {
      whereClause.casos = {
        some: {
          caso: { abogados: { some: { abogadoId: req.user.id } } },
        },
      };
    }

    if (req.user?.role === 'CLIENTE') {
      const clientProfile = await prisma.client.findFirst({
        where: { userId: req.user.id, active: true },
        include: CLIENT_INCLUDE,
      });
      if (!clientProfile) { res.json([]); return; }
      res.json([decryptClient(clientProfile)]);
      return;
    }

    const clients = await prisma.client.findMany({
      where: whereClause,
      include: CLIENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    logger.info('CLIENTES: listado consultado', { ...actor(req), totalClientes: clients.length });
    res.json(clients.map(decryptClient));
  } catch (error) {
    logger.error('CLIENTES: error al listar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getClientById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const client = await prisma.client.findUnique({ where: { id }, include: CLIENT_INCLUDE });
    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    if (req.user?.role === 'CLIENTE' && client.userId !== req.user.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    logger.info('CLIENTES: perfil consultado', { ...actor(req), targetClientId: id });
    res.json(decryptClient(client));
  } catch (error) {
    logger.error('CLIENTES: error al consultar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Creating a client = creating a User(CLIENTE) + Client record
export async function createClient(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { nombre, apellido, email, dni, telefono, direccion, fechaNacimiento, notas, abogadoId, referencias } = req.body;

    if (!nombre || !apellido || !email) {
      res.status(400).json({ error: 'nombre, apellido y email son requeridos' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'El email ya está registrado' });
      return;
    }

    const refs: { nombre: string; relacion: string; telefono: string }[] =
      Array.isArray(referencias) ? referencias.filter((r) => r.nombre && r.relacion && r.telefono) : [];

    const placeholderPassword = await bcrypt.hash(uuidv4(), 12);

    const user = await prisma.user.create({
      data: {
        email,
        password: placeholderPassword,
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

    const client = await prisma.client.create({
      data: {
        userId: user.id,
        abogadoId: abogadoId || null,
        notas: encryptIfDefined(notas),
        referencias: refs.length > 0 ? { create: refs } : undefined,
      },
      include: CLIENT_INCLUDE,
    });

    logger.info('CLIENTES: cliente creado', {
      ...actor(req),
      nuevoClienteId: client.id,
      nuevoUserId: user.id,
      email,
    });

    res.status(201).json(decryptClient(client));
  } catch (error) {
    logger.error('CLIENTES: error al crear', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateClient(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { notas, abogadoId, active, referencias, nombre, apellido, dni, telefono, direccion, fechaNacimiento } = req.body;

    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    if (req.user?.role === 'CLIENTE') {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Update User personal data if provided
    const userUpdate: Record<string, unknown> = {};
    if (nombre !== undefined) userUpdate.nombre = nombre;
    if (apellido !== undefined) userUpdate.apellido = apellido;
    if (dni !== undefined) userUpdate.dni = encryptIfDefined(dni);
    if (telefono !== undefined) userUpdate.telefono = encryptIfDefined(telefono);
    if (direccion !== undefined) userUpdate.direccion = encryptIfDefined(direccion);
    if (fechaNacimiento !== undefined) userUpdate.fechaNacimiento = encryptIfDefined(fechaNacimiento);

    if (Object.keys(userUpdate).length > 0) {
      await prisma.user.update({ where: { id: existing.userId }, data: userUpdate });
    }

    // Update Client-specific fields
    const clientUpdate: Record<string, unknown> = {};
    if (notas !== undefined) clientUpdate.notas = encryptIfDefined(notas);
    if (active !== undefined) clientUpdate.active = active;
    if (req.user?.role === 'ADMIN' && abogadoId !== undefined) {
      clientUpdate.abogadoId = abogadoId || null;
    }
    if (Array.isArray(referencias)) {
      clientUpdate.referencias = {
        deleteMany: {},
        create: referencias.filter((r) => r.nombre && r.relacion && r.telefono),
      };
    }

    const updated = await prisma.client.update({
      where: { id },
      data: clientUpdate,
      include: CLIENT_INCLUDE,
    });

    logger.info('CLIENTES: cliente modificado', { ...actor(req), targetClientId: id });
    res.json(decryptClient(updated));
  } catch (error) {
    logger.error('CLIENTES: error al modificar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteClient(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    await prisma.client.update({ where: { id }, data: { active: false } });
    await prisma.user.update({ where: { id: existing.userId }, data: { active: false } });

    logger.info('CLIENTES: cliente desactivado', { ...actor(req), targetClientId: id });
    res.json({ message: 'Client deactivated successfully' });
  } catch (error) {
    logger.error('CLIENTES: error al desactivar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getClientStats(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const [totalClients, totalUsers, abogados, recentClients] = await Promise.all([
      prisma.client.count({ where: { active: true } }),
      prisma.user.count({ where: { active: true } }),
      prisma.user.count({ where: { active: true, role: 'ABOGADO' } }),
      prisma.client.count({
        where: { active: true, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      }),
    ]);
    res.json({ totalClients, totalUsers, abogados, recentClients });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
