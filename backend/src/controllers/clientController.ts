import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { encryptIfDefined, decryptIfDefined } from '../config/encryption';

const prisma = new PrismaClient();

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

    // Abogados only see their own clients
    if (req.user?.role === 'ABOGADO') {
      whereClause.abogadoId = req.user.id;
    }

    // Clientes can only see their own profile
    if (req.user?.role === 'CLIENTE') {
      const clientProfile = await prisma.client.findFirst({
        where: { userId: req.user.id, active: true },
        include: { abogado: { select: { id: true, nombre: true, apellido: true, email: true } } },
      });

      if (!clientProfile) {
        res.json([]);
        return;
      }

      res.json([decryptClient(clientProfile)]);
      return;
    }

    const clients = await prisma.client.findMany({
      where: whereClause,
      include: {
        abogado: { select: { id: true, nombre: true, apellido: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(clients.map(decryptClient));
  } catch (error) {
    console.error('GetAllClients error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getClientById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        abogado: { select: { id: true, nombre: true, apellido: true, email: true } },
      },
    });

    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    // Clientes can only view their own profile
    if (req.user?.role === 'CLIENTE' && client.userId !== req.user.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Abogados can only view their clients
    if (req.user?.role === 'ABOGADO' && client.abogadoId !== req.user.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json(decryptClient(client));
  } catch (error) {
    console.error('GetClientById error:', error);
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

    // Abogados can only create clients assigned to themselves
    const assignedAbogadoId = req.user?.role === 'ABOGADO' ? req.user.id : abogadoId;

    const client = await prisma.client.create({
      data: {
        nombre,
        apellido,
        dni: encryptIfDefined(dni) ?? dni,
        email,
        telefono: encryptIfDefined(telefono),
        direccion: encryptIfDefined(direccion),
        fechaNacimiento: encryptIfDefined(fechaNacimiento),
        notas: encryptIfDefined(notas),
        abogadoId: assignedAbogadoId || null,
        userId: userId || null,
      },
      include: {
        abogado: { select: { id: true, nombre: true, apellido: true, email: true } },
      },
    });

    res.status(201).json(decryptClient(client));
  } catch (error) {
    console.error('CreateClient error:', error);
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

    // Abogados can only edit their clients
    if (req.user?.role === 'ABOGADO' && existing.abogadoId !== req.user.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Clientes cannot edit client records
    if (req.user?.role === 'CLIENTE') {
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

    const updated = await prisma.client.update({
      where: { id },
      data: updateData,
      include: {
        abogado: { select: { id: true, nombre: true, apellido: true, email: true } },
      },
    });

    res.json(decryptClient(updated));
  } catch (error) {
    console.error('UpdateClient error:', error);
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

    // Soft delete
    await prisma.client.update({
      where: { id },
      data: { active: false },
    });

    res.json({ message: 'Client deactivated successfully' });
  } catch (error) {
    console.error('DeleteClient error:', error);
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
