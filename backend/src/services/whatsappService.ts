import makeWASocket, {
  DisconnectReason,
  initAuthCreds,
  BufferJSON,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  AuthenticationCreds,
  WASocket,
  proto,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import QRCode from 'qrcode';
import { PrismaClient } from '@prisma/client';
import pino from 'pino';
import { logger } from '../config/logger';

const prisma = new PrismaClient();
const baileysLogger = pino({ level: 'silent' });

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 3_000;
const LOOK_BACK_MS = 48 * 60 * 60 * 1000; // keep 48h in DB

type SessionStatus = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED';

interface ActiveSession {
  socket: WASocket;
  qr: string | null;
  status: SessionStatus;
  reconnectAttempts: number;
  intentionalDisconnect: boolean;
}

const activeSessions = new Map<string, ActiveSession>();

// ─── Persistence ─────────────────────────────────────────────────────────────

async function persistMessages(userId: string, msgs: proto.IWebMessageInfo[]): Promise<void> {
  const rows = msgs
    .filter((m) => m.key?.id && m.key?.remoteJid && m.messageTimestamp)
    .map((m) => ({
      userId,
      messageId: m.key!.id!,
      remoteJid: m.key!.remoteJid!,
      timestamp: new Date(Number(m.messageTimestamp) * 1000),
      rawJson: JSON.stringify(m, BufferJSON.replacer),
    }));

  if (rows.length === 0) return;

  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    await Promise.all(
      batch.map((row) =>
        (prisma as any).whatsAppMessage.upsert({
          where: { userId_messageId: { userId: row.userId, messageId: row.messageId } },
          update: {},
          create: row,
        })
      )
    );
  }
}

export async function getAccumulatedMessages(userId: string): Promise<proto.IWebMessageInfo[]> {
  const cutoff = new Date(Date.now() - LOOK_BACK_MS);
  const rows = await (prisma as any).whatsAppMessage.findMany({
    where: { userId, timestamp: { gte: cutoff } },
    select: { rawJson: true },
  });
  return rows.map((r: { rawJson: string }) =>
    JSON.parse(r.rawJson, BufferJSON.reviver) as proto.IWebMessageInfo
  );
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function buildAuthState(userId: string) {
  const dbSession = await prisma.whatsAppSession.findUnique({ where: { userId } });

  let creds: AuthenticationCreds = initAuthCreds();
  let keysData: Record<string, Record<string, unknown>> = {};

  if (dbSession?.creds) {
    try {
      creds = JSON.parse(dbSession.creds, BufferJSON.reviver);
      keysData = JSON.parse(dbSession.keys || '{}', BufferJSON.reviver);
    } catch {
      creds = initAuthCreds();
    }
  }

  const persist = async () => {
    await prisma.whatsAppSession.upsert({
      where: { userId },
      update: {
        creds: JSON.stringify(creds, BufferJSON.replacer),
        keys: JSON.stringify(keysData, BufferJSON.replacer),
      },
      create: {
        userId,
        creds: JSON.stringify(creds, BufferJSON.replacer),
        keys: JSON.stringify(keysData, BufferJSON.replacer),
      },
    });
  };

  const rawKeyStore = {
    get: async (type: string, ids: string[]) => {
      const result: Record<string, unknown> = {};
      for (const id of ids) {
        const val = keysData[type]?.[id];
        if (val !== undefined) result[id] = val;
      }
      return result;
    },
    set: async (data: Record<string, Record<string, unknown>>) => {
      for (const category of Object.keys(data)) {
        if (!keysData[category]) keysData[category] = {};
        for (const id of Object.keys(data[category] ?? {})) {
          if (data[category][id] == null) {
            delete keysData[category][id];
          } else {
            keysData[category][id] = data[category][id];
          }
        }
      }
      await persist();
    },
    transaction: async <T>(exec: () => Promise<T>) => exec(),
  };

  const keys = makeCacheableSignalKeyStore(rawKeyStore as never, baileysLogger);

  return { state: { creds, keys }, saveCreds: persist };
}

// ─── Session management ───────────────────────────────────────────────────────

export async function startWhatsAppSession(userId: string): Promise<void> {
  const existing = activeSessions.get(userId);
  if (existing?.status === 'CONNECTED' || existing?.status === 'CONNECTING') return;

  const { state, saveCreds } = await buildAuthState(userId);

  const reconnectAttempts = existing?.reconnectAttempts ?? 0;

  const sessionData: ActiveSession = {
    socket: null as unknown as WASocket,
    qr: null,
    status: 'CONNECTING',
    reconnectAttempts,
    intentionalDisconnect: false,
  };
  activeSessions.set(userId, sessionData);

  const { version } = await fetchLatestBaileysVersion();
  const socket = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: baileysLogger,
    browser: ['EstudioJuridico', 'Chrome', '1.0.0'],
    syncFullHistory: true,
    shouldSyncHistoryMessage: () => true,
  });

  sessionData.socket = socket;

  socket.ev.on('creds.update', saveCreds);

  socket.ev.on('messaging-history.set', ({ messages: msgs }) => {
    persistMessages(userId, msgs).catch((err) =>
      logger.error(`WhatsApp: error guardando historial de ${userId}: ${(err as Error).message}`)
    );
    logger.info(`WhatsApp: ${msgs.length} mensajes históricos recibidos para ${userId}`);
  });

  socket.ev.on('messages.upsert', ({ messages: msgs, type }) => {
    if (type === 'notify' || type === 'append') {
      persistMessages(userId, msgs).catch((err) =>
        logger.error(`WhatsApp: error guardando mensajes de ${userId}: ${(err as Error).message}`)
      );
    }
  });

  socket.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        sessionData.qr = await QRCode.toDataURL(qr);
      } catch {}
    }

    if (connection === 'open') {
      sessionData.status = 'CONNECTED';
      sessionData.qr = null;
      sessionData.reconnectAttempts = 0;
      try {
        await prisma.whatsAppSession.update({ where: { userId }, data: { connected: true } });
      } catch {}
    }

    if (connection === 'close') {
      sessionData.status = 'DISCONNECTED';

      if (sessionData.intentionalDisconnect) {
        activeSessions.delete(userId);
        return;
      }

      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      if (loggedOut) {
        activeSessions.delete(userId);
        try {
          await prisma.whatsAppSession.update({ where: { userId }, data: { connected: false } });
        } catch {}
      } else if (sessionData.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        sessionData.reconnectAttempts += 1;
        logger.info(
          `WhatsApp: reconectando ${userId} (intento ${sessionData.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}, código ${statusCode ?? 'desconocido'})`
        );
        setTimeout(() => {
          startWhatsAppSession(userId).catch(() => {});
        }, RECONNECT_DELAY_MS);
      } else {
        logger.warn(`WhatsApp: máximo de reconexiones alcanzado para ${userId}`);
        activeSessions.delete(userId);
        try {
          await prisma.whatsAppSession.update({ where: { userId }, data: { connected: false } });
        } catch {}
      }
    }
  });
}

export function getSessionStatus(userId: string): { status: SessionStatus; qr: string | null } {
  const session = activeSessions.get(userId);
  return {
    status: session?.status ?? 'DISCONNECTED',
    qr: session?.qr ?? null,
  };
}

export async function getDbSessionStatus(userId: string): Promise<{ connected: boolean; hasSession: boolean }> {
  const session = await prisma.whatsAppSession.findUnique({
    where: { userId },
    select: { connected: true },
  });
  return { connected: session?.connected ?? false, hasSession: !!session };
}

export async function reconnectActiveSessions(): Promise<void> {
  const sessions = await prisma.whatsAppSession.findMany({
    where: { connected: true },
    select: { userId: true },
  });
  logger.info(`WhatsApp startup: reconectando ${sessions.length} sesión(es) activa(s)`);
  for (const { userId } of sessions) {
    try {
      await startWhatsAppSession(userId);
    } catch (err) {
      logger.error(`WhatsApp startup: error reconectando ${userId}: ${(err as Error).message}`);
    }
  }
}

export async function waitForConnected(userId: string, timeoutMs = 60_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const session = activeSessions.get(userId);
    if (session?.status === 'CONNECTED') return true;
    await new Promise<void>((r) => setTimeout(r, 500));
  }
  return false;
}

export async function softDisconnectSession(userId: string): Promise<void> {
  const session = activeSessions.get(userId);
  if (session) {
    session.intentionalDisconnect = true;
    try { session.socket.end(undefined); } catch {}
    activeSessions.delete(userId);
  }
  try {
    await prisma.whatsAppSession.update({ where: { userId }, data: { connected: false } });
  } catch {}
}

export async function disconnectAllSessions(): Promise<void> {
  const userIds = Array.from(activeSessions.keys());
  if (userIds.length === 0) return;
  logger.warn(`Runner: forzando cierre de ${userIds.length} sesión(es) residual(es)`);
  for (const userId of userIds) {
    await softDisconnectSession(userId);
  }
}

export async function sendWhatsAppMessage(userId: string, toPhone: string, text: string): Promise<void> {
  const session = activeSessions.get(userId);
  if (!session || session.status !== 'CONNECTED') {
    throw new Error(`No hay sesión activa de WhatsApp para ${userId}`);
  }
  const jid = `${toPhone.replace(/\D/g, '')}@s.whatsapp.net`;
  await session.socket.sendMessage(jid, { text });
}

export async function disconnectWhatsApp(userId: string): Promise<void> {
  const session = activeSessions.get(userId);
  if (session) {
    try { session.socket.end(undefined); } catch {}
    activeSessions.delete(userId);
  }
  try {
    await (prisma as any).whatsAppMessage.deleteMany({ where: { userId } });
  } catch {}
  try {
    await prisma.whatsAppSession.delete({ where: { userId } });
  } catch {}
}
