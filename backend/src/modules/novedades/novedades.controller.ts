import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { actor } from '../../shared/actor';
import { logger } from '../../config/logger';
import * as novedadesService from './novedades.service';

export async function getNovedadesAgendadas(req: AuthRequest, res: Response): Promise<void> {
  try {
    const novedades = await novedadesService.getAgendadas(req.user!.id, req.user!.role);
    logger.info('NOVEDADES: agendadas consultadas', { ...actor(req), total: novedades.length });
    res.json(novedades);
  } catch (error) {
    logger.error('NOVEDADES: error al listar agendadas', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getNovedadesNotificaciones(req: AuthRequest, res: Response): Promise<void> {
  try {
    const novedades = await novedadesService.getNotificaciones(req.user!.id, req.user!.role);
    logger.info('NOVEDADES: notificaciones consultadas', { ...actor(req), total: novedades.length });
    res.json(novedades);
  } catch (error) {
    logger.error('NOVEDADES: error al listar notificaciones', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getNovedadesByCaso(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await novedadesService.getByCaso(req.params.casoId, req.user!.id, req.user!.role);
    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    logger.info('NOVEDADES: listado consultado', { ...actor(req), casoId: req.params.casoId, total: result.novedades.length });
    res.json(result.novedades);
  } catch (error) {
    logger.error('NOVEDADES: error al listar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createNovedad(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await novedadesService.create(req.params.casoId, req.user!.id, req.user!.role, req.body, actor(req));
    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.status(201).json(result.novedad);
  } catch (error) {
    logger.error('NOVEDADES: error al crear', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateNovedad(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await novedadesService.update(req.params.id, req.user!.id, req.user!.role, req.body, actor(req));
    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json(result.novedad);
  } catch (error) {
    logger.error('NOVEDADES: error al modificar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteNovedad(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await novedadesService.deactivate(req.params.id, req.user!.id, req.user!.role, actor(req));
    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ message: 'Novedad eliminada correctamente' });
  } catch (error) {
    logger.error('NOVEDADES: error al eliminar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}
