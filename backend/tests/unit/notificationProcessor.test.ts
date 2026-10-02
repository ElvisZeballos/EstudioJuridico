import fs from 'fs';
import os from 'os';
import path from 'path';
import { processAiResults } from '../../src/services/notificationProcessor';
import { encrypt } from '../../src/config/encryption';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';

jest.mock('../../src/shared/prisma', () => ({
  __esModule: true,
  default: require('../helpers/prismaMock').prismaMock,
}));

// El cálculo de días hábiles ya se prueba en feriados.test.ts; aquí solo se
// verifica CÓMO lo usa el procesador (qué plazo y qué unidad le pasa).
jest.mock('../../src/shared/feriados', () => ({
  __esModule: true,
  sumarDiasHabiles: jest.fn(),
  sumarDiasCorridos: jest.fn(),
}));

const { sendWhatsAppMessage } = jest.requireMock('../../src/services/whatsappService');
const { sendEmailWithAttachments } = jest.requireMock('../../src/infrastructure/email');
const { createCalendarEvent } = jest.requireMock('../../src/infrastructure/googleCalendar');
const { sumarDiasHabiles, sumarDiasCorridos } = jest.requireMock('../../src/shared/feriados');

const ABOGADO = { email: 'abogado@estudio.com', googleRefreshToken: 'refresh-token', nombre: 'Ana', apellido: 'Soto' };

function casoConTelefono(telefono: string | null) {
  return {
    id: 'caso-1',
    titulo: 'Juicio de Prueba',
    abogados: [{ abogado: { id: 'ab-1', email: ABOGADO.email, googleRefreshToken: 'refresh-token', nombre: 'Ana' } }],
    clientes: [{ cliente: { user: { nombre: 'Juan', apellido: 'Pinto', telefono: telefono ? encrypt(telefono) : null } } }],
  };
}

function analisis(over: Record<string, unknown> = {}) {
  return {
    nurej: '30396431-1',
    fecha: '2026-10-05',
    esEvento: false,
    tipoEvento: null,
    hora: null,
    plazoDias: null,
    plazoUnidad: null,
    resumenAbogado: 'Resumen para el abogado',
    resumenCliente: 'Buenas tardes {{NOMBRE_CLIENTE}}, le informamos que hay una novedad. Comuníquese con su abogado.',
    resumenGeneral: 'Resumen general',
    juzgado: 'Juzgado Civil N°1',
    tipoDocumento: 'auto',
    ...over,
  };
}

let tmpDir: string;

async function procesar(resp: Record<string, unknown>) {
  fs.writeFileSync(path.join(tmpDir, 'respuestas_ia.json'), JSON.stringify({ respuesta_1: resp }), 'utf-8');
  await processAiResults(tmpDir, 'ab-1');
}

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notif-test-'));

  // Salta la espera fija de 5 s que el procesador hace después de cada WhatsApp.
  jest.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void) => {
    fn();
    return 0;
  }) as never);

  prismaMock.user.findUnique.mockResolvedValue(ABOGADO);
  prismaMock.caso.findFirst.mockResolvedValue(casoConTelefono('71234567'));
  prismaMock.casoNovedad.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: `nov-${data.esNotificacion ? 'notif' : 'recordatorio'}`,
    ...data,
  }));
  prismaMock.casoNovedad.update.mockResolvedValue({});
  createCalendarEvent.mockResolvedValue('evento-google-1');
  sumarDiasHabiles.mockResolvedValue(new Date('2026-10-08T12:00:00.000Z'));
  sumarDiasCorridos.mockReturnValue(new Date('2026-10-15T12:00:00.000Z'));
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('normalización del teléfono del cliente (formato Bolivia 591XXXXXXXX)', () => {
  test.each([
    ['71234567', '59171234567'],
    ['+591 71234567', '59171234567'],
    ['591-712-34567', '59171234567'],
    ['(591) 71234567', '59171234567'],
    ['+59171234567', '59171234567'],
  ])('teléfono guardado %p → se envía a %p', async (guardado, esperado) => {
    prismaMock.caso.findFirst.mockResolvedValue(casoConTelefono(guardado));
    await procesar(analisis());
    expect(sendWhatsAppMessage).toHaveBeenCalledTimes(1);
    expect(sendWhatsAppMessage).toHaveBeenCalledWith('ab-1', esperado, expect.any(String));
  });

  test('teléfono demasiado corto (menos de 11 dígitos con prefijo) NO se envía', async () => {
    prismaMock.caso.findFirst.mockResolvedValue(casoConTelefono('1234'));
    await procesar(analisis());
    expect(sendWhatsAppMessage).not.toHaveBeenCalled();
  });

  test('cliente sin teléfono registrado NO genera envío ni error', async () => {
    prismaMock.caso.findFirst.mockResolvedValue(casoConTelefono(null));
    await procesar(analisis());
    expect(sendWhatsAppMessage).not.toHaveBeenCalled();
    expect(prismaMock.casoNovedad.create).toHaveBeenCalled(); // la novedad se guarda igual
  });

  test('número extranjero guardado con "+" conserva su código de país y NO recibe el prefijo 591', async () => {
    prismaMock.caso.findFirst.mockResolvedValue(casoConTelefono('+54 9 11 1234-5678'));
    await procesar(analisis());
    expect(sendWhatsAppMessage).toHaveBeenCalledWith('ab-1', '5491112345678', expect.any(String));
  });

  test('reemplaza {{NOMBRE_CLIENTE}} por el nombre real de la base de datos, no el que extrajo la IA', async () => {
    await procesar(analisis());
    const mensaje = sendWhatsAppMessage.mock.calls[0][2] as string;
    expect(mensaje).toContain('Buenas tardes Juan,');
    expect(mensaje).not.toContain('{{NOMBRE_CLIENTE}}');
  });
});

describe('búsqueda del caso por NUREJ', () => {
  test('busca por "contiene" sin distinguir mayúsculas, solo casos activos', async () => {
    await procesar(analisis({ nurej: '30396431-1' }));
    expect(prismaMock.caso.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { numero: { contains: '30396431-1', mode: 'insensitive' }, active: true },
      })
    );
  });

  test('sin NUREJ no busca caso, no avisa al cliente y no crea novedad; sí avisa por email al abogado dueño de la sesión', async () => {
    await procesar(analisis({ nurej: null }));
    expect(prismaMock.caso.findFirst).not.toHaveBeenCalled();
    expect(sendWhatsAppMessage).not.toHaveBeenCalled();
    expect(prismaMock.casoNovedad.create).not.toHaveBeenCalled();
    expect(sendEmailWithAttachments).toHaveBeenCalledWith(ABOGADO.email, expect.any(String), expect.any(String), []);
  });

  test('NUREJ que no existe en el sistema: mismo comportamiento que sin NUREJ (no crea nada)', async () => {
    prismaMock.caso.findFirst.mockResolvedValue(null);
    await procesar(analisis({ nurej: '99999999-9' }));
    expect(sendWhatsAppMessage).not.toHaveBeenCalled();
    expect(prismaMock.casoNovedad.create).not.toHaveBeenCalled();
  });

  test('si el abogado de la sesión no existe, no procesa nada', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await procesar(analisis());
    expect(prismaMock.caso.findFirst).not.toHaveBeenCalled();
  });

  test('si no existe el archivo de respuestas, termina sin error', async () => {
    await expect(processAiResults(path.join(tmpDir, 'no-existe'), 'ab-1')).resolves.toBeUndefined();
  });
});

describe('fallos parciales no deben abortar el resto del flujo', () => {
  test('si falla el envío de email, igual se avisa al cliente por WhatsApp y se guarda la novedad', async () => {
    sendEmailWithAttachments.mockRejectedValueOnce(new Error('SMTP caído'));
    await procesar(analisis());
    expect(sendWhatsAppMessage).toHaveBeenCalledTimes(1);
    expect(prismaMock.casoNovedad.create).toHaveBeenCalled();
  });

  test('si falla el WhatsApp al cliente, igual se guarda la novedad', async () => {
    sendWhatsAppMessage.mockRejectedValueOnce(new Error('sin sesión'));
    await procesar(analisis());
    expect(prismaMock.casoNovedad.create).toHaveBeenCalled();
  });

  test('si falla Google Calendar, igual se guarda la novedad', async () => {
    createCalendarEvent.mockRejectedValue(new Error('invalid_grant'));
    await procesar(analisis({ esEvento: true, hora: '09:00' }));
    expect(prismaMock.casoNovedad.create).toHaveBeenCalled();
  });
});

describe('calendarización: eventos reales vs. recordatorios de plazo', () => {
  test('esEvento con fecha y hora → la novedad se guarda con fechaAgendada y se crea un evento en Calendar', async () => {
    await procesar(analisis({ esEvento: true, tipoEvento: 'Audiencia', fecha: '2026-10-05', hora: '09:00' }));
    const [{ data }] = prismaMock.casoNovedad.create.mock.calls[0];
    expect(data.fechaAgendada).toBeInstanceOf(Date);
    expect(data.esNotificacion).toBe(true);
    expect(createCalendarEvent).toHaveBeenCalledTimes(1);
    expect(prismaMock.casoNovedad.create).toHaveBeenCalledTimes(1); // un evento real NO genera además un recordatorio de plazo
  });

  test('esEvento pero SIN hora → no se inventa un horario: queda sin agendar', async () => {
    await procesar(analisis({ esEvento: true, hora: null }));
    const [{ data }] = prismaMock.casoNovedad.create.mock.calls[0];
    expect(data.fechaAgendada).toBeNull();
    expect(createCalendarEvent).not.toHaveBeenCalled();
  });

  test('HALLAZGO: la hora del evento debe interpretarse en hora de Bolivia (09:00 en Bolivia = 13:00 UTC), sin depender de la zona horaria del servidor', async () => {
    // El servidor de producción corre en UTC (ver jest.config.js). notificationProcessor.ts arma la fecha con
    // new Date(`${fecha}T${hora}:00`) — sin offset — así que en UTC guarda 09:00Z (= 05:00 en Bolivia).
    // novedades.service.ts (carga manual) sí ancla a Bolivia con "-04:00".
    await procesar(analisis({ esEvento: true, fecha: '2026-10-05', hora: '09:00' }));
    const [{ data }] = prismaMock.casoNovedad.create.mock.calls[0];
    expect((data.fechaAgendada as Date).toISOString()).toBe('2026-10-05T13:00:00.000Z');
  });

  test('sin evento y sin plazo explícito → recordatorio con plazo por defecto de 3 días HÁBILES', async () => {
    await procesar(analisis({ esEvento: false, plazoDias: null, plazoUnidad: null }));
    expect(sumarDiasHabiles).toHaveBeenCalledWith(new Date('2026-10-05T12:00:00.000Z'), 3);
    const recordatorio = prismaMock.casoNovedad.create.mock.calls[1][0].data;
    expect(recordatorio.titulo).toContain('Último día para responder');
    expect(recordatorio.titulo).toContain('30396431-1');
    expect(recordatorio.contenido).toContain('plazo por defecto');
    expect(recordatorio.esNotificacion).toBe(false);
  });

  test('el recordatorio queda a las 8:00 am Bolivia (12:00 UTC) del último día', async () => {
    sumarDiasHabiles.mockResolvedValue(new Date('2026-10-08T03:00:00.000Z'));
    await procesar(analisis());
    const recordatorio = prismaMock.casoNovedad.create.mock.calls[1][0].data;
    expect((recordatorio.fechaAgendada as Date).toISOString()).toBe('2026-10-08T12:00:00.000Z');
    expect((recordatorio.fecha as Date).toISOString()).toBe('2026-10-08T12:00:00.000Z');
  });

  test('plazo explícito en días hábiles → usa sumarDiasHabiles con ese número', async () => {
    await procesar(analisis({ plazoDias: 10, plazoUnidad: 'habiles' }));
    expect(sumarDiasHabiles).toHaveBeenCalledWith(expect.any(Date), 10);
    expect(sumarDiasCorridos).not.toHaveBeenCalled();
  });

  test('plazo explícito en días corridos → usa sumarDiasCorridos', async () => {
    await procesar(analisis({ plazoDias: 15, plazoUnidad: 'corridos' }));
    expect(sumarDiasCorridos).toHaveBeenCalledWith(expect.any(Date), 15);
    expect(sumarDiasHabiles).not.toHaveBeenCalled();
  });

  test('una sentencia NO genera recordatorio de plazo', async () => {
    await procesar(analisis({ tipoDocumento: 'sentencia' }));
    expect(prismaMock.casoNovedad.create).toHaveBeenCalledTimes(1);
    expect(sumarDiasHabiles).not.toHaveBeenCalled();
  });

  test('sin fecha en el documento → usa la fecha de procesamiento y deja un aviso visible en la novedad', async () => {
    await procesar(analisis({ fecha: null }));
    const [{ data }] = prismaMock.casoNovedad.create.mock.calls[0];
    expect(data.contenido).toContain('No se identificó una fecha de envío explícita');
  });

  test('sin token de Google del abogado no se intenta crear evento en Calendar', async () => {
    prismaMock.caso.findFirst.mockResolvedValue({
      ...casoConTelefono('71234567'),
      abogados: [{ abogado: { id: 'ab-1', email: ABOGADO.email, googleRefreshToken: null, nombre: 'Ana' } }],
    });
    await procesar(analisis({ esEvento: true, hora: '09:00' }));
    expect(createCalendarEvent).not.toHaveBeenCalled();
    expect(prismaMock.casoNovedad.create).toHaveBeenCalled();
  });
});
