import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { actor } from '../../shared/actor';
import { logger } from '../../config/logger';
import * as casosService from './casos.service';

export async function getAllCasos(req: AuthRequest, res: Response): Promise<void> {
  try {
    const casos = await casosService.getAll(req.user!.id, req.user!.role);
    logger.info('CASOS: listado consultado', { ...actor(req), total: casos.length });
    res.json(casos);
  } catch (error) {
    logger.error('CASOS: error al listar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getCasoById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await casosService.getById(req.params.id, req.user!.id, req.user!.role);
    if ('error' in result) {
      res.status(result.status ?? 500).json({ error: result.error });
      return;
    }
    logger.info('CASOS: consultado', { ...actor(req), casoId: req.params.id });
    res.json(result.caso);
  } catch (error) {
    logger.error('CASOS: error al consultar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getCasoHistorial(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await casosService.getHistorial(req.params.id, req.user!.id, req.user!.role);
    if ('error' in result) {
      res.status(result.status ?? 500).json({ error: result.error });
      return;
    }
    res.json(result.historial);
  } catch (error) {
    logger.error('CASOS: error al consultar historial', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createCaso(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await casosService.create(req.body, actor(req));
    if ('error' in result) {
      res.status(result.status ?? 500).json({ error: result.error });
      return;
    }
    res.status(201).json(result.caso);
  } catch (error) {
    logger.error('CASOS: error al crear', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateCaso(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await casosService.update(req.params.id, req.user!.id, req.user!.role, req.body, actor(req));
    if ('error' in result) {
      res.status(result.status ?? 500).json({ error: result.error });
      return;
    }
    res.json(result.caso);
  } catch (error) {
    logger.error('CASOS: error al modificar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteCaso(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await casosService.deactivate(req.params.id, actor(req));
    if ('error' in result) {
      res.status(result.status ?? 500).json({ error: result.error });
      return;
    }
    res.json({ message: 'Caso eliminado correctamente' });
  } catch (error) {
    logger.error('CASOS: error al eliminar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}
