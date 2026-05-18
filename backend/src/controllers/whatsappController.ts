import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { AuthRequest } from '../middleware/auth';
import {
  startWhatsAppSession,
  getSessionStatus,
  getDbSessionStatus,
  disconnectWhatsApp,
} from '../services/whatsappService';
import { runExtractionForUser } from '../services/whatsappRunner';
import { analyzeNotificationsWithGroq } from '../services/groqService';
import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';

const prisma = new PrismaClient();

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚüÜñÑ\- ]/g, '_').trim().slice(0, 30);
}

async function findUserExtractionDir(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { nombre: true, apellido: true },
  });
  if (!user) return null;

  const folderSuffix = `_${sanitizeName(user.nombre)}_${sanitizeName(user.apellido)}`;
  const tempDir = path.join(process.cwd(), 'temp');
  if (!fs.existsSync(tempDir)) return null;

  const dateFolders = fs.readdirSync(tempDir)
    .filter((f) => f.startsWith('whatsapp_'))
    .sort()
    .reverse();

  for (const dateFolder of dateFolders) {
    const dateDir = path.join(tempDir, dateFolder);
    const match = fs.readdirSync(dateDir).find((f) => f.endsWith(folderSuffix));
    if (match) return path.join(dateDir, match);
  }
  return null;
}

export async function connectWhatsApp(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.id;
  try {
    await startWhatsAppSession(userId);
    res.json({ status: 'STARTING' });
  } catch (err: unknown) {
    logger.error('Error starting WhatsApp session', { userId, error: (err as Error).message });
    res.status(500).json({ error: 'No se pudo iniciar la sesión de WhatsApp' });
  }
}

export async function getWhatsAppStatus(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.id;
  try {
    const memStatus = getSessionStatus(userId);
    if (memStatus.status !== 'DISCONNECTED') {
      res.json({ ...memStatus, hasSession: true });
      return;
    }
    const dbStatus = await getDbSessionStatus(userId);
    res.json({
      status: dbStatus.connected ? 'CONNECTED' : 'DISCONNECTED',
      qr: null,
      hasSession: dbStatus.hasSession,
    });
  } catch (err: unknown) {
    logger.error('Error getting WhatsApp status', { userId, error: (err as Error).message });
    res.status(500).json({ error: 'Error al obtener el estado de WhatsApp' });
  }
}

export async function disconnectWhatsAppHandler(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.id;
  try {
    await disconnectWhatsApp(userId);
    res.json({ message: 'WhatsApp desconectado correctamente' });
  } catch (err: unknown) {
    logger.error('Error disconnecting WhatsApp', { userId, error: (err as Error).message });
    res.status(500).json({ error: 'Error al desconectar WhatsApp' });
  }
}

export async function triggerExtractionHandler(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.id;
  logger.info(`Extracción manual iniciada por usuario ${userId}`);
  runExtractionForUser(userId).catch((err) =>
    logger.error(`Error en extracción manual de ${userId}: ${(err as Error).message}`)
  );
  res.json({ message: 'Extracción iniciada. Los resultados se guardarán en la carpeta temp del servidor.' });
}

export async function testGroqHandler(req: AuthRequest, res: Response): Promise<void> {
  const { folder } = req.query;
  if (!folder || typeof folder !== 'string') {
    res.status(400).json({ error: 'Parámetro ?folder= requerido (ruta relativa dentro de temp/)' });
    return;
  }
  const userDir = require('path').join(process.cwd(), 'temp', folder);
  if (!require('fs').existsSync(userDir)) {
    res.status(404).json({ error: `Carpeta no encontrada: ${userDir}` });
    return;
  }
  try {
    await analyzeNotificationsWithGroq(userDir);
    res.json({ message: 'Análisis completado', userDir });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function debugWhatsAppHandler(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.id;
  try {
    const memStatus = getSessionStatus(userId);
    const dbStatus = await getDbSessionStatus(userId);

    let messageCount = 0;
    let oldestMessage: Date | null = null;
    let newestMessage: Date | null = null;
    let prismaHasModel = false;

    try {
      const rows = await (prisma as any).whatsAppMessage.findMany({
        where: { userId },
        select: { timestamp: true },
        orderBy: { timestamp: 'asc' },
      });
      prismaHasModel = true;
      messageCount = rows.length;
      if (rows.length > 0) {
        oldestMessage = rows[0].timestamp;
        newestMessage = rows[rows.length - 1].timestamp;
      }
    } catch {
      prismaHasModel = false;
    }

    res.json({
      sessionInMemory: memStatus.status,
      sessionInDb: dbStatus,
      prismaHasWhatsAppMessageModel: prismaHasModel,
      messageCount,
      oldestMessage,
      newestMessage,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
}
