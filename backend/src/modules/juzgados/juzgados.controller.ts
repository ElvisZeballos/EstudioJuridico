import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { actor } from '../../shared/actor';
import { logger } from '../../config/logger';
import * as juzgadosService from './juzgados.service';

export async function getAllJuzgados(req: AuthRequest, res: Response): Promise<void> {
  try {
    const juzgados = await juzgadosService.getAll();
    logger.info('JUZGADOS: listado consultado', { ...actor(req), total: juzgados.length });
    res.json(juzgados);
  } catch (error) {
    logger.error('JUZGADOS: error al listar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getJuzgadoById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await juzgadosService.getById(req.params.id, actor(req));
    if ('error' in result) {
      res.status(result.status ?? 500).json({ error: result.error });
      return;
    }
    logger.info('JUZGADOS: consultado', { ...actor(req), juzgadoId: req.params.id });
    res.json(result.juzgado);
  } catch (error) {
    logger.error('JUZGADOS: error al consultar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createJuzgado(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await juzgadosService.create(req.body, actor(req));
    if ('error' in result) {
      res.status(result.status ?? 500).json({ error: result.error });
      return;
    }
    res.status(201).json(result.juzgado);
  } catch (error) {
    logger.error('JUZGADOS: error al crear', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateJuzgado(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await juzgadosService.update(req.params.id, req.body, actor(req));
    if ('error' in result) {
      res.status(result.status ?? 500).json({ error: result.error });
      return;
    }
    res.json(result.juzgado);
  } catch (error) {
    logger.error('JUZGADOS: error al modificar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteJuzgado(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await juzgadosService.deactivate(req.params.id, actor(req));
    if ('error' in result) {
      res.status(result.status ?? 500).json({ error: result.error });
      return;
    }
    res.json({ message: 'Juzgado eliminado correctamente' });
  } catch (error) {
    logger.error('JUZGADOS: error al eliminar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}
