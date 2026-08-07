import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { actor } from '../../shared/actor';
import { logger } from '../../config/logger';
import * as clientsService from './clients.service';

export async function getAllClients(req: AuthRequest, res: Response): Promise<void> {
  try {
    const clients = await clientsService.getAll(req.user!.id, req.user!.role, req.query.all as string);
    logger.info('CLIENTES: listado consultado', { ...actor(req), totalClientes: clients.length });
    res.json(clients);
  } catch (error) {
    logger.error('CLIENTES: error al listar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getClientById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await clientsService.getById(req.params.id, req.user!.id, req.user!.role);
    if ('error' in result) {
      res.status(result.status ?? 500).json({ error: result.error });
      return;
    }
    logger.info('CLIENTES: perfil consultado', { ...actor(req), targetClientId: req.params.id });
    res.json(result.client);
  } catch (error) {
    logger.error('CLIENTES: error al consultar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createClient(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await clientsService.create(req.body, req.user!.id, req.user!.role, actor(req));
    if ('error' in result) {
      res.status(result.status ?? 500).json({ error: result.error });
      return;
    }
    res.status(201).json(result.client);
  } catch (error) {
    logger.error('CLIENTES: error al crear', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateClient(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await clientsService.update(req.params.id, req.user!.role, req.user!.role, req.body, actor(req));
    if ('error' in result) {
      res.status(result.status ?? 500).json({ error: result.error });
      return;
    }
    res.json(result.client);
  } catch (error) {
    logger.error('CLIENTES: error al modificar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteClient(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await clientsService.deactivate(req.params.id, actor(req));
    if ('error' in result) {
      res.status(result.status ?? 500).json({ error: result.error });
      return;
    }
    res.json({ message: 'Client deactivated successfully' });
  } catch (error) {
    logger.error('CLIENTES: error al desactivar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getClientStats(req: AuthRequest, res: Response): Promise<void> {
  try {
    const stats = await clientsService.getStats(req.user!.id, req.user!.role);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
