import {
  downloadContentFromMessage,
  proto,
} from '@whiskeysockets/baileys';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import {
  getAccumulatedMessages,
  startWhatsAppSession,
  waitForConnected,
  softDisconnectSession,
  disconnectAllSessions,
} from './whatsappService';
import { logger } from '../config/logger';

const prisma = new PrismaClient();

const LOOK_BACK_MS = 24 * 60 * 60 * 1000;
const CLEANUP_MS   = 48 * 60 * 60 * 1000;
const MESSAGE_SETTLE_MS = 15_000; // wait after connect for WhatsApp to push delta

// ─── Types ──────────────────────────────────────────────────────────────────

interface TextMessage {
  timestamp: string;
  deMi: boolean;
  tipo: 'texto';
  cuerpo: string;
}

interface ImageMessage {
  timestamp: string;
  deMi: boolean;
  tipo: 'imagen';
  caption?: string;
  archivo: string;
  nombreArchivo: string;
}

interface PdfMessage {
  timestamp: string;
  deMi: boolean;
  tipo: 'documento_pdf';
  nombreArchivo: string;
  archivo: string;
}

type ExtractedMessage = TextMessage | ImageMessage | PdfMessage;

interface Conversation {
  jid: string;
  nombre: string;
  esGrupo: boolean;
  mensajes: ExtractedMessage[];
}

interface RunOutput {
  abogado: { id: string; nombre: string; apellido: string };
  generadoEn: string;
  periodo: string;
  totalMensajes: number;
  totalConversaciones: number;
  carpeta: string;
  conversaciones: Record<string, Conversation>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚüÜñÑ\- ]/g, '_').trim().slice(0, 30);
}

function formatTime(ts: Date): string {
  return `${ts.getHours().toString().padStart(2, '0')}-${ts.getMinutes().toString().padStart(2, '0')}`;
}

function parseJid(jid: string): { number: string; isGroup: boolean } {
  const isGroup = jid.endsWith('@g.us');
  const number = jid.split('@')[0].replace(/[^0-9]/g, '');
  return { number, isGroup };
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Uint8Array);
  }
  return Buffer.concat(chunks);
}

// ─── Message processing ───────────────────────────────────────────────────────

async function processMessage(
  msg: proto.IWebMessageInfo,
  contactName: string,
  mediaDir: string,
  idx: number
): Promise<ExtractedMessage | null> {
  const content = msg.message;
  if (!content) return null;

  const ts = new Date(Number(msg.messageTimestamp) * 1000);
  const timeStr = formatTime(ts);
  const safeName = sanitize(contactName);
  const fromMe = msg.key?.fromMe ?? false;

  // ── Texto ──────────────────────────────────────────────────────────────
  const body = content.conversation ?? content.extendedTextMessage?.text;
  if (body) {
    return { timestamp: ts.toISOString(), deMi: fromMe, tipo: 'texto', cuerpo: body };
  }

  // ── Imagen ─────────────────────────────────────────────────────────────
  if (content.imageMessage) {
    const filename = `imagen_de_${safeName}_${timeStr}_${idx}.jpg`;
    const filePath = path.join(mediaDir, filename);
    try {
      const stream = await downloadContentFromMessage(content.imageMessage, 'image');
      const buffer = await streamToBuffer(stream as NodeJS.ReadableStream);
      fs.writeFileSync(filePath, buffer);
    } catch (err) {
      logger.warn(`Runner: no se pudo descargar imagen de ${safeName} [${idx}]: ${(err as Error).message}`);
      return null;
    }
    const result: ImageMessage = {
      timestamp: ts.toISOString(),
      deMi: fromMe,
      tipo: 'imagen',
      nombreArchivo: filename,
      archivo: `media/${filename}`,
    };
    const caption = content.imageMessage.caption;
    if (caption) result.caption = caption;
    return result;
  }

  // ── Documento PDF ──────────────────────────────────────────────────────
  if (content.documentMessage) {
    const mime = content.documentMessage.mimetype ?? '';
    if (!mime.includes('pdf')) return null;

    const originalName = content.documentMessage.fileName ?? 'documento.pdf';
    const baseName = sanitize(originalName.replace(/\.pdf$/i, ''));
    const filename = `${baseName}_${timeStr}_${idx}.pdf`;
    const filePath = path.join(mediaDir, filename);
    try {
      const stream = await downloadContentFromMessage(content.documentMessage, 'document');
      const buffer = await streamToBuffer(stream as NodeJS.ReadableStream);
      fs.writeFileSync(filePath, buffer);
    } catch (err) {
      logger.warn(`Runner: no se pudo descargar PDF de ${safeName} [${idx}]: ${(err as Error).message}`);
      return null;
    }
    return {
      timestamp: ts.toISOString(),
      deMi: fromMe,
      tipo: 'documento_pdf',
      nombreArchivo: originalName,
      archivo: `media/${filename}`,
    };
  }

  return null;
}

// ─── Per-user extraction ──────────────────────────────────────────────────────

async function extractForUser(
  userId: string,
  nombre: string,
  apellido: string,
  runDir: string,
  userIndex: number
): Promise<void> {
  const folderName = `${String(userIndex).padStart(2, '0')}_${sanitize(nombre)}_${sanitize(apellido)}`;
  const userDir = path.join(runDir, folderName);
  const mediaDir = path.join(userDir, 'media');
  fs.mkdirSync(mediaDir, { recursive: true });

  const collected = await getAccumulatedMessages(userId);
  logger.info(`Runner: ${nombre} ${apellido} — ${collected.length} mensajes en DB`);

  if (collected.length === 0) {
    logger.warn(`Runner: sin mensajes en DB para ${nombre} ${apellido}. ¿La sesión recibió historial?`);
  }

  // ── Filtrar últimas 24h ─────────────────────────────────────────────────
  const cutoff = Date.now() - LOOK_BACK_MS;
  const recent = collected.filter((m) => {
    const ts = Number(m.messageTimestamp) * 1000;
    return ts >= cutoff && m.message != null;
  });

  logger.info(`Runner: ${nombre} ${apellido} — ${recent.length} mensajes en las últimas 24h`);

  // ── Agrupar por conversación ───────────────────────────────────────────
  const conversations: Record<string, Conversation> = {};

  const contactNames: Record<string, string> = {};
  for (const msg of recent) {
    const chatJid = msg.key?.remoteJid ?? '';
    if (!chatJid) continue;
    const { isGroup } = parseJid(chatJid);
    if (!isGroup && !msg.key?.fromMe && msg.pushName) {
      contactNames[chatJid] = msg.pushName;
    }
  }

  let globalIdx = 0;
  for (const msg of recent.sort((a, b) => Number(a.messageTimestamp) - Number(b.messageTimestamp))) {
    const chatJid = msg.key?.remoteJid ?? '';
    if (!chatJid) continue;

    const { number, isGroup } = parseJid(chatJid);
    const contactName = contactNames[chatJid] ?? (isGroup ? `Grupo_${number}` : number);

    if (!conversations[chatJid]) {
      conversations[chatJid] = {
        jid: chatJid,
        nombre: contactName,
        esGrupo: isGroup,
        mensajes: [],
      };
    }

    const processed = await processMessage(msg, contactName, mediaDir, globalIdx);
    if (processed) {
      conversations[chatJid].mensajes.push(processed);
    }
    globalIdx++;
  }

  const totalMensajes = Object.values(conversations).reduce(
    (acc, c) => acc + c.mensajes.length, 0
  );

  const output: RunOutput = {
    abogado: { id: userId, nombre, apellido },
    generadoEn: new Date().toISOString(),
    periodo: 'ultimas_24_horas',
    totalMensajes,
    totalConversaciones: Object.keys(conversations).length,
    carpeta: userDir,
    conversaciones: conversations,
  };

  fs.writeFileSync(
    path.join(userDir, 'messages.json'),
    JSON.stringify(output, null, 2),
    'utf-8'
  );

  logger.info(
    `Runner: ${nombre} ${apellido} — guardado en ${userDir} ` +
    `(${totalMensajes} msgs, ${Object.keys(conversations).length} conversaciones)`
  );
}

// ─── Main runner ──────────────────────────────────────────────────────────────

export async function runWhatsAppExtraction(): Promise<void> {
  const dateStr = new Date().toISOString().split('T')[0];
  const runDir = path.join(process.cwd(), 'temp', `whatsapp_${dateStr}`);
  fs.mkdirSync(runDir, { recursive: true });

  logger.info(`Runner WhatsApp iniciado — carpeta: ${runDir}`);

  const sessions = await prisma.whatsAppSession.findMany({
    include: {
      user: {
        select: { id: true, nombre: true, apellido: true, role: true, active: true },
      },
    },
  });

  const abogados = sessions.filter(
    (s) => s.user.role === 'ABOGADO' && s.user.active
  );

  logger.info(`Runner: ${abogados.length} abogado(s) con sesión registrada`);

  for (let i = 0; i < abogados.length; i++) {
    const { user } = abogados[i];
    logger.info(`Runner: [${i + 1}/${abogados.length}] procesando ${user.nombre} ${user.apellido}`);

    try {
      // 1. Conectar
      await startWhatsAppSession(user.id);

      // 2. Esperar conexión (hasta 60 s)
      const connected = await waitForConnected(user.id, 60_000);
      if (!connected) {
        logger.warn(`Runner: timeout conectando ${user.nombre} ${user.apellido} — saltando`);
        await softDisconnectSession(user.id);
        continue;
      }

      // 3. Esperar a que WhatsApp envíe el delta de mensajes
      logger.info(`Runner: esperando mensajes de ${user.nombre} (${MESSAGE_SETTLE_MS / 1000}s)...`);
      await new Promise<void>((r) => setTimeout(r, MESSAGE_SETTLE_MS));

      // 4. Extraer y generar JSON
      await extractForUser(user.id, user.nombre, user.apellido, runDir, i + 1);

      // 5. Limpiar mensajes de más de 48h para este usuario
      const cutoff = new Date(Date.now() - CLEANUP_MS);
      const { count } = await prisma.whatsAppMessage.deleteMany({
        where: { userId: user.id, timestamp: { lt: cutoff } },
      });
      if (count > 0) {
        logger.info(`Runner: ${count} mensajes viejos eliminados para ${user.nombre} ${user.apellido}`);
      }

      // 6. Cerrar sesión
      await softDisconnectSession(user.id);
      logger.info(`Runner: sesión de ${user.nombre} ${user.apellido} cerrada`);

    } catch (err) {
      logger.error(`Runner: error con ${user.nombre} ${user.apellido}: ${(err as Error).message}`);
      await softDisconnectSession(user.id);
    }
  }

  // 7. Validar que no queden sesiones abiertas
  await disconnectAllSessions();
  logger.info(`Runner WhatsApp finalizado — resultados en: ${runDir}`);
}
