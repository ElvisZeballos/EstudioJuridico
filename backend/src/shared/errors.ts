import { Response } from 'express';
import { logger } from '../config/logger';

export function sendNotFound(res: Response, msg = 'Recurso no encontrado'): void {
  res.status(404).json({ error: msg });
}

export function sendForbidden(res: Response, msg = 'Acceso denegado'): void {
  res.status(403).json({ error: msg });
}

export function sendBadRequest(res: Response, msg: string): void {
  res.status(400).json({ error: msg });
}

export function sendConflict(res: Response, msg: string): void {
  res.status(409).json({ error: msg });
}

export function sendServerError(res: Response, context: string, error: unknown): void {
  logger.error(context, { error: (error as Error).message });
  res.status(500).json({ error: 'Internal server error' });
}
