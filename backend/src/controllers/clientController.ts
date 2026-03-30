import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
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

function decryptClient(client: {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  telefono: string | null;
  direccion: string | null;
  fechaNacimiento: string | null;
  notas: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  abogadoId: string | null;
  userId: string | null;
  abogado?: { id: string; nombre: string; apellido: string; email: string } | null;
}) {
  return {
    ...client,
    dni: decryptIfDefined(client.dni) ?? '',
    telefono: decryptIfDefined(client.telefono),
    direccion: decryptIfDefined(client.direccion),
    fechaNacimiento: decryptIfDefined(client.fechaNacimiento),
    notas: decryptIfDefined(client.notas),
  };
}

export async function getAllClients(req: AuthRequest, res: Response): Promise<void> {
  try {
    const whereClause: Record<string, unknown> = { active: true };

    if (req.user?.role === 'ABOGADO') {
      whereClause.abogadoId = req.user.id;
    }

    if (req.user?.role === 'CLIENTE') {
      const clientProfile = await prisma.client.findFirst({
        where: { userId: req.user.id, active: true },
        include: { abogado: { select: { id: true, nombre: true, apellido: true, email: true } } },
      });

      if (!clientProfile) { res.json([]); return; }
      res.json([decryptClient(clientProfile)]);
      return;
    }

    const clients = await prisma.client.findMany({
      where: whereClause,
      include: { abogado: { select: { id: true, nombre: true, apellido: true, email: true } } },
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

    const client = await prisma.client.findUnique({
      where: { id },
      include: { abogado: { select: { id: true, nombre: true, apellido: true, email: true } } },
    });

    if (!client) {
      logger.warn('CLIENTES: cliente no encontrado', { ...actor(req), targetClientId: id });
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    if (req.user?.role === 'CLIENTE' && client.userId !== req.user.id) {
      logger.warn('CLIENTES: acceso denegado al perfil', { ...actor(req), targetClientId: id });
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    if (req.user?.role === 'ABOGADO' && client.abogadoId !== req.user.id) {
      logger.warn('CLIENTES: abogado intentó acceder a cliente ajeno', { ...actor(req), targetClientId: id });
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    logger.info('CLIENTES: perfil consultado', { ...actor(req), targetClientId: id, targetEmail: client.email });
    res.json(decryptClient(client));
  } catch (error) {
    logger.error('CLIENTES: error al consultar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createClient(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { nombre, apellido, dni, email, telefono, direccion, fechaNacimiento, notas, abogadoId, userId } = req.body;

    if (!nombre || !apellido || !dni || !email) {
      res.status(400).json({ error: 'nombre, apellido, dni and email are required' });
      return;
    }

    const assignedAbogadoId = req.user?.role === 'ABOGADO' ? req.user.id : abogadoId;

    const client = await prisma.client.create({
      data: {
        nombre, apellido,
        dni: encryptIfDefined(dni) ?? dni,
        email,
        telefono: encryptIfDefined(telefono),
        direccion: encryptIfDefined(direccion),
        fechaNacimiento: encryptIfDefined(fechaNacimiento),
        notas: encryptIfDefined(notas),
        abogadoId: assignedAbogadoId || null,
        userId: userId || null,
      },
      include: { abogado: { select: { id: true, nombre: true, apellido: true, email: true } } },
    });

    logger.info('CLIENTES: cliente creado', {
      ...actor(req),
      nuevoClienteId: client.id,
      nuevoClienteEmail: client.email,
      nuevoClienteNombre: `${nombre} ${apellido}`,
      abogadoAsignado: assignedAbogadoId || null,
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
    const { nombre, apellido, dni, email, telefono, direccion, fechaNacimiento, notas, abogadoId, active } = req.body;

    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    if (req.user?.role === 'ABOGADO' && existing.abogadoId !== req.user.id) {
      logger.warn('CLIENTES: abogado intentó editar cliente ajeno', { ...actor(req), targetClientId: id });
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    if (req.user?.role === 'CLIENTE') {
      logger.warn('CLIENTES: cliente intentó editar registro', { ...actor(req), targetClientId: id });
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const updateData: Record<string, unknown> = {
      ...(nombre !== undefined && { nombre }),
      ...(apellido !== undefined && { apellido }),
      ...(email !== undefined && { email }),
      ...(dni !== undefined && { dni: encryptIfDefined(dni) }),
      ...(telefono !== undefined && { telefono: encryptIfDefined(telefono) }),
      ...(direccion !== undefined && { direccion: encryptIfDefined(direccion) }),
      ...(fechaNacimiento !== undefined && { fechaNacimiento: encryptIfDefined(fechaNacimiento) }),
      ...(notas !== undefined && { notas: encryptIfDefined(notas) }),
      ...(active !== undefined && { active }),
    };

    if (req.user?.role === 'ADMIN' && abogadoId !== undefined) {
      updateData.abogadoId = abogadoId || null;
    }

    const camposModificados = Object.keys(updateData);

    const updated = await prisma.client.update({
      where: { id },
      data: updateData,
      include: { abogado: { select: { id: true, nombre: true, apellido: true, email: true } } },
    });

    logger.info('CLIENTES: cliente modificado', {
      ...actor(req),
      targetClientId: id,
      targetEmail: existing.email,
      targetNombre: `${existing.nombre} ${existing.apellido}`,
      camposModificados,
    });

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
      logger.warn('CLIENTES: cliente a eliminar no encontrado', { ...actor(req), targetClientId: id });
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    await prisma.client.update({ where: { id }, data: { active: false } });

    logger.info('CLIENTES: cliente desactivado', {
      ...actor(req),
      targetClientId: id,
      targetEmail: existing.email,
      targetNombre: `${existing.nombre} ${existing.apellido}`,
    });

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
        where: {
          active: true,
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    res.json({ totalClients, totalUsers, abogados, recentClients });
  } catch (error) {
    console.error('GetClientStats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
