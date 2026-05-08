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

const movimientoInclude = {
  caso: { select: { id: true, titulo: true, numero: true } },
  abogado: { select: { id: true, nombre: true, apellido: true, email: true } },
};

export async function getAllMovimientos(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id: userId, role } = req.user!;

    let where: Record<string, unknown> = { active: true };

    if (role === 'ABOGADO') {
      where = { active: true, abogadoId: userId };
    }

    const movimientos = await prisma.movimiento.findMany({
      where,
      include: movimientoInclude,
      orderBy: { fecha: 'desc' },
    });

    logger.info('MOVIMIENTOS: listado consultado', { ...actor(req), total: movimientos.length });
    res.json(movimientos);
  } catch (error) {
    logger.error('MOVIMIENTOS: error al listar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getMovimientosByCaso(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { casoId } = req.params;
    const { id: userId, role } = req.user!;

    const caso = await prisma.caso.findUnique({
      where: { id: casoId },
      include: { abogados: true },
    });

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
    }

    const movimientos = await prisma.movimiento.findMany({
      where: { casoId, active: true },
      include: movimientoInclude,
      orderBy: { fecha: 'desc' },
    });

    logger.info('MOVIMIENTOS: listado por caso', { ...actor(req), casoId, total: movimientos.length });
    res.json(movimientos);
  } catch (error) {
    logger.error('MOVIMIENTOS: error al listar por caso', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getMovimientoStats(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id: userId, role } = req.user!;

    let where: Record<string, unknown> = { active: true };
    if (role === 'ABOGADO') {
      where = { active: true, abogadoId: userId };
    }

    const [ingresos, egresos, total] = await Promise.all([
      prisma.movimiento.aggregate({
        where: { ...where, tipo: 'INGRESO' },
        _sum: { monto: true },
        _count: true,
      }),
      prisma.movimiento.aggregate({
        where: { ...where, tipo: 'EGRESO' },
        _sum: { monto: true },
        _count: true,
      }),
      prisma.movimiento.count({ where }),
    ]);

    const totalIngresos = Number(ingresos._sum.monto ?? 0);
    const totalEgresos = Number(egresos._sum.monto ?? 0);

    res.json({
      totalIngresos,
      totalEgresos,
      balance: totalIngresos - totalEgresos,
      totalMovimientos: total,
      cantIngresos: ingresos._count,
      cantEgresos: egresos._count,
    });
  } catch (error) {
    logger.error('MOVIMIENTOS: error al obtener stats', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getStatsByCaso(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { casoId } = req.params;
    const { id: userId, role } = req.user!;

    const caso = await prisma.caso.findUnique({
      where: { id: casoId },
      include: { abogados: true },
    });

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
    }

    const where = { casoId, active: true };

    const [ingresos, egresos, total] = await Promise.all([
      prisma.movimiento.aggregate({
        where: { ...where, tipo: 'INGRESO' },
        _sum: { monto: true },
        _count: true,
      }),
      prisma.movimiento.aggregate({
        where: { ...where, tipo: 'EGRESO' },
        _sum: { monto: true },
        _count: true,
      }),
      prisma.movimiento.count({ where }),
    ]);

    const totalIngresos = Number(ingresos._sum.monto ?? 0);
    const totalEgresos = Number(egresos._sum.monto ?? 0);

    res.json({
      totalIngresos,
      totalEgresos,
      balance: totalIngresos - totalEgresos,
      totalMovimientos: total,
      cantIngresos: ingresos._count,
      cantEgresos: egresos._count,
    });
  } catch (error) {
    logger.error('MOVIMIENTOS: error al obtener stats por caso', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createMovimiento(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { casoId, tipo, concepto, monto, fecha, notas } = req.body;
    const { id: userId, role } = req.user!;

    if (!tipo || !concepto || !monto || !fecha) {
      res.status(400).json({ error: 'Tipo, concepto, monto y fecha son requeridos' });
      return;
    }

    if (!['INGRESO', 'EGRESO'].includes(tipo)) {
      res.status(400).json({ error: 'Tipo debe ser INGRESO o EGRESO' });
      return;
    }

    if (casoId) {
      const caso = await prisma.caso.findUnique({
        where: { id: casoId },
        include: { abogados: true },
      });

      if (!caso || !caso.active) {
        res.status(404).json({ error: 'Caso no encontrado' });
        return;
      }

      if (role === 'ABOGADO') {
        const isAssigned = caso.abogados.some((a) => a.abogadoId === userId);
        if (!isAssigned) {
          res.status(403).json({ error: 'No tienes acceso a este caso' });
          return;
        }
      }
    }

    const abogadoId = role === 'ADMIN'
      ? (req.body.abogadoId || userId)
      : userId;

    const movimiento = await prisma.movimiento.create({
      data: {
        casoId: casoId || null,
        abogadoId,
        tipo,
        concepto,
        monto: parseFloat(String(monto)),
        fecha: new Date(fecha),
        notas: notas || null,
      },
      include: movimientoInclude,
    });

    logger.info('MOVIMIENTOS: creado', { ...actor(req), movimientoId: movimiento.id, tipo, monto, casoId: casoId || 'global' });
    res.status(201).json(movimiento);
  } catch (error) {
    logger.error('MOVIMIENTOS: error al crear', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateMovimiento(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { tipo, concepto, monto, fecha, notas } = req.body;
    const { id: userId, role } = req.user!;

    const existing = await prisma.movimiento.findUnique({ where: { id } });
    if (!existing || !existing.active) {
      res.status(404).json({ error: 'Movimiento no encontrado' });
      return;
    }

    if (role === 'ABOGADO' && existing.abogadoId !== userId) {
      res.status(403).json({ error: 'Acceso denegado' });
      return;
    }

    const updateData: Record<string, unknown> = {
      ...(tipo !== undefined && { tipo }),
      ...(concepto !== undefined && { concepto }),
      ...(monto !== undefined && { monto: parseFloat(String(monto)) }),
      ...(fecha !== undefined && { fecha: new Date(fecha) }),
      ...(notas !== undefined && { notas: notas || null }),
    };

    const updated = await prisma.movimiento.update({
      where: { id },
      data: updateData,
      include: movimientoInclude,
    });

    logger.info('MOVIMIENTOS: modificado', { ...actor(req), movimientoId: id });
    res.json(updated);
  } catch (error) {
    logger.error('MOVIMIENTOS: error al modificar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteMovimiento(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { id: userId, role } = req.user!;

    const existing = await prisma.movimiento.findUnique({ where: { id } });
    if (!existing || !existing.active) {
      res.status(404).json({ error: 'Movimiento no encontrado' });
      return;
    }

    if (role === 'ABOGADO' && existing.abogadoId !== userId) {
      res.status(403).json({ error: 'Acceso denegado' });
      return;
    }

    await prisma.movimiento.update({ where: { id }, data: { active: false } });

    logger.info('MOVIMIENTOS: eliminado', { ...actor(req), movimientoId: id });
    res.json({ message: 'Movimiento eliminado correctamente' });
  } catch (error) {
    logger.error('MOVIMIENTOS: error al eliminar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}
