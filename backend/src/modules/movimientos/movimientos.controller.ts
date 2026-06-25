import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { actor } from '../../shared/actor';
import { logger } from '../../config/logger';
import * as movimientosService from './movimientos.service';

export async function getAllMovimientos(req: AuthRequest, res: Response): Promise<void> {
  try {
    const movimientos = await movimientosService.getAll(req.user!.id, req.user!.role);
    logger.info('MOVIMIENTOS: listado consultado', { ...actor(req), total: movimientos.length });
    res.json(movimientos);
  } catch (error) {
    logger.error('MOVIMIENTOS: error al listar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getMovimientosByCaso(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await movimientosService.getByCaso(req.params.casoId, req.user!.id, req.user!.role);
    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    logger.info('MOVIMIENTOS: listado por caso', { ...actor(req), casoId: req.params.casoId, total: result.movimientos.length });
    res.json(result.movimientos);
  } catch (error) {
    logger.error('MOVIMIENTOS: error al listar por caso', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getMovimientoStats(req: AuthRequest, res: Response): Promise<void> {
  try {
    const stats = await movimientosService.getStats(req.user!.id, req.user!.role);
    res.json(stats);
  } catch (error) {
    logger.error('MOVIMIENTOS: error al obtener stats', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getStatsByCaso(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await movimientosService.getStatsByCaso(req.params.casoId, req.user!.id, req.user!.role);
    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json(result);
  } catch (error) {
    logger.error('MOVIMIENTOS: error al obtener stats por caso', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createMovimiento(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await movimientosService.create(req.body, req.user!.id, req.user!.role, actor(req));
    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.status(201).json(result.movimiento);
  } catch (error) {
    logger.error('MOVIMIENTOS: error al crear', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateMovimiento(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await movimientosService.update(req.params.id, req.user!.id, req.user!.role, req.body, actor(req));
    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json(result.movimiento);
  } catch (error) {
    logger.error('MOVIMIENTOS: error al modificar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteMovimiento(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await movimientosService.deactivate(req.params.id, req.user!.id, req.user!.role, actor(req));
    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ message: 'Movimiento eliminado correctamente' });
  } catch (error) {
    logger.error('MOVIMIENTOS: error al eliminar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}
