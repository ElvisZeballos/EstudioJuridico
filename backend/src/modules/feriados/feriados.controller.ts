import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { actor } from '../../shared/actor';
import { logger } from '../../config/logger';
import * as feriadosService from './feriados.service';

export async function getAllFeriados(req: AuthRequest, res: Response): Promise<void> {
  try {
    const feriados = await feriadosService.getAll();
    res.json(feriados);
  } catch (error) {
    logger.error('FERIADOS: error al listar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createFeriado(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await feriadosService.create(req.body, actor(req));
    if ('error' in result) {
      res.status(result.status ?? 500).json({ error: result.error });
      return;
    }
    res.status(201).json(result.feriado);
  } catch (error) {
    logger.error('FERIADOS: error al crear', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteFeriado(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await feriadosService.deactivate(req.params.id, actor(req));
    if ('error' in result) {
      res.status(result.status ?? 500).json({ error: result.error });
      return;
    }
    res.json({ message: 'Feriado eliminado correctamente' });
  } catch (error) {
    logger.error('FERIADOS: error al eliminar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getConfiguracion(req: AuthRequest, res: Response): Promise<void> {
  try {
    const config = await feriadosService.getConfiguracion();
    res.json(config);
  } catch (error) {
    logger.error('FERIADOS: error al consultar configuración', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateConfiguracion(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await feriadosService.updateConfiguracion(req.body, actor(req));
    res.json(result.config);
  } catch (error) {
    logger.error('FERIADOS: error al actualizar configuración', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}