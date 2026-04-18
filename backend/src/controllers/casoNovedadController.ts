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

const novedadInclude = {
  autor: { select: { id: true, nombre: true, apellido: true, email: true, role: true } },
};

async function checkCasoAccess(casoId: string, userId: string, role: string) {
  const caso = await prisma.caso.findUnique({
    where: { id: casoId },
    include: { abogados: true, clientes: true },
  });
  if (!caso || !caso.active) return null;

  if (role === 'ABOGADO') {
    if (!caso.abogados.some((a) => a.abogadoId === userId)) return null;
  } else if (role === 'CLIENTE') {
    const client = await prisma.client.findFirst({ where: { userId } });
    if (!client || !caso.clientes.some((c) => c.clienteId === client.id)) return null;
  }
  return caso;
}

export async function getNovedadesByCaso(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { casoId } = req.params;
    const { id: userId, role } = req.user!;

    const caso = await checkCasoAccess(casoId, userId, role);
    if (!caso) {
      res.status(404).json({ error: 'Caso no encontrado o acceso denegado' });
      return;
    }

    const novedades = await prisma.casoNovedad.findMany({
      where: { casoId, active: true },
      include: novedadInclude,
      orderBy: { fecha: 'desc' },
    });

    logger.info('NOVEDADES: listado consultado', { ...actor(req), casoId, total: novedades.length });
    res.json(novedades);
  } catch (error) {
    logger.error('NOVEDADES: error al listar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createNovedad(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { casoId } = req.params;
    const { titulo, contenido, fecha } = req.body;
    const { id: userId, role } = req.user!;

    if (!titulo || !contenido || !fecha) {
      res.status(400).json({ error: 'Título, contenido y fecha son requeridos' });
      return;
    }

    const caso = await checkCasoAccess(casoId, userId, role);
    if (!caso) {
      res.status(404).json({ error: 'Caso no encontrado o acceso denegado' });
      return;
    }

    const novedad = await prisma.casoNovedad.create({
      data: {
        casoId,
        autorId: userId!,
        titulo,
        contenido,
        fecha: new Date(fecha),
      },
      include: novedadInclude,
    });

    logger.info('NOVEDADES: creada', { ...actor(req), novedadId: novedad.id, casoId });
    res.status(201).json(novedad);
  } catch (error) {
    logger.error('NOVEDADES: error al crear', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateNovedad(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { titulo, contenido, fecha } = req.body;
    const { id: userId, role } = req.user!;

    const existing = await prisma.casoNovedad.findUnique({ where: { id } });
    if (!existing || !existing.active) {
      res.status(404).json({ error: 'Novedad no encontrada' });
      return;
    }

    if (role === 'ABOGADO' && existing.autorId !== userId) {
      res.status(403).json({ error: 'Solo podés editar tus propias novedades' });
      return;
    }

    const updated = await prisma.casoNovedad.update({
      where: { id },
      data: {
        ...(titulo !== undefined && { titulo }),
        ...(contenido !== undefined && { contenido }),
        ...(fecha !== undefined && { fecha: new Date(fecha) }),
      },
      include: novedadInclude,
    });

    logger.info('NOVEDADES: modificada', { ...actor(req), novedadId: id });
    res.json(updated);
  } catch (error) {
    logger.error('NOVEDADES: error al modificar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteNovedad(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { id: userId, role } = req.user!;

    const existing = await prisma.casoNovedad.findUnique({ where: { id } });
    if (!existing || !existing.active) {
      res.status(404).json({ error: 'Novedad no encontrada' });
      return;
    }

    if (role === 'ABOGADO' && existing.autorId !== userId) {
      res.status(403).json({ error: 'Solo podés eliminar tus propias novedades' });
      return;
    }

    await prisma.casoNovedad.update({ where: { id }, data: { active: false } });

    logger.info('NOVEDADES: eliminada', { ...actor(req), novedadId: id });
    res.json({ message: 'Novedad eliminada correctamente' });
  } catch (error) {
    logger.error('NOVEDADES: error al eliminar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}
