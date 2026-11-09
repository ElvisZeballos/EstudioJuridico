// tests/setup/mocks.ts reemplaza claude.ts por un mock global; aquí se necesita el módulo real.
jest.unmock('../../src/infrastructure/claude');
jest.mock('sharp', () => ({ __esModule: true, default: jest.fn() })); // no hace falta procesar imágenes aquí
import { repartirNotificaciones, normalizarLista } from '../../src/infrastructure/claude';

const msg = (n: number, hora: string, deMi = false) => ({
  timestamp: `2026-11-05T${hora}:00.000Z`,
  deMi,
  tipo: 'imagen' as const,
  archivo: `media/foto${n}.jpg`,
});

const base = (nurej: string, archivos: number[], extra: Record<string, unknown> = {}) => ({
  nurej,
  fecha: null,
  esEvento: false,
  tipoEvento: null,
  hora: null,
  plazoDias: null,
  plazoUnidad: null,
  resumenAbogado: 'a',
  resumenCliente: 'c',
  resumenGeneral: 'g',
  juzgado: null,
  tipoDocumento: 'auto',
  archivos,
  ...extra,
});

describe('repartirNotificaciones', () => {
  // Llegan mezcladas: A1, B1, A2, B2, A3
  const incluidos = [msg(1, '14:00'), msg(2, '14:01'), msg(3, '14:02'), msg(4, '14:03'), msg(5, '14:04')];
  const todos = incluidos.map((m) => m.archivo!);
  const conv = { jid: 'x', nombre: 'Juzgado', esGrupo: false, mensajes: incluidos };

  test('cada notificación se queda con SUS archivos aunque hayan llegado intercalados', () => {
    const r = repartirNotificaciones([base('111', [1, 3, 5]), base('222', [2, 4])], incluidos, todos, conv);
    expect(r).toHaveLength(2);
    expect(r[0].media).toEqual(['media/foto1.jpg', 'media/foto3.jpg', 'media/foto5.jpg']);
    expect(r[1].media).toEqual(['media/foto2.jpg', 'media/foto4.jpg']);
    expect(r[0]).not.toHaveProperty('archivos');
    expect(r[0].agrupacionDudosa).toBeUndefined();
  });

  test('la hora de notificación es la del PRIMER archivo de cada caso', () => {
    const r = repartirNotificaciones([base('111', [3, 1]), base('222', [4, 2])], incluidos, todos, conv);
    expect(r[0].recibidaAt).toBe('2026-11-05T14:00:00.000Z');
    expect(r[1].recibidaAt).toBe('2026-11-05T14:01:00.000Z');
  });

  test('un archivo repetido en dos notificaciones se queda solo en la primera', () => {
    const r = repartirNotificaciones([base('111', [1, 2]), base('222', [2, 3, 4, 5])], incluidos, todos, conv);
    expect(r[0].media).toEqual(['media/foto1.jpg', 'media/foto2.jpg']);
    expect(r[1].media).toEqual(['media/foto3.jpg', 'media/foto4.jpg', 'media/foto5.jpg']);
  });

  test('archivos sin asignar (o no enviados a la IA) van a la primera notificación y marcan la agrupación como dudosa', () => {
    const r = repartirNotificaciones([base('111', [1]), base('222', [2])], incluidos, [...todos, 'media/omitida.jpg'], conv);
    expect(r[0].media).toEqual(['media/foto1.jpg', 'media/foto3.jpg', 'media/foto4.jpg', 'media/foto5.jpg', 'media/omitida.jpg']);
    expect(r[0].agrupacionDudosa).toBe(true);
    expect(r[1].media).toEqual(['media/foto2.jpg']);
  });

  test('números de archivo inválidos se ignoran sin romper', () => {
    const r = repartirNotificaciones([base('111', [0, 99, 1.5, 1])], incluidos, todos, conv);
    expect(r[0].media).toContain('media/foto1.jpg');
  });

  test('notificación que llegó solo como texto toma la hora del primer mensaje recibido', () => {
    const c = { ...conv, mensajes: [{ timestamp: '2026-11-05T13:50:00.000Z', deMi: false, tipo: 'texto' as const, cuerpo: 'hola' }, ...incluidos] };
    const r = repartirNotificaciones([base('111', [])], [], [], c);
    expect(r[0].media).toEqual([]);
    expect(r[0].recibidaAt).toBe('2026-11-05T13:50:00.000Z');
  });
}); 
describe('normalizarLista (formas en que la IA puede devolver la respuesta)', () => {
  const n = { nurej: '111', resumenAbogado: 'a' };

  test('lista normal', () => {
    expect(normalizarLista({ notificaciones: [n, n] })).toHaveLength(2);
  });
  test('lista devuelta como texto JSON', () => {
    expect(normalizarLista({ notificaciones: JSON.stringify([n]) })).toEqual([n]);
  });
  test('un solo objeto en vez de lista', () => {
    expect(normalizarLista({ notificaciones: n })).toEqual([n]);
  });
  test('campos sueltos sin la lista', () => {
    expect(normalizarLista(n)).toEqual([n]);
  });
  test('texto inválido o vacío → lista vacía', () => {
    expect(normalizarLista({ notificaciones: 'no es json' })).toEqual([]);
    expect(normalizarLista({})).toEqual([]);
    expect(normalizarLista(null)).toEqual([]);
  });
});
describe('normalizarLista descarta entradas inválidas', () => {
  const n = { nurej: '111', resumenAbogado: 'a' };

  test('entradas que son texto JSON de un objeto válido se aceptan', () => {
    expect(normalizarLista({ notificaciones: [JSON.stringify(n)] })).toEqual([n]);
  });
  test('entradas sin resumenAbogado o que no son objetos se descartan (nunca llega "undefined" al correo)', () => {
    expect(normalizarLista({ notificaciones: [{}] })).toEqual([]);
    expect(normalizarLista({ notificaciones: ['texto suelto'] })).toEqual([]);
    expect(normalizarLista({ notificaciones: [{ nurej: '1' }, n] })).toEqual([n]);
  });
});
describe('normalizarLista con la respuesta doblemente envuelta (caso real de producción)', () => {
  const n = { nurej: '30487335-1', resumenAbogado: 'Memorial…', archivos: [1, 2, 3, 4, 5, 6], agrupacionDudosa: false };

  test('texto que contiene un objeto con la lista', () => {
    const crudo = { notificaciones: JSON.stringify({ notificaciones: [n] }) };
    expect(normalizarLista(crudo)).toEqual([n]);
  });
  test('texto que contiene directamente la lista', () => {
    expect(normalizarLista({ notificaciones: JSON.stringify([n]) })).toEqual([n]);
  });
  test('texto que contiene un solo objeto', () => {
    expect(normalizarLista({ notificaciones: JSON.stringify(n) })).toEqual([n]);
  });
});