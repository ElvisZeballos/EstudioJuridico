import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { logger } from '../config/logger';

interface ExtractedMessage {
  timestamp: string;
  deMi: boolean;
  tipo: 'texto' | 'imagen' | 'documento_pdf';
  cuerpo?: string;
  archivo?: string;
  caption?: string;
}

interface Conversation {
  jid: string;
  nombre: string;
  esGrupo: boolean;
  mensajes: ExtractedMessage[];
}

interface NotifOutput {
  abogado: { id: string; nombre: string; apellido: string };
  conversaciones: Record<string, Conversation>;
}

const MAX_ARCHIVOS_POR_REQUEST = 10;
// Límites reales de la API de Claude (Anthropic): 5 MB por imagen individual,
// 32 MB el request completo. Se deja margen de seguridad bajo esos topes,
// contando en bytes "crudos" (antes de base64, que infla ~33% el tamaño real
// que viaja por la red).
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_REQUEST_BYTES = 20 * 1024 * 1024;

export interface NotificationAnalysis {
  nurej: string | null;
  fecha: string | null;
  esEvento: boolean;
  tipoEvento: string | null;
  hora: string | null;
  plazoDias: number | null;
  plazoUnidad: 'habiles' | 'corridos' | null;
  resumenAbogado: string;
  resumenCliente: string;
  resumenGeneral: string;
  juzgado: string | null;
  tipoDocumento: string | null;
  error?: boolean;
  media?: string[];
}

const SYSTEM_PROMPT = `Eres un asistente legal especializado en Bolivia. Analiza los mensajes y documentos adjuntos de una conversación de WhatsApp que contiene una notificación judicial.

IMPORTANTE: no sabés qué rol cumple el cliente del estudio jurídico en este proceso (podría ser demandante, demandado, o un tercero). Nunca asumas ni des a entender de qué lado está — describí los hechos del documento de forma neutral y objetiva en todos los campos.

IMPORTANTE SOBRE DOCUMENTOS MÚLTIPLES: es muy común que la notificación venga acompañada de una copia de un documento anterior al que responde (por ejemplo, un memorial presentado por una de las partes, seguido de la respuesta/auto del juzgado a ese memorial). Estos vienen con fechas distintas, y no necesariamente en orden — no asumas que la primera página cronológicamente es la más antigua. Para identificar cuál es la notificación real (la que manda para calcular fechas y plazos): es la que tiene la fecha MÁS RECIENTE entre todos los documentos fechados presentes. Cualquier documento de fecha anterior dentro del mismo envío es un antecedente o adjunto, no la notificación en sí — mencionalo en el resumen como contexto, pero la "fecha" que reportes debe ser la del documento más reciente.

Usá la herramienta "extraer_notificacion" para devolver los datos extraídos.`;

const TOOL_DEFINITION: Anthropic.Tool = {
  name: 'extraer_notificacion',
  description: 'Extrae los datos estructurados de una notificación judicial boliviana a partir de los documentos y mensajes de WhatsApp analizados.',
  input_schema: {
    type: 'object',
    properties: {
      nurej: { type: ['string', 'null'], description: 'NUREJ o número de expediente si aparece en el documento' },
        "esEvento": {
        type: 'boolean',
        description: 'true SOLO si el documento fija una fecha y hora concreta a la que el abogado debe atender, sea presencial O VIRTUAL (una audiencia, una inspección, una reunión de conciliación, una videollamada, una reunión con un conciliador o mediador, o cualquier otro acto procesal con fecha y hora fija). No asumas que tiene que ser presencial — si el documento dice que es virtual, igual es esEvento: true. false si solo hay un plazo para responder por escrito, o no hay fecha relevante.',
      },
      tipoEvento: { type: ['string', 'null'], description: 'Si esEvento es true: descripción libre y breve del tipo de evento según el documento (ej. "Audiencia de conciliación", "Inspección ocular"). Si es false: null.' },
      fecha: { type: ['string', 'null'], description: 'Si esEvento es true: fecha del evento (YYYY-MM-DD). Si esEvento es false pero hay un plazo: fecha de notificación/publicación desde la cual se cuenta. Si no hay fecha relevante: null.' },
      hora: { type: ['string', 'null'], description: 'Si esEvento es true y el documento menciona hora: formato HH:MM (24hs). Si no: null.' },
      plazoDias: { type: ['number', 'null'], description: 'Número de días para responder o actuar, SOLO si el documento lo menciona explícitamente (ej. "diez días hábiles" → 10). Nunca inventes ni infieras un número que el documento no dice literalmente.' },
      plazoUnidad: { type: ['string', 'null'], enum: ['habiles', 'corridos', null], description: "'habiles' o 'corridos' según lo que diga el documento junto al plazo. Si no hay plazoDias, null." },
      resumenAbogado: { type: 'string', description: 'Resumen técnico-legal: tipo de acto procesal, juzgado, partes involucradas, plazos legales y acciones que debe tomar el abogado. Si el envío incluye un documento anterior (ej. un memorial u otro escrito de alguna de las partes) junto con la respuesta/auto del juzgado a ese documento, estructurá el resumen en dos partes breves: primero qué se solicitó o argumentó en el documento anterior, después qué resolvió o dispuso el juzgado en respuesta — así se entiende el contexto completo sin abrir el archivo original. Si el documento es un acto virtual e incluye un enlace de acceso (Zoom, Meet, Teams, etc.), mencioná que trae un enlace de acceso — pero NO copies ni reproduzcas el enlace en sí, el abogado debe revisarlo directo en el documento original.' },
      resumenCliente: {
        type: 'string',
        description:
          'Mensaje para el cliente, en 3 partes: (1) empieza EXACTAMENTE con "Buenas tardes {{NOMBRE_CLIENTE}}," (el nombre se reemplaza después por el real, nunca uses un nombre visto en la conversación); (2) resumen breve y NEUTRAL en tercera persona de qué trata el documento, narrando los hechos tal como aparecen, sin asumir de qué lado está el cliente — si hay un documento anterior (memorial) junto con la respuesta del juzgado, contextualizá brevemente ambas partes en una sola frase corrida (ej. "en respuesta a un memorial donde se solicitaba X, el juzgado resolvió Y"), sin extenderte de más; (3) SIEMPRE cierra pidiendo que se comunique con su abogado a la brevedad posible.',
      },
      resumenGeneral: { type: 'string', description: 'Resumen general del documento en 2 o 3 oraciones. Si hay un documento anterior (memorial u otro escrito) junto con la respuesta del juzgado, una oración puede cubrir brevemente qué se pidió y otra qué se resolvió — sin perder la brevedad de 2-3 oraciones en total.' },
      juzgado: { type: ['string', 'null'], description: 'Nombre completo del juzgado tal como aparece en el documento.' },
      tipoDocumento: {
        type: 'string',
        enum: ['memorial', 'audiencia', 'resolución', 'auto', 'cédula de notificación', 'edicto', 'sentencia', 'otro'],
      },
    },
    required: [
      'nurej', 'esEvento', 'tipoEvento', 'fecha', 'hora', 'plazoDias', 'plazoUnidad',
      'resumenAbogado', 'resumenCliente', 'resumenGeneral', 'juzgado', 'tipoDocumento',
    ],
  },
};

function getTomorrowDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

function buildFallbackResponse(contactName: string): NotificationAnalysis {
  return {
    nurej: null,
    fecha: getTomorrowDate(),
    esEvento: false,
    tipoEvento: null,
    hora: null,
    plazoDias: null,
    plazoUnidad: null,
    resumenAbogado: 'No se pudo procesar el contenido del documento adjunto. Se recomienda revisar manualmente la imagen o PDF recibido.',
    resumenCliente:
      `Estimado/a ${contactName}, lamentablemente no pudimos leer el documento que recibió. ` +
      'Le recomendamos contactar a su abogado para revisar el contenido manualmente.',
    resumenGeneral: 'No fue posible procesar el documento o imagen recibida.',
    juzgado: null,
    tipoDocumento: null,
    error: true,
  };
}

/** Lee una imagen del disco; si supera el límite de 5MB de Claude, la
 *  recomprime en JPEG bajando la calidad hasta que entre, o hasta agotar los
 *  intentos. Devuelve null si no se pudo bajar del límite de ninguna forma. */
async function prepararImagen(filePath: string): Promise<Buffer | null> {
  let buffer = fs.readFileSync(filePath);
  if (buffer.length <= MAX_IMAGE_BYTES) return buffer;

  for (const calidad of [70, 50, 30]) {
    try {
      buffer = Buffer.from(await sharp(filePath).jpeg({ quality: calidad }).toBuffer());
      if (buffer.length <= MAX_IMAGE_BYTES) return buffer;
    } catch {
      // si sharp falla en algún intento, sigue probando con la siguiente calidad
    }
  }
  return null;
}

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png'; data: string } }
  | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } };

export async function analyzeNotifications(userDir: string): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    logger.warn('Claude: ANTHROPIC_API_KEY no configurada — omitiendo análisis');
    return;
  }

  const notifPath = path.join(userDir, 'notificaciones.json');
  if (!fs.existsSync(notifPath)) return;

  const notif: NotifOutput = JSON.parse(fs.readFileSync(notifPath, 'utf-8'));
  const conversations = Object.values(notif.conversaciones);
  if (conversations.length === 0) return;

  const anthropic = new Anthropic({ apiKey });
  const responses: Record<string, NotificationAnalysis> = {};

  for (let i = 0; i < conversations.length; i++) {
    const conv = conversations[i];
    const key = `respuesta_${i + 1}`;

    if (i > 0) {
      await new Promise((r) => setTimeout(r, 2_000));
    }

    logger.info(`Claude: [${i + 1}/${conversations.length}] analizando conversación con ${conv.nombre}`);

    const mediaFiles = conv.mensajes
      .filter((m) => m.tipo === 'imagen' || m.tipo === 'documento_pdf')
      .map((m) => m.archivo)
      .filter((a): a is string => !!a);

    try {
      const contentBlocks: ContentBlock[] = [];

      const textLines = conv.mensajes
        .filter((m) => m.tipo === 'texto' && m.cuerpo)
        .map((m) => `[${m.timestamp}] ${m.deMi ? 'Abogado' : conv.nombre}: ${m.cuerpo}`)
        .join('\n');
      if (textLines) {
        contentBlocks.push({ type: 'text', text: `Mensajes de texto de la conversación:\n${textLines}` });
      }

      let archivoCount = 0;
      let bytesAcumulados = 0;
      let archivosOmitidos = 0;

      for (const msg of conv.mensajes) {
        if (archivoCount >= MAX_ARCHIVOS_POR_REQUEST) break;
        if (bytesAcumulados >= MAX_REQUEST_BYTES) {
          archivosOmitidos++;
          continue;
        }

        if (msg.tipo === 'imagen' && msg.archivo) {
          const filePath = path.join(userDir, msg.archivo);
          if (fs.existsSync(filePath)) {
            const buffer = await prepararImagen(filePath);
            if (!buffer || bytesAcumulados + buffer.length > MAX_REQUEST_BYTES) {
              archivosOmitidos++;
              continue;
            }
            contentBlocks.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: buffer.toString('base64') } });
            if (msg.caption) {
              contentBlocks.push({ type: 'text', text: `Descripción de la imagen: ${msg.caption}` });
            }
            bytesAcumulados += buffer.length;
            archivoCount++;
          }
        }

        if (msg.tipo === 'documento_pdf' && msg.archivo) {
          const filePath = path.join(userDir, msg.archivo);
          if (fs.existsSync(filePath)) {
            const buffer = fs.readFileSync(filePath);
            if (buffer.length > MAX_IMAGE_BYTES || bytesAcumulados + buffer.length > MAX_REQUEST_BYTES) {
              archivosOmitidos++;
              continue;
            }
            contentBlocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') } });
            bytesAcumulados += buffer.length;
            archivoCount++;
          }
        }
      }

      if (archivosOmitidos > 0) {
        logger.warn(`Claude: ${archivosOmitidos} archivo(s) omitido(s) por exceder el límite de tamaño de la API`);
        contentBlocks.push({
          type: 'text',
          text: `Nota: ${archivosOmitidos} archivo(s) de esta conversación no se pudieron incluir por exceder el límite de tamaño permitido.`,
        });
      }

      contentBlocks.push({ type: 'text', text: 'Analizá los documentos y mensajes de arriba y usá la herramienta "extraer_notificacion" con el resultado.' });

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        tools: [TOOL_DEFINITION],
        tool_choice: { type: 'tool', name: 'extraer_notificacion' },
        messages: [{ role: 'user', content: contentBlocks }],
      });

      const toolUse = response.content.find((b) => b.type === 'tool_use');
      if (!toolUse || toolUse.type !== 'tool_use') {
        throw new Error('Claude no devolvió el resultado con la herramienta esperada');
      }

      responses[key] = { ...(toolUse.input as NotificationAnalysis), media: mediaFiles };
      logger.info(`Claude: conversación ${i + 1} analizada correctamente`);
    } catch (err) {
      logger.error(`Claude: error en conversación ${i + 1} (${conv.nombre}): ${(err as Error).message}`);
      responses[key] = { ...buildFallbackResponse(conv.nombre), media: mediaFiles };
    }
  }

  fs.writeFileSync(path.join(userDir, 'groq_respuestas.json'), JSON.stringify(responses, null, 2), 'utf-8');
  logger.info(`Claude: análisis finalizado — ${conversations.length} conversación(es) — ${userDir}`);
}