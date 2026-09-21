import fs from 'fs';
import path from 'path';
import { logger } from '../config/logger';
import { decryptIfDefined } from '../config/encryption';
import { createCalendarEvent } from '../infrastructure/googleCalendar';
import { uploadToDrive } from '../infrastructure/googleDrive';
import { sendEmailWithAttachments } from '../infrastructure/email';
import { sendWhatsAppMessage } from './whatsappService';
import type { NotificationAnalysis } from '../infrastructure/claude';
import prisma from '../shared/prisma';
import { sumarDiasHabiles, sumarDiasCorridos } from '../shared/feriados';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DriveFile {
  nombre: string;
  driveId: string;
  driveUrl: string;
  tipo: 'pdf' | 'imagen';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

  const responses = JSON.parse(fs.readFileSync(responsesPath, 'utf-8')) as Record<string, NotificationAnalysis>;
  const entries = Object.entries(responses);
  if (entries.length === 0) return;

  const abogado = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, googleRefreshToken: true, nombre: true, apellido: true },
  });
  if (!abogado) return;

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

      const html = `<div style="font-family:Arial,sans-serif;max-width:600px">
        <h2>${asunto}</h2>
        <p style="white-space:pre-line">${resp.resumenAbogado}</p>
        ${driveHtml}
      </div>`;

        for (const ab of abogadosDestino) {
        try {
          await sendEmailWithAttachments(ab.email, asunto, html, adjuntos);
          logger.info(`Processor: email enviado a ${ab.email}`);
        } catch (err) {
          logger.warn(`Processor: email falló para ${ab.email} — ${(err as Error).message}`);
        }
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
          const mensajePersonalizado = resp.resumenCliente.replace(
            '{{NOMBRE_CLIENTE}}',
            cc.cliente.user.nombre
          );
          try {
            await sendWhatsAppMessage(userId, phone, mensajePersonalizado);
            logger.info(`Processor: WhatsApp enviado a ${cc.cliente.user.nombre} ${cc.cliente.user.apellido}`);
            await new Promise((r) => setTimeout(r, 5000)); // margen para que WhatsApp confirme la entrega antes de cerrar la sesión
          } catch (err) {
            logger.warn(
              `Processor: WhatsApp falló para ${cc.cliente.user.nombre} — ${(err as Error).message}`
            );
          }
        }
      }

      // ── 5. Guardar CasoNovedad ──────────────────────────────────────────────
      if (caso) {
        const casoConfirmado = caso;
        /* Solo se agenda en Calendar si la IA marcó esto como un evento real
         (no un simple plazo de referencia) Y trae fecha Y hora — sin hora no
         se inventa un horario, queda como novedad sin agendar. */

        const fechaAgendada =
          resp.esEvento && resp.fecha && resp.hora
            ? new Date(`${resp.fecha}T${resp.hora}:00`)
            : null;

        // Fecha base para calcular el plazo: la que extrajo la IA del propio
        // documento, o la de procesamiento si no encontró ninguna — con aviso
        // visible en ese caso, para que quede claro que es un fallback.
        let fechaBaseWarning = '';
        let fechaBase: Date;
        if (resp.fecha) {
          fechaBase = new Date(`${resp.fecha}T12:00:00.000Z`); // mediodía UTC = mediodía Bolivia, evita saltos de día
        } else {
          fechaBase = new Date();
          fechaBaseWarning =
            `⚠️ No se identificó una fecha de envío explícita en el documento — se usó la fecha de ` +
            `procesamiento (${fechaBase.toLocaleDateString('es-BO', { timeZone: 'America/La_Paz' })}) ` +
            `como base para calcular el plazo.\n\n`;
        }

        const contenido =
          fechaBaseWarning +
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

        const token = abogadosDestino.find((a) => a.googleRefreshToken)?.googleRefreshToken;

        async function agendarEnCalendar(novedadId: string, tituloEvento: string, contenidoEvento: string, fecha: Date) {
          if (!token) return;
          try {
            const eventId = await createCalendarEvent(token, {
              titulo: tituloEvento,
              contenido: contenidoEvento,
              fechaAgendada: fecha,
              casoTitulo: casoConfirmado.titulo,
            });
            if (eventId) {
              await prisma.casoNovedad.update({ where: { id: novedadId }, data: { googleCalendarEventId: eventId } });
              logger.info(`Processor: evento Calendar creado — ${eventId}`);
            }
          } catch (err) {
            logger.warn(`Processor: Calendar falló — ${(err as Error).message}`);
          }
        }

        // ── 6. Recordatorio de plazo (si corresponde) ─────────────────────────
        // No aplica si ya es un evento en sí, ni si es una sentencia (termina
        // el proceso — se maneja distinto, no se toca en este alcance).
        if (!resp.esEvento && resp.tipoDocumento !== 'sentencia') {
          const plazoDias = resp.plazoDias ?? 3;
          const plazoUnidad = resp.plazoUnidad ?? 'habiles';
          const fechaLimite =
            plazoUnidad === 'corridos'
              ? sumarDiasCorridos(fechaBase, plazoDias)
              : await sumarDiasHabiles(fechaBase, plazoDias);
          // 8:00 am en Bolivia = 12:00 UTC (Bolivia es UTC-4 fijo, sin horario de verano)
          const fechaLimiteConHora = new Date(
            Date.UTC(fechaLimite.getUTCFullYear(), fechaLimite.getUTCMonth(), fechaLimite.getUTCDate(), 12, 0, 0)
          );
          const identificadorCaso = resp.nurej ? `NUREJ ${resp.nurej}` : caso.titulo;
          const tituloRecordatorio = `Último día para responder — ${identificadorCaso}`;

          const recordatorio = await (prisma.casoNovedad as any).create({
            data: {
              casoId: caso.id,
              autorId: userId,
              titulo: tituloRecordatorio,
              contenido:
                `Plazo de ${plazoDias} día(s) ${plazoUnidad === 'corridos' ? 'corridos' : 'hábiles'} ` +
                `a partir de la notificación del proceso "${caso.titulo}"` +
                (resp.plazoDias == null ? ' (plazo por defecto — el documento no especificó uno explícito).' : '.'),
              fecha: fechaLimiteConHora,
              fechaAgendada: fechaLimiteConHora,
              esNotificacion: false,
            },
          });
          await agendarEnCalendar(recordatorio.id, tituloRecordatorio, recordatorio.contenido, fechaLimiteConHora);
        }

        // ── 7. Google Calendar si hay fecha (evento real) ─────────────────────
        if (fechaAgendada) {
          {
            try {
              await agendarEnCalendar(novedad.id, novedad.titulo, resp.resumenGeneral, fechaAgendada);
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
