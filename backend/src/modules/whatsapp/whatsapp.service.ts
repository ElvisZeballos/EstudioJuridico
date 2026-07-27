import fs from 'fs';
import path from 'path';
import { logger } from '../../config/logger';
import {
  startWhatsAppSession,
  getSessionStatus,
  getDbSessionStatus,
  disconnectWhatsApp,
} from '../../services/whatsappService';
import { runExtractionForUser } from '../../services/whatsappRunner';
import { analyzeNotificationsWithGroq } from '../../infrastructure/groq';
import prisma from '../../shared/prisma';

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚüÜñÑ\- ]/g, '_').trim().slice(0, 30);
}

export async function findUserExtractionDir(userId: string): Promise<string | null> {
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

export async function connect(userId: string) {
  await startWhatsAppSession(userId);
  return { status: 'STARTING' };
}

export async function getStatus(userId: string) {
  const memStatus = getSessionStatus(userId);
  if (memStatus.status !== 'DISCONNECTED') {
    return { ...memStatus, hasSession: true };
  }
  const dbStatus = await getDbSessionStatus(userId);
  return {
    status: dbStatus.connected ? 'CONNECTED' : 'DISCONNECTED',
    qr: null,
    hasSession: dbStatus.hasSession,
  };
}

export async function disconnect(userId: string) {
  await disconnectWhatsApp(userId);
  return {};
}

export async function triggerExtraction(userId: string) {
  logger.info(`Extracción manual iniciada por usuario ${userId}`);
  runExtractionForUser(userId).catch((err) =>
    logger.error(`Error en extracción manual de ${userId}: ${(err as Error).message}`)
  );
  return { message: 'Extracción iniciada. Los resultados se guardarán en la carpeta temp del servidor.' };
}

type ServiceError = { error: string; status: number };

export async function testGroq(folder: string): Promise<ServiceError | { message: string; userDir: string }> {
  const tempBase = path.resolve(process.cwd(), 'temp');
  const userDir = path.resolve(tempBase, folder);
  if (!userDir.startsWith(tempBase + path.sep)) {
    return { error: 'Ruta no permitida', status: 400 as const };
  }
  if (!fs.existsSync(userDir)) {
    return { error: `Carpeta no encontrada: ${userDir}`, status: 404 as const };
  }
  await analyzeNotificationsWithGroq(userDir);
  return { message: 'Análisis completado', userDir };
}

export async function getDebugInfo(userId: string) {
  const memStatus = getSessionStatus(userId);
  const dbStatus = await getDbSessionStatus(userId);

  let messageCount = 0;
  let oldestMessage: Date | null = null;
  let newestMessage: Date | null = null;
  let prismaHasModel = false;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  return { sessionInMemory: memStatus.status, sessionInDb: dbStatus, prismaHasWhatsAppMessageModel: prismaHasModel, messageCount, oldestMessage, newestMessage };
}
