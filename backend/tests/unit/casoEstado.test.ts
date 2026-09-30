import { getEstadoEfectivo } from '../../src/shared/casoEstado';

// Reloj fijo: 25-sep-2026 15:00 UTC = 11:00 en Bolivia
const AHORA = new Date('2026-09-25T15:00:00Z');

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(AHORA);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('getEstadoEfectivo', () => {
  test('sin fecha de cierre conserva el estado guardado', () => {
    expect(getEstadoEfectivo('ACTIVO', null)).toBe('ACTIVO');
    expect(getEstadoEfectivo('PENDIENTE', null)).toBe('PENDIENTE');
  });

  test('con fecha de cierre futura conserva el estado guardado', () => {
    expect(getEstadoEfectivo('ACTIVO', new Date('2026-09-26T00:00:00Z'))).toBe('ACTIVO');
  });

  test('con fecha de cierre pasada pasa a CONCLUIDO automáticamente', () => {
    expect(getEstadoEfectivo('ACTIVO', new Date('2026-09-01T00:00:00Z'))).toBe('CONCLUIDO');
    expect(getEstadoEfectivo('PENDIENTE', new Date('2026-09-01T00:00:00Z'))).toBe('CONCLUIDO');
  });

  test('el mismo día de la fecha de cierre ya cuenta como CONCLUIDO', () => {
    expect(getEstadoEfectivo('ACTIVO', new Date('2026-09-25T00:00:00Z'))).toBe('CONCLUIDO');
  });

  test('ARCHIVADO nunca cambia (decisión manual del abogado), aunque la fecha haya pasado', () => {
    expect(getEstadoEfectivo('ARCHIVADO', new Date('2026-01-01T00:00:00Z'))).toBe('ARCHIVADO');
  });

  test('un caso ya CONCLUIDO se mantiene CONCLUIDO', () => {
    expect(getEstadoEfectivo('CONCLUIDO', new Date('2026-01-01T00:00:00Z'))).toBe('CONCLUIDO');
  });

  test('"hoy" se calcula en hora de Bolivia: 22:00 del 25-sep allá (02:00 UTC del 26) NO concluye un cierre del 26-sep', () => {
    jest.setSystemTime(new Date('2026-09-26T02:00:00Z'));
    expect(getEstadoEfectivo('ACTIVO', new Date('2026-09-26T00:00:00Z'))).toBe('ACTIVO');
  });

  test('...y sí lo concluye una vez que en Bolivia ya es 26-sep (04:00 UTC)', () => {
    jest.setSystemTime(new Date('2026-09-26T04:00:00Z'));
    expect(getEstadoEfectivo('ACTIVO', new Date('2026-09-26T00:00:00Z'))).toBe('CONCLUIDO');
  });
});
