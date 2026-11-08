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

const MAX_ARCHIVOS_POR_REQUEST = 20;
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
  fechaDocumento?: string | null; // fecha impresa en el documento (solo informativa)
  recibidaAt?: string; // ISO UTC: cuándo llegó por WhatsApp el primer archivo de esta notificación
  agrupacionDudosa?: boolean; // la IA no pudo asegurar a qué proceso pertenecen algunas páginas
}

const SYSTEM_PROMPT = `Eres un asistente legal especializado en Bolivia. Analiza los mensajes y documentos adjuntos de una conversación de 
WhatsApp que contiene una notificación judicial.

IMPORTANTE: no sabés qué rol cumple el cliente del estudio jurídico en este proceso (podría ser demandante, demandado, o un tercero). Nunca asumas
 ni des a entender de qué lado está — describí los hechos del documento de forma neutral y objetiva en todos los campos.

IMPORTANTE SOBRE DOCUMENTOS MÚLTIPLES: es muy común que la notificación venga acompañada de una copia de un documento anterior al que responde 
(por ejemplo, un memorial presentado por una de las partes, seguido de la respuesta/auto del juzgado a ese memorial). Estos vienen con fechas 
distintas, y no necesariamente en orden — no asumas que la primera página cronológicamente es la más antigua. Para identificar cuál es la 
notificación real (la que manda para calcular fechas y plazos): es la que tiene la fecha MÁS RECIENTE entre todos los documentos fechados presentes.
Cualquier documento de fecha anterior dentro del mismo envío es un antecedente o adjunto, no la notificación en sí — mencionalo en el resumen como
contexto, pero la "fecha" que reportes debe ser la del documento más reciente.

IMPORTANTE SOBRE EL NÚMERO DE PROCESO: en los procesos civiles antiguos, el número identificador del proceso se llama "IANUS" (por ejemplo
"IANUS: 3015228"). IANUS y NUREJ son lo mismo: el código único del proceso, solo que antes se llamaba IANUS y ahora se llama NUREJ. Si el documento
trae un número con la etiqueta IANUS (y no trae NUREJ), usalo como NUREJ. Si trae los dos, preferí el NUREJ. No confundas este número con otros
números del documento (número de auto de vista, folios, testimonios, códigos de sello o código de barras): solo vale el que está rotulado como
NUREJ, IANUS, CUD o número de expediente/causa.

IMPORTANTE SOBRE PROCESOS PENALES: en los casos penales, el número que identifica el proceso se llama "CUD". Un proceso tiene un solo número identificador: los penales traen CUD, y los civiles o familiares traen NUREJ o IANUS. Si el documento trae un número rotulado como CUD, usalo como el valor de "nurej". No lo confundas con otros números del documento (folios, números de oficio, códigos de sello o código de barras).
IMPORTANTE SOBRE VARIAS NOTIFICACIONES EN UNA MISMA CONVERSACIÓN: una conversación puede traer notificaciones de VARIOS procesos distintos (por ejemplo, el juzgado acumuló los envíos de varios días y los mandó juntos). Cada archivo viene numerado ("Archivo 1", "Archivo 2", ...) en el orden en que llegó. Devolvé UNA notificación por cada proceso distinto, con los números de los archivos que le pertenecen en "archivos". Todo archivo debe quedar en exactamente una notificación. Un memorial y el auto que lo responde, del mismo proceso, son UNA sola notificación. Dos documentos de procesos distintos son notificaciones separadas, aunque sean del mismo juzgado y de las mismas partes.

IMPORTANTE SOBRE DOCUMENTOS DE VARIAS PÁGINAS: una notificación suele llegar como varias fotos o páginas sueltas, y el número de proceso (NUREJ, IANUS o CUD) normalmente aparece SOLO en la primera página; las demás páginas son solo contenido y no lo repiten. No esperes ver el número en cada página. Para decidir a qué proceso pertenece una página sin número: (1) fijate en el orden de llegada, porque las páginas de un mismo documento casi siempre llegan seguidas; (2) leé el final de una página y el comienzo de la siguiente: si el texto continúa (una oración cortada, una enumeración que sigue, la numeración de folios o de puntos), son del mismo documento; (3) buscá señales de que un documento empieza (encabezado del juzgado, título, número de proceso, lugar y fecha, la palabra "VISTOS") o termina (firma, sello, "Regístrese y notifíquese"); (4) si una página sin número encaja por su contenido con otro proceso mejor que con el anterior, asignala a ese. Las páginas pueden llegar mezcladas entre documentos: reconstruí cada documento como un rompecabezas. Si no podés decidir con seguridad a qué proceso pertenece algún archivo, asignalo al más probable y poné "agrupacionDudosa" en true.

Usá la herramienta "extraer_notificaciones" para devolver la lista de notificaciones extraídas.`;

const TOOL_DEFINITION: Anthropic.Tool = {
  name: 'extraer_notificacion',
  description: 'Extrae los datos estructurados de una notificación judicial boliviana a partir de los documentos y mensajes de WhatsApp analizados.',
  input_schema: {
    type: 'object',
    properties: {
      nurej: { type: ['string', 'null'], description: 'NUREJ (o IANUS, que es el nombre antiguo del mismo número; o CUD, que es el código de los casos penales) o número de expediente si aparece en el documento' },
        "esEvento": {
        type: 'boolean',
        description: 'true SOLO si el documento fija una fecha y hora concreta a la que el abogado debe atender, sea presencial O VIRTUAL (una audiencia, una inspección, una reunión de conciliación, una videollamada, una reunión con un conciliador o mediador, o cualquier otro acto procesal con fecha y hora fija). No asumas que tiene que ser presencial — si el documento dice que es virtual, igual es esEvento: true. false si solo hay un plazo para responder por escrito, o no hay fecha relevante.',
      },
      tipoEvento: { type: ['string', 'null'], description: 'Si esEvento es true: descripción libre y breve del tipo de evento según el documento (ej. "Audiencia de conciliación", "Inspección ocular"). Si es false: null.' },
      fecha: { type: ['string', 'null'], description: 'Si esEvento es true: fecha del evento (YYYY-MM-DD). Si esEvento es false pero hay un plazo: fecha impresa del documento (informativa: el plazo se cuenta desde que el mensaje llegó por WhatsApp, no desde esta fecha). Si no hay fecha relevante: null.' },
      hora: { type: ['string', 'null'], description: 'Si esEvento es true y el documento menciona hora: formato HH:MM (24hs). Si no: null.' },
      plazoDias: { type: ['number', 'null'], description: 'Número de días para responder o actuar, SOLO si el documento lo menciona explícitamente (ej. "diez días hábiles" → 10). Nunca inventes ni infieras un número que el documento no dice literalmente.' },
      plazoUnidad: { type: ['string', 'null'], enum: ['habiles', 'corridos', null], description: "'habiles' o 'corridos' según lo que diga el documento junto al plazo. Si no hay plazoDias, null." },
      resumenAbogado: { type: 'string', description: 'Resumen técnico-legal: tipo de acto procesal, juzgado, partes involucradas, plazos legales y acciones que debe tomar el abogado. Si el envío incluye un documento anterior (ej. un memorial u otro escrito de alguna de las partes) junto con la respuesta/auto del juzgado a ese documento, estructurá el resumen en dos partes breves: primero qué se solicitó o argumentó en el documento anterior, después qué resolvió o dispuso el juzgado en respuesta — así se entiende el contexto completo sin abrir el archivo original. Si el documento es un acto virtual e incluye un enlace de acceso (Zoom, Meet, Teams, etc.), mencioná que trae un enlace de acceso — pero NO copies ni reproduzcas el enlace en sí, el abogado debe revisarlo directo en el documento original.' },
      resumenCliente: {
        type: 'string',
        description:
          'Mensaje para el cliente, en 3 partes: (1) empieza EXACTAMENTE con "Buenas tardes {{NOMBRE_CLIENTE}}," (el nombre se reemplaza después por el real, nunca uses un nombre visto en la conversación); (2) resumen breve y NEUTRAL en tercera persona de qué trata el documento, indicando siempre el tipo de proceso y los nombres de las partes tal como aparecen en el documento (quién contra quién), narrando los hechos tal como aparecen, sin asumir de qué lado está el cliente — si hay un documento anterior (memorial) junto con la respuesta del juzgado, contextualizá brevemente ambas partes en una sola frase corrida (ej. "en respuesta a un memorial donde se solicitaba X, el juzgado resolvió Y"), sin extenderte de más; (3) SIEMPRE cierra pidiendo que se comunique con su abogado a la brevedad posible.',
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

// Herramienta que usa la IA: devuelve una LISTA con una notificación por cada
// proceso distinto que haya en la conversación. Reutiliza los campos de
// TOOL_DEFINITION y agrega a qué archivos pertenece cada una.
const ITEM_SCHEMA = TOOL_DEFINITION.input_schema as any;
const TOOL_LISTA: Anthropic.Tool = {
  name: 'extraer_notificaciones',
  description: 'Devuelve una notificación por cada proceso judicial distinto que haya en la conversación de WhatsApp, con los datos estructurados de cada una y los archivos que le corresponden.',
  input_schema: {
    type: 'object',
    properties: {
      notificaciones: {
        type: 'array',
        minItems: 1,
        description: 'Una entrada por cada proceso distinto. Un memorial y el auto que lo responde, del mismo proceso, van juntos en UNA sola entrada.',
        items: {
          type: 'object',
          properties: {
            ...ITEM_SCHEMA.properties,
            fechaDocumento: { type: ['string', 'null'], description: 'Fecha impresa en el documento más reciente de esta notificación (YYYY-MM-DD). Es solo informativa. Si ningún documento trae una fecha legible: null.' },
            archivos: { type: 'array', items: { type: 'number' }, description: 'Números de los archivos ("Archivo N") que pertenecen a esta notificación. Todo archivo debe quedar en exactamente una notificación. Si la notificación llegó solo como texto: lista vacía.' },
            agrupacionDudosa: { type: 'boolean', description: 'true si no pudiste decidir con seguridad a qué proceso pertenecen una o más páginas (por ejemplo, páginas sin número de proceso que podrían ser de dos documentos distintos). Si estás seguro: false.' },
          },
          required: [...(ITEM_SCHEMA.required as string[]), 'fechaDocumento', 'archivos', 'agrupacionDudosa'],
        },
      },
    },
    required: ['notificaciones'],
  },
};

type NotificacionIA = NotificationAnalysis & { archivos?: number[] };

/** Hora (HH:MM, 24h) en Bolivia de un instante ISO. */
function horaBolivia(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    timeZone: 'America/La_Paz',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
}

/** Momento (ISO) del primer mensaje recibido de la conversación. */
function primerTimestamp(conv: Conversation): string | undefined {
  const recibidos = conv.mensajes.filter((m) => !m.deMi).map((m) => m.timestamp).sort();
  return recibidos[0] ?? conv.mensajes.map((m) => m.timestamp).sort()[0];
}

/** Convierte la lista que devolvió la IA en una respuesta por notificación:
 *  cada una con SUS archivos y con la hora en que llegó su primer archivo
 *  (esa es la fecha de notificación). Los archivos que la IA no asignó (o que
 *  no se pudieron enviar a la IA) se adjuntan a la primera notificación y se
 *  marca la agrupación como dudosa para que el abogado los revise. */
export function repartirNotificaciones(
  lista: NotificacionIA[],
  incluidos: ExtractedMessage[],
  mediaFiles: string[],
  conv: Conversation
): NotificationAnalysis[] {
  const usados = new Set<number>();
  const resultado: NotificationAnalysis[] = lista.map((n) => {
    const { archivos, ...datos } = n;
    const idxs = (Array.isArray(archivos) ? archivos : [])
      .filter((x) => Number.isInteger(x) && x >= 1 && x <= incluidos.length && !usados.has(x))
      .sort((a, b) => a - b);
    idxs.forEach((x) => usados.add(x));
    const msgs = idxs.map((x) => incluidos[x - 1]);
    return {
      ...datos,
      media: msgs.map((m) => m.archivo).filter((a): a is string => !!a),
      recibidaAt: msgs.map((m) => m.timestamp).sort()[0] ?? primerTimestamp(conv),
    };
  });

  const asignadas = new Set(resultado.flatMap((r) => r.media ?? []));
  const sueltos = mediaFiles.filter((f) => !asignadas.has(f));
  if (sueltos.length > 0 && resultado.length > 0) {
    resultado[0].media = [...(resultado[0].media ?? []), ...sueltos];
    resultado[0].agrupacionDudosa = true;
  }
  return resultado;
}

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

      const incluidos: ExtractedMessage[] = []; // archivos enviados a la IA, en orden: "Archivo 1" = incluidos[0]
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
            contentBlocks.push({ type: 'text', text: `Archivo ${incluidos.length + 1} (llegó a las ${horaBolivia(msg.timestamp)}):` });
            contentBlocks.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: buffer.toString('base64') } });
            incluidos.push(msg);
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
              if (bytesAcumulados + buffer.length > MAX_REQUEST_BYTES) {
              archivosOmitidos++;
              continue;
            }
            contentBlocks.push({ type: 'text', text: `Archivo ${incluidos.length + 1} (llegó a las ${horaBolivia(msg.timestamp)}):` });
            contentBlocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') } });
            incluidos.push(msg);
            if (msg.caption) {
              contentBlocks.push({ type: 'text', text: `Descripción del documento: ${msg.caption}` });
            }
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

      contentBlocks.push({ type: 'text', text: 'Analizá los documentos y mensajes de arriba y usá la herramienta "extraer_notificaciones" con una notificación por cada proceso distinto.' });

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        tools: [TOOL_LISTA],
        tool_choice: { type: 'tool', name: 'extraer_notificaciones' },
        messages: [{ role: 'user', content: contentBlocks }],
      });

      const toolUse = response.content.find((b) => b.type === 'tool_use');
      if (!toolUse || toolUse.type !== 'tool_use') {
        throw new Error('Claude no devolvió el resultado con la herramienta esperada');
      }

      const lista = (toolUse.input as { notificaciones?: NotificacionIA[] }).notificaciones;
      if (!Array.isArray(lista) || lista.length === 0) {
        throw new Error('Claude no devolvió ninguna notificación');
      }
      repartirNotificaciones(lista, incluidos, mediaFiles, conv).forEach((notif, j) => {
        responses[`${key}_${j + 1}`] = notif;
      });
      logger.info(`Claude: conversación ${i + 1} → ${lista.length} notificación(es) detectada(s)`);
      logger.info(`Claude: conversación ${i + 1} analizada correctamente`);
    } catch (err) {
      logger.error(`Claude: error en conversación ${i + 1} (${conv.nombre}): ${(err as Error).message}`);
      responses[key] = { ...buildFallbackResponse(conv.nombre), media: mediaFiles, recibidaAt: primerTimestamp(conv) };
    }
  }

  fs.writeFileSync(path.join(userDir, 'respuestas_ia.json'), JSON.stringify(responses, null, 2), 'utf-8');
  logger.info(`Claude: análisis finalizado — ${conversations.length} conversación(es) — ${userDir}`);
}