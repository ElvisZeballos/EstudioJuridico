import Anthropic from '@anthropic-ai/sdk';
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

Usá la herramienta "extraer_notificacion" para devolver los datos extraídos.`;

const TOOL_DEFINITION: Anthropic.Tool = {
  name: 'extraer_notificacion',
  description: 'Extrae los datos estructurados de una notificación judicial boliviana a partir de los documentos y mensajes de WhatsApp analizados.',
  input_schema: {
    type: 'object',
    properties: {
      nurej: { type: ['string', 'null'], description: 'NUREJ o número de expediente si aparece en el documento' },
      esEvento: {
        type: 'boolean',
        description: 'true SOLO si el documento fija una fecha y hora concreta a la que el abogado debe asistir o cumplir en persona (audiencia, inspección, reunión de conciliación, diligencia, etc.). false si solo hay un plazo para responder por escrito, o no hay fecha relevante.',
      },
      tipoEvento: { type: ['string', 'null'], description: 'Si esEvento es true: descripción libre y breve del tipo de evento según el documento (ej. "Audiencia de conciliación", "Inspección ocular"). Si es false: null.' },
      fecha: { type: ['string', 'null'], description: 'Si esEvento es true: fecha del evento (YYYY-MM-DD). Si esEvento es false pero hay un plazo: fecha de notificación/publicación desde la cual se cuenta. Si no hay fecha relevante: null.' },
      hora: { type: ['string', 'null'], description: 'Si esEvento es true y el documento menciona hora: formato HH:MM (24hs). Si no: null.' },
      plazoDias: { type: ['number', 'null'], description: 'Número de días para responder o actuar, SOLO si el documento lo menciona explícitamente (ej. "diez días hábiles" → 10). Nunca inventes ni infieras un número que el documento no dice literalmente.' },
      plazoUnidad: { type: ['string', 'null'], enum: ['habiles', 'corridos', null], description: "'habiles' o 'corridos' según lo que diga el documento junto al plazo. Si no hay plazoDias, null." },
      resumenAbogado: { type: 'string', description: 'Resumen técnico-legal: tipo de acto procesal, juzgado, partes involucradas, plazos legales y acciones que debe tomar el abogado.' },
      resumenCliente: {
        type: 'string',
        description:
          'Mensaje para el cliente, en 3 partes: (1) empieza EXACTAMENTE con "Buenas tardes {{NOMBRE_CLIENTE}}," (el nombre se reemplaza después por el real, nunca uses un nombre visto en la conversación); (2) resumen breve y NEUTRAL en tercera persona de qué trata el documento, narrando los hechos tal como aparecen, sin asumir de qué lado está el cliente; (3) SIEMPRE cierra pidiendo que se comunique con su abogado a la brevedad posible.',
      },
      resumenGeneral: { type: 'string', description: 'Resumen general del documento en 2 o 3 oraciones.' },
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

      for (const msg of conv.mensajes) {
        if (archivoCount >= MAX_ARCHIVOS_POR_REQUEST) break;

        if (msg.tipo === 'imagen' && msg.archivo) {
          const filePath = path.join(userDir, msg.archivo);
          if (fs.existsSync(filePath)) {
            const base64 = fs.readFileSync(filePath).toString('base64');
            contentBlocks.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } });
            if (msg.caption) {
              contentBlocks.push({ type: 'text', text: `Descripción de la imagen: ${msg.caption}` });
            }
            archivoCount++;
          }
        }

        if (msg.tipo === 'documento_pdf' && msg.archivo) {
          const filePath = path.join(userDir, msg.archivo);
          if (fs.existsSync(filePath)) {
            const base64 = fs.readFileSync(filePath).toString('base64');
            contentBlocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } });
            archivoCount++;
          }
        }
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