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
    // Filtros opcionales: ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD (días de Bolivia, UTC-4) &limit=&offset=
    const dia = /^\d{4}-\d{2}-\d{2}$/;
    const desdeStr = typeof req.query.desde === 'string' ? req.query.desde : '';
    const hastaStr = typeof req.query.hasta === 'string' ? req.query.hasta : '';
    if ((desdeStr && !dia.test(desdeStr)) || (hastaStr && !dia.test(hastaStr))) {
      res.status(400).json({ error: 'Las fechas deben tener el formato AAAA-MM-DD' });
      return;
    }
    const desde = desdeStr ? new Date(`${desdeStr}T00:00:00-04:00`) : undefined;
    const hasta = hastaStr ? new Date(`${hastaStr}T23:59:59.999-04:00`) : undefined;
    if ((desde && isNaN(desde.getTime())) || (hasta && isNaN(hasta.getTime()))) {
      res.status(400).json({ error: 'Fecha inválida' });
      return;
    }
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? ''), 10) || 100, 1), 500);
    const offset = Math.max(parseInt(String(req.query.offset ?? ''), 10) || 0, 0);

    const novedades = await novedadesService.getNotificaciones(req.user!.id, req.user!.role, { desde, hasta, limit, offset });
    logger.info('NOVEDADES: notificaciones consultadas', { ...actor(req), total: novedades.length, desde: desdeStr || undefined, hasta: hastaStr || undefined });
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
      res.status(result.status ?? 500).json({ error: result.error });
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
      res.status(result.status ?? 500).json({ error: result.error });
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
      res.status(result.status ?? 500).json({ error: result.error });
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
      res.status(result.status ?? 500).json({ error: result.error });
      return;
    }
    res.json({ message: 'Novedad eliminada correctamente' });
  } catch (error) {
    logger.error('NOVEDADES: error al eliminar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}
export async function marcarVista(req: AuthRequest, res: Response): Promise<void> {
  try {
    const vista = req.body?.vista !== false; // por defecto marca como vista
    const result = await novedadesService.marcarVista(req.params.id, vista, req.user!.id, req.user!.role, actor(req));
    if ('error' in result) {
      res.status(result.status ?? 500).json({ error: result.error });
      return;
    }
    res.json({ leida: result.leida });
  } catch (error) {
    logger.error('NOVEDADES: error al marcar visto', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}