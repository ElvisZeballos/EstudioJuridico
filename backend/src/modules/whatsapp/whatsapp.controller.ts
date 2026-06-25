import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { logger } from '../../config/logger';
import * as whatsappService from './whatsapp.service';

export async function connectWhatsApp(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.id;
  try {
    const result = await whatsappService.connect(userId);
    res.json(result);
  } catch (err) {
    logger.error('Error starting WhatsApp session', { userId, error: (err as Error).message });
    res.status(500).json({ error: 'No se pudo iniciar la sesión de WhatsApp' });
  }
}

export async function getWhatsAppStatus(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.id;
  try {
    const result = await whatsappService.getStatus(userId);
    res.json(result);
  } catch (err) {
    logger.error('Error getting WhatsApp status', { userId, error: (err as Error).message });
    res.status(500).json({ error: 'Error al obtener el estado de WhatsApp' });
  }
}

export async function disconnectWhatsApp(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.id;
  try {
    await whatsappService.disconnect(userId);
    res.json({ message: 'WhatsApp desconectado correctamente' });
  } catch (err) {
    logger.error('Error disconnecting WhatsApp', { userId, error: (err as Error).message });
    res.status(500).json({ error: 'Error al desconectar WhatsApp' });
  }
}

export async function triggerExtraction(req: AuthRequest, res: Response): Promise<void> {
  const result = await whatsappService.triggerExtraction(req.user!.id);
  res.json(result);
}

export async function testGroq(req: AuthRequest, res: Response): Promise<void> {
  const { folder } = req.query;
  if (!folder || typeof folder !== 'string') {
    res.status(400).json({ error: 'Parámetro ?folder= requerido (ruta relativa dentro de temp/)' });
    return;
  }
  try {
    const result = await whatsappService.testGroq(folder);
    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function debugWhatsApp(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await whatsappService.getDebugInfo(req.user!.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}
