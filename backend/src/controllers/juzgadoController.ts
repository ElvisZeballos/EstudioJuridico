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

export async function getAllJuzgados(req: AuthRequest, res: Response): Promise<void> {
  try {
    const juzgados = await prisma.juzgado.findMany({
      where: { active: true },
      orderBy: { nombre: 'asc' },
    });
    logger.info('JUZGADOS: listado consultado', { ...actor(req), total: juzgados.length });
    res.json(juzgados);
  } catch (error) {
    logger.error('JUZGADOS: error al listar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getJuzgadoById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const juzgado = await prisma.juzgado.findUnique({ where: { id } });

    if (!juzgado || !juzgado.active) {
      logger.warn('JUZGADOS: no encontrado', { ...actor(req), juzgadoId: id });
      res.status(404).json({ error: 'Juzgado not found' });
      return;
    }

    logger.info('JUZGADOS: consultado', { ...actor(req), juzgadoId: id, nombre: juzgado.nombre });
    res.json(juzgado);
  } catch (error) {
    logger.error('JUZGADOS: error al consultar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createJuzgado(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { nombre, tipo, direccion, ciudad, telefono, notas } = req.body;

    if (!nombre) {
      logger.warn('JUZGADOS: creación fallida, nombre requerido', { ...actor(req) });
      res.status(400).json({ error: 'El nombre es requerido' });
      return;
    }

    const juzgado = await prisma.juzgado.create({
      data: {
        nombre,
        tipo: tipo || null,
        direccion: direccion || null,
        ciudad: ciudad || null,
        telefono: telefono || null,
        notas: notas || null,
      },
    });

    logger.info('JUZGADOS: creado', { ...actor(req), juzgadoId: juzgado.id, nombre: juzgado.nombre });
    res.status(201).json(juzgado);
  } catch (error) {
    logger.error('JUZGADOS: error al crear', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateJuzgado(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { nombre, tipo, direccion, ciudad, telefono, notas } = req.body;

    const existing = await prisma.juzgado.findUnique({ where: { id } });
    if (!existing || !existing.active) {
      logger.warn('JUZGADOS: no encontrado para modificar', { ...actor(req), juzgadoId: id });
      res.status(404).json({ error: 'Juzgado not found' });
      return;
    }

    const updateData: Record<string, unknown> = {
      ...(nombre !== undefined && { nombre }),
      ...(tipo !== undefined && { tipo }),
      ...(direccion !== undefined && { direccion }),
      ...(ciudad !== undefined && { ciudad }),
      ...(telefono !== undefined && { telefono }),
      ...(notas !== undefined && { notas }),
    };

    const updated = await prisma.juzgado.update({ where: { id }, data: updateData });

    logger.info('JUZGADOS: modificado', {
      ...actor(req),
      juzgadoId: id,
      nombre: existing.nombre,
      camposModificados: Object.keys(updateData),
    });

    res.json(updated);
  } catch (error) {
    logger.error('JUZGADOS: error al modificar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteJuzgado(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const existing = await prisma.juzgado.findUnique({ where: { id } });
    if (!existing || !existing.active) {
      logger.warn('JUZGADOS: no encontrado para eliminar', { ...actor(req), juzgadoId: id });
      res.status(404).json({ error: 'Juzgado not found' });
      return;
    }

    await prisma.juzgado.update({ where: { id }, data: { active: false } });

    logger.info('JUZGADOS: eliminado', { ...actor(req), juzgadoId: id, nombre: existing.nombre });
    res.json({ message: 'Juzgado eliminado correctamente' });
  } catch (error) {
    logger.error('JUZGADOS: error al eliminar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}
