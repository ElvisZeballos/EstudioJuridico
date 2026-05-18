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
import { analyzeNotificationsWithGroq } from './groqService';
import { processGroqResults } from './notificationProcessor';
import { logger } from '../config/logger';

const prisma = new PrismaClient();

const LOOK_BACK_MS = 24 * 60 * 60 * 1000;
const MESSAGE_SETTLE_MS = 15_000; // wait after connect for WhatsApp to push delta

const NOTIFICATION_KEYWORDS = ['juzgado', 'jusgado', 'notificaci', 'tribunal'];

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

// ─── Notification filter ─────────────────────────────────────────────────────

function hasKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return NOTIFICATION_KEYWORDS.some((k) => lower.includes(k));
}

async function filterNotifications(userDir: string): Promise<void> {
  const jsonPath = path.join(userDir, 'messages.json');
  const mediaDir = path.join(userDir, 'media');

  if (!fs.existsSync(jsonPath)) return;

  const output: RunOutput = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  const matching: Record<string, Conversation> = {};

  for (const [jid, conv] of Object.entries(output.conversaciones)) {
    if (conv.esGrupo) continue;

    const hasMedia = conv.mensajes.some(
      (m) => m.tipo === 'imagen' || m.tipo === 'documento_pdf'
    );
    const hasNotifKeyword = conv.mensajes.some(
      (m) => m.tipo === 'texto' && hasKeyword(m.cuerpo)
    );
    const allFromMe = conv.mensajes.every((m) => m.deMi);
    if (hasMedia && hasNotifKeyword && !allFromMe) {
      matching[jid] = conv;
    }
  }

  // Collect media files referenced by matching conversations
  const referencedFiles = new Set<string>();
  for (const conv of Object.values(matching)) {
    for (const msg of conv.mensajes) {
      if (msg.tipo === 'imagen' || msg.tipo === 'documento_pdf') {
        referencedFiles.add(path.basename(msg.archivo));
      }
    }
  }

  // Delete all media files not referenced in matching conversations
  if (fs.existsSync(mediaDir)) {
    for (const file of fs.readdirSync(mediaDir)) {
      if (!referencedFiles.has(file)) {
        fs.unlinkSync(path.join(mediaDir, file));
      }
    }
  }

  // Write notificaciones.json if there are matches
  if (Object.keys(matching).length > 0) {
    const totalMensajes = Object.values(matching).reduce(
      (acc, c) => acc + c.mensajes.length, 0
    );
    const notifOutput: RunOutput = {
      ...output,
      generadoEn: new Date().toISOString(),
      totalMensajes,
      totalConversaciones: Object.keys(matching).length,
      conversaciones: matching,
    };
    fs.writeFileSync(
      path.join(userDir, 'notificaciones.json'),
      JSON.stringify(notifOutput, null, 2),
      'utf-8'
    );
    logger.info(
      `Runner: ${Object.keys(matching).length} notificación(es) detectadas para ${output.abogado.nombre} ${output.abogado.apellido}`
    );
  } else {
    logger.info(
      `Runner: sin notificaciones para ${output.abogado.nombre} ${output.abogado.apellido}`
    );
  }

  // Delete original messages.json
  fs.unlinkSync(jsonPath);
}

// ─── Per-user extraction ──────────────────────────────────────────────────────

async function extractForUser(
  userId: string,
  nombre: string,
  apellido: string,
  runDir: string,
  userIndex: number
): Promise<string> {
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

  return userDir;
}

// ─── Single-user manual extraction ───────────────────────────────────────────

export async function runExtractionForUser(userId: string): Promise<void> {
  const session = await prisma.whatsAppSession.findUnique({
    where: { userId },
    include: {
      user: { select: { nombre: true, apellido: true, active: true } },
    },
  });

  if (!session) throw new Error(`Sin sesión de WhatsApp registrada para ${userId}`);
  if (!session.user.active) throw new Error(`Usuario ${userId} inactivo`);

  const { nombre, apellido } = session.user;
  const dateStr = new Date().toISOString().split('T')[0];
  const runDir = path.join(process.cwd(), 'temp', `whatsapp_${dateStr}`);
  fs.mkdirSync(runDir, { recursive: true });

  logger.info(`Runner manual: iniciando extracción para ${nombre} ${apellido}`);

  try {
    const { count: deleted } = await prisma.whatsAppMessage.deleteMany({ where: { userId } });
    if (deleted > 0) {
      logger.info(`Runner manual: ${deleted} mensajes previos eliminados para ${nombre} ${apellido}`);
    }

    await startWhatsAppSession(userId);

    const connected = await waitForConnected(userId, 60_000);
    if (!connected) throw new Error(`Timeout conectando WhatsApp para ${nombre} ${apellido}`);

    logger.info(`Runner manual: esperando mensajes de ${nombre} (${MESSAGE_SETTLE_MS / 1000}s)...`);
    await new Promise<void>((r) => setTimeout(r, MESSAGE_SETTLE_MS));

    const userDir = await extractForUser(userId, nombre, apellido, runDir, 0);

    await filterNotifications(userDir);
    await analyzeNotificationsWithGroq(userDir);
    await processGroqResults(userDir, userId);

    await softDisconnectSession(userId);
    logger.info(`Runner manual: sesión de ${nombre} ${apellido} cerrada`);
    logger.info(`Runner manual: extracción finalizada para ${nombre} ${apellido} — ${runDir}`);

  } catch (err) {
    logger.error(`Runner manual: error con ${nombre} ${apellido}: ${(err as Error).message}`);
    await softDisconnectSession(userId);
    throw err;
  }
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
      // 1. Limpiar mensajes previos antes de conectar
      const { count: deleted } = await prisma.whatsAppMessage.deleteMany({ where: { userId: user.id } });
      if (deleted > 0) {
        logger.info(`Runner: ${deleted} mensajes previos eliminados para ${user.nombre} ${user.apellido}`);
      }

      // 2. Conectar
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

      // 3. Extraer y generar JSON
      const userDir = await extractForUser(user.id, user.nombre, user.apellido, runDir, i + 1);

      // 4. Filtrar, analizar y procesar (sesión aún abierta para enviar WhatsApp)
      await filterNotifications(userDir);
      await analyzeNotificationsWithGroq(userDir);
      await processGroqResults(userDir, user.id);

      // 5. Cerrar sesión
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
