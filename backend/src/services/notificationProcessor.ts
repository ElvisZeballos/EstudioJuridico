import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { logger } from '../config/logger';
import { decryptIfDefined } from '../config/encryption';
import { createCalendarEvent } from './googleCalendar';
import { uploadToDrive } from './googleDrive';
import { sendWhatsAppMessage } from './whatsappService';
import type { GroqAnalysis } from './groqService';

const prisma = new PrismaClient();

// ─── Types ────────────────────────────────────────────────────────────────────

interface DriveFile {
  nombre: string;
  driveId: string;
  driveUrl: string;
  tipo: 'pdf' | 'imagen';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

function mimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.png') return 'image/png';
  return 'image/jpeg';
}

async function uploadMediaFiles(
  mediaFiles: string[],
  userDir: string,
  refreshToken: string
): Promise<DriveFile[]> {
  const results: DriveFile[] = [];
  for (const rel of mediaFiles) {
    const abs = path.join(userDir, rel);
    if (!fs.existsSync(abs)) {
      logger.warn(`Drive: archivo no encontrado en disco — ${abs}`);
      continue;
    }
    try {
      const { driveId, driveUrl } = await uploadToDrive(refreshToken, abs, mimeType(abs), path.basename(abs));
      results.push({
        nombre: path.basename(abs),
        driveId,
        driveUrl,
        tipo: path.extname(abs).toLowerCase() === '.pdf' ? 'pdf' : 'imagen',
      });
      logger.info(`Drive: subido ${path.basename(abs)}`);
    } catch (err) {
      logger.warn(`Drive: no se pudo subir ${path.basename(abs)} — ${(err as Error).message}`);
    }
  }
  return results;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function processGroqResults(userDir: string, userId: string): Promise<void> {
  const responsesPath = path.join(userDir, 'groq_respuestas.json');
  if (!fs.existsSync(responsesPath)) {
    logger.info(`Processor: sin groq_respuestas.json en ${userDir}`);
    return;
  }

  const responses = JSON.parse(fs.readFileSync(responsesPath, 'utf-8')) as Record<string, GroqAnalysis>;
  const entries = Object.entries(responses);
  if (entries.length === 0) return;

  const abogado = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, googleRefreshToken: true, nombre: true, apellido: true },
  });
  if (!abogado) return;

  const transporter = makeTransporter();

  for (const [key, resp] of entries) {
    logger.info(`Processor: procesando ${key} — nurej: ${resp.nurej ?? 'sin NUREJ'}`);

    try {
      // ── 1. Buscar caso por NUREJ ────────────────────────────────────────────
      const caso = resp.nurej
        ? await prisma.caso.findFirst({
            where: { numero: { contains: resp.nurej, mode: 'insensitive' }, active: true },
            include: {
              abogados: {
                include: {
                  abogado: {
                    select: { id: true, email: true, googleRefreshToken: true, nombre: true },
                  },
                },
              },
              clientes: {
                include: {
                  cliente: {
                    include: {
                      user: { select: { nombre: true, apellido: true, telefono: true } },
                    },
                  },
                },
              },
            },
          })
        : null;

      if (resp.nurej && !caso) {
        logger.warn(`Processor: no se encontró caso con NUREJ "${resp.nurej}"`);
      }

      // ── 2. Subir archivos a Google Drive ────────────────────────────────────
      let driveFiles: DriveFile[] = [];
      if (abogado.googleRefreshToken && resp.media && resp.media.length > 0) {
        driveFiles = await uploadMediaFiles(resp.media, userDir, abogado.googleRefreshToken);
      }

      // ── 3. Email al abogado ─────────────────────────────────────────────────
      const asunto = `Notificación${resp.juzgado ? ` - ${resp.juzgado}` : ''}`;

      const abogadosDestino = caso?.abogados.map((ca) => ca.abogado) ?? [
        { id: userId, email: abogado.email, googleRefreshToken: abogado.googleRefreshToken, nombre: abogado.nombre },
      ];

      const adjuntos = (resp.media ?? [])
        .map((rel) => {
          const abs = path.join(userDir, rel);
          if (!fs.existsSync(abs)) {
            logger.warn(`Processor: adjunto no encontrado — ${abs}`);
            return null;
          }
          return { filename: path.basename(rel), path: abs };
        })
        .filter((a): a is { filename: string; path: string } => a !== null);

      const driveHtml =
        driveFiles.length > 0
          ? `<h3 style="margin-top:16px">Archivos en Drive</h3><ul>${driveFiles
              .map((f) => `<li><a href="${f.driveUrl}">${f.nombre}</a></li>`)
              .join('')}</ul>`
          : '';

      for (const ab of abogadosDestino) {
        await transporter.sendMail({
          from: process.env.SMTP_FROM,
          to: ab.email,
          subject: asunto,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px">
            <h2>${asunto}</h2>
            <p style="white-space:pre-line">${resp.resumenAbogado}</p>
            ${driveHtml}
          </div>`,
          attachments: adjuntos,
        });
        logger.info(`Processor: email enviado a ${ab.email}`);
      }

      // ── 4. WhatsApp al cliente ──────────────────────────────────────────────
      if (caso) {
        for (const cc of caso.clientes) {
          const raw = decryptIfDefined(cc.cliente.user.telefono ?? null)?.replace(/\D/g, '') ?? '';
          if (!raw) continue;
          // Normalizar a formato Bolivia: 591XXXXXXXX
          const phone = raw.startsWith('591') ? raw : `591${raw}`;
          if (phone.length < 11) {
            logger.warn(`Processor: teléfono inválido para ${cc.cliente.user.nombre} — "${raw}"`);
            continue;
          }
          try {
            await sendWhatsAppMessage(userId, phone, resp.resumenCliente);
            logger.info(`Processor: WhatsApp enviado a ${cc.cliente.user.nombre} ${cc.cliente.user.apellido}`);
          } catch (err) {
            logger.warn(
              `Processor: WhatsApp falló para ${cc.cliente.user.nombre} — ${(err as Error).message}`
            );
          }
        }
      }

      // ── 5. Guardar CasoNovedad ──────────────────────────────────────────────
      if (caso) {
        const fechaAgendada = resp.fecha ? new Date(resp.fecha) : null;
        const contenido =
          resp.resumenGeneral +
          (driveFiles.length > 0
            ? '\n\nArchivos:\n' + driveFiles.map((f) => `- ${f.nombre}: ${f.driveUrl}`).join('\n')
            : '');

        const novedad = await (prisma.casoNovedad as any).create({
          data: {
            casoId: caso.id,
            autorId: userId,
            titulo: asunto + (resp.tipoDocumento ? ` (${resp.tipoDocumento})` : ''),
            contenido,
            fecha: new Date(),
            fechaAgendada,
            esNotificacion: true,
            archivos: driveFiles.length > 0 ? JSON.stringify(driveFiles) : null,
          },
        });

        // ── 6. Google Calendar si hay fecha ──────────────────────────────────
        if (fechaAgendada) {
          const token = abogadosDestino.find((a) => a.googleRefreshToken)?.googleRefreshToken;
          if (token) {
            try {
              const eventId = await createCalendarEvent(token, {
                titulo: novedad.titulo,
                contenido: resp.resumenGeneral,
                fechaAgendada,
                casoTitulo: caso.titulo,
              });
              if (eventId) {
                await prisma.casoNovedad.update({
                  where: { id: novedad.id },
                  data: { googleCalendarEventId: eventId },
                });
                logger.info(`Processor: evento Calendar creado — ${eventId}`);
              }
            } catch (err) {
              logger.warn(`Processor: Calendar falló — ${(err as Error).message}`);
            }
          }
        }
      }
    } catch (err) {
      logger.error(`Processor: error en ${key} — ${(err as Error).message}`);
    }
  }

  logger.info(`Processor: ${entries.length} respuesta(s) procesadas — ${userDir}`);
}
