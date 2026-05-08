import Groq from 'groq-sdk';
import fs from 'fs';
import path from 'path';
import { logger } from '../config/logger';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;

// ─── Types ────────────────────────────────────────────────────────────────────

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

export interface GroqAnalysis {
  nurej: string | null;
  fecha: string | null;
  resumenAbogado: string;
  resumenCliente: string;
  resumenGeneral: string;
  juzgado: string | null;
  tipoDocumento: string | null;
  error?: boolean;
  media?: string[];
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

const PROMPT = `Eres un asistente legal especializado en Bolivia. Analiza los mensajes y documentos adjuntos de una conversación de WhatsApp que contiene una notificación judicial.

Devuelve ÚNICAMENTE un objeto JSON válido con exactamente esta estructura:

{
  "nurej": "NUREJ o número de expediente si aparece en el documento, o null",
  "fecha": "fecha de audiencia o plazo límite en formato YYYY-MM-DD, o null si no hay",
  "resumenAbogado": "resumen técnico-legal: tipo de acto procesal, juzgado, partes involucradas, plazos legales y acciones que debe tomar el abogado",
  "resumenCliente": "mensaje amigable para el cliente. SIEMPRE empieza con un saludo cordial usando su nombre si está disponible. Explica en términos simples qué recibió, qué significa y qué debe saber o hacer",
  "resumenGeneral": "resumen general del documento en 2 o 3 oraciones",
  "juzgado": "nombre completo del juzgado tal como aparece en el documento, o null",
  "tipoDocumento": "uno de: memorial, audiencia, resolución, auto, cédula de notificación, edicto, sentencia, otro"
}

No incluyas texto fuera del JSON. No uses markdown. Solo el objeto JSON.`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTomorrowDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

function buildFallbackResponse(contactName: string): GroqAnalysis {
  return {
    nurej: null,
    fecha: getTomorrowDate(),
    resumenAbogado:
      'No se pudo procesar el contenido del documento adjunto. Se recomienda revisar manualmente la imagen o PDF recibido.',
    resumenCliente:
      `Estimado/a ${contactName}, lamentablemente no pudimos leer el documento que recibió. ` +
      'Le recomendamos contactar a su abogado para revisar el contenido manualmente.',
    resumenGeneral: 'No fue posible procesar el documento o imagen recibida.',
    juzgado: null,
    tipoDocumento: null,
    error: true,
  };
}

async function extractPdfText(filePath: string): Promise<string | null> {
  try {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text.trim() || null;
  } catch {
    return null;
  }
}

async function convertPdfToImages(filePath: string): Promise<Buffer[]> {
  try {
    const { pdf } = await import('pdf-to-img');
    const doc = await pdf(filePath, { scale: 2 });
    const images: Buffer[] = [];
    for await (const page of doc) {
      images.push(Buffer.from(page));
    }
    return images;
  } catch (err) {
    logger.warn(`PDF→imágenes: ${path.basename(filePath)} — ${(err as Error).message}`);
    return [];
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function analyzeNotificationsWithGroq(userDir: string): Promise<void> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    logger.warn('Groq: GROQ_API_KEY no configurada — omitiendo análisis');
    return;
  }

  const notifPath = path.join(userDir, 'notificaciones.json');
  if (!fs.existsSync(notifPath)) return;

  const notif: NotifOutput = JSON.parse(fs.readFileSync(notifPath, 'utf-8'));
  const conversations = Object.values(notif.conversaciones);
  if (conversations.length === 0) return;

  const groq = new Groq({ apiKey });
  const responses: Record<string, GroqAnalysis> = {};

  for (let i = 0; i < conversations.length; i++) {
    const conv = conversations[i];
    const key = `respuesta_${i + 1}`;
    logger.info(`Groq: [${i + 1}/${conversations.length}] analizando conversación con ${conv.nombre}`);

    const mediaFiles = conv.mensajes
      .filter((m) => m.tipo === 'imagen' || m.tipo === 'documento_pdf')
      .map((m) => m.archivo)
      .filter((a): a is string => !!a);

    try {
      const contentParts: Groq.Chat.Completions.ChatCompletionContentPart[] = [];

      contentParts.push({ type: 'text', text: PROMPT });

      // Text messages
      const textLines = conv.mensajes
        .filter((m) => m.tipo === 'texto' && m.cuerpo)
        .map((m) => `[${m.timestamp}] ${m.deMi ? 'Abogado' : conv.nombre}: ${m.cuerpo}`)
        .join('\n');
      if (textLines) {
        contentParts.push({ type: 'text', text: `\nMensajes de texto:\n${textLines}` });
      }

      // Images and PDFs
      for (const msg of conv.mensajes) {
        if (msg.tipo === 'imagen' && msg.archivo) {
          const filePath = path.join(userDir, msg.archivo);
          if (fs.existsSync(filePath)) {
            const base64 = fs.readFileSync(filePath).toString('base64');
            contentParts.push({
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${base64}` },
            });
            if (msg.caption) {
              contentParts.push({ type: 'text', text: `Descripción de la imagen: ${msg.caption}` });
            }
          }
        }

        if (msg.tipo === 'documento_pdf' && msg.archivo) {
          const filePath = path.join(userDir, msg.archivo);
          if (fs.existsSync(filePath)) {
            const pdfImages = await convertPdfToImages(filePath);
            if (pdfImages.length > 0) {
              contentParts.push({ type: 'text', text: `\nDocumento PDF (${pdfImages.length} página(s)):` });
              for (const imgBuf of pdfImages) {
                contentParts.push({
                  type: 'image_url',
                  image_url: { url: `data:image/png;base64,${imgBuf.toString('base64')}` },
                });
              }
            } else {
              // Fallback: extract text when image conversion fails
              const text = await extractPdfText(filePath);
              contentParts.push({
                type: 'text',
                text: text
                  ? `\nContenido del PDF:\n${text}`
                  : '\n[PDF adjunto: no se pudo extraer texto, posiblemente es un documento escaneado]',
              });
            }
          }
        }
      }

      const response = await groq.chat.completions.create({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [{ role: 'user', content: contentParts }],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      });

      const raw = response.choices[0]?.message?.content ?? '';
      responses[key] = { ...(JSON.parse(raw) as GroqAnalysis), media: mediaFiles };
      logger.info(`Groq: conversación ${i + 1} analizada correctamente`);

    } catch (err) {
      logger.error(`Groq: error en conversación ${i + 1} (${conv.nombre}): ${(err as Error).message}`);
      responses[key] = { ...buildFallbackResponse(conv.nombre), media: mediaFiles };
    }
  }

  fs.writeFileSync(
    path.join(userDir, 'groq_respuestas.json'),
    JSON.stringify(responses, null, 2),
    'utf-8'
  );

  logger.info(`Groq: análisis finalizado — ${conversations.length} conversación(es) — ${userDir}`);
}
