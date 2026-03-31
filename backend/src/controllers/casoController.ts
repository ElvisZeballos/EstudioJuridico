import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
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

const casoInclude = {
  abogados: {
    include: {
      abogado: { select: { id: true, nombre: true, apellido: true, email: true } },
    },
  },
  clientes: {
    include: {
      cliente: { select: { id: true, nombre: true, apellido: true, email: true } },
    },
  },
};

export async function getAllCasos(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { role, id: userId } = req.user!;

    let where: Record<string, unknown> = { active: true };

    if (role === 'ABOGADO') {
      where = { active: true, abogados: { some: { abogadoId: userId } } };
    } else if (role === 'CLIENTE') {
      const client = await prisma.client.findFirst({ where: { userId } });
      if (!client) {
        res.json([]);
        return;
      }
      where = { active: true, clientes: { some: { clienteId: client.id } } };
    }

    const casos = await prisma.caso.findMany({
      where,
      include: casoInclude,
      orderBy: { createdAt: 'desc' },
    });

    logger.info('CASOS: listado consultado', { ...actor(req), total: casos.length });
    res.json(casos);
  } catch (error) {
    logger.error('CASOS: error al listar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getCasoById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user!;

    const caso = await prisma.caso.findUnique({ where: { id }, include: casoInclude });

    if (!caso || !caso.active) {
      res.status(404).json({ error: 'Caso no encontrado' });
      return;
    }

    if (role === 'ABOGADO') {
      const isAssigned = caso.abogados.some((a) => a.abogadoId === userId);
      if (!isAssigned) {
        res.status(403).json({ error: 'Acceso denegado' });
        return;
      }
    } else if (role === 'CLIENTE') {
      const client = await prisma.client.findFirst({ where: { userId } });
      const isAssigned = client && caso.clientes.some((c) => c.clienteId === client.id);
      if (!isAssigned) {
        res.status(403).json({ error: 'Acceso denegado' });
        return;
      }
    }

    logger.info('CASOS: consultado', { ...actor(req), casoId: id });
    res.json(caso);
  } catch (error) {
    logger.error('CASOS: error al consultar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createCaso(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { titulo, descripcion, estado, numero, fechaInicio, fechaCierre, notas, abogadoIds, clienteIds } = req.body;

    if (!titulo) {
      res.status(400).json({ error: 'El título es requerido' });
      return;
    }
    if (!abogadoIds || !Array.isArray(abogadoIds) || abogadoIds.length === 0) {
      res.status(400).json({ error: 'Se requiere al menos un abogado' });
      return;
    }
    if (!clienteIds || !Array.isArray(clienteIds) || clienteIds.length === 0) {
      res.status(400).json({ error: 'Se requiere al menos un cliente' });
      return;
    }

    const caso = await prisma.caso.create({
      data: {
        titulo,
        descripcion: descripcion || null,
        estado: estado || 'ACTIVO',
        numero: numero || null,
        fechaInicio: fechaInicio ? new Date(fechaInicio) : null,
        fechaCierre: fechaCierre ? new Date(fechaCierre) : null,
        notas: notas || null,
        abogados: {
          create: abogadoIds.map((abogadoId: string) => ({ abogadoId })),
        },
        clientes: {
          create: clienteIds.map((clienteId: string) => ({ clienteId })),
        },
      },
      include: casoInclude,
    });

    logger.info('CASOS: creado', { ...actor(req), casoId: caso.id, titulo: caso.titulo });
    res.status(201).json(caso);
  } catch (error) {
    logger.error('CASOS: error al crear', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateCaso(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { titulo, descripcion, estado, numero, fechaInicio, fechaCierre, notas, abogadoIds, clienteIds } = req.body;
    const { role, id: userId } = req.user!;

    const existing = await prisma.caso.findUnique({ where: { id }, include: casoInclude });
    if (!existing || !existing.active) {
      res.status(404).json({ error: 'Caso no encontrado' });
      return;
    }

    if (role === 'ABOGADO') {
      const isAssigned = existing.abogados.some((a) => a.abogadoId === userId);
      if (!isAssigned) {
        res.status(403).json({ error: 'Acceso denegado' });
        return;
      }
    }

    const updateData: Record<string, unknown> = {
      ...(titulo !== undefined && { titulo }),
      ...(descripcion !== undefined && { descripcion }),
      ...(estado !== undefined && { estado }),
      ...(numero !== undefined && { numero }),
      ...(fechaInicio !== undefined && { fechaInicio: fechaInicio ? new Date(fechaInicio) : null }),
      ...(fechaCierre !== undefined && { fechaCierre: fechaCierre ? new Date(fechaCierre) : null }),
      ...(notas !== undefined && { notas }),
    };

    // Update relations if provided
    if (abogadoIds && Array.isArray(abogadoIds)) {
      await prisma.casoAbogado.deleteMany({ where: { casoId: id } });
      updateData.abogados = { create: abogadoIds.map((abogadoId: string) => ({ abogadoId })) };
    }
    if (clienteIds && Array.isArray(clienteIds)) {
      await prisma.casoCliente.deleteMany({ where: { casoId: id } });
      updateData.clientes = { create: clienteIds.map((clienteId: string) => ({ clienteId })) };
    }

    const updated = await prisma.caso.update({ where: { id }, data: updateData, include: casoInclude });

    logger.info('CASOS: modificado', { ...actor(req), casoId: id, camposModificados: Object.keys(updateData) });
    res.json(updated);
  } catch (error) {
    logger.error('CASOS: error al modificar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteCaso(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const existing = await prisma.caso.findUnique({ where: { id } });
    if (!existing || !existing.active) {
      res.status(404).json({ error: 'Caso no encontrado' });
      return;
    }

    await prisma.caso.update({ where: { id }, data: { active: false } });

    logger.info('CASOS: eliminado', { ...actor(req), casoId: id, titulo: existing.titulo });
    res.json({ message: 'Caso eliminado correctamente' });
  } catch (error) {
    logger.error('CASOS: error al eliminar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}
