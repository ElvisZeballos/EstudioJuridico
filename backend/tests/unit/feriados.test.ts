import {
  esFeriado,
  esDiaHabil,
  sumarDiasHabiles,
  sumarDiasCorridos,
  limpiarCacheFeriados,
} from '../../src/shared/feriados';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';

jest.mock('../../src/shared/prisma', () => ({
  __esModule: true,
  default: require('../helpers/prismaMock').prismaMock,
}));

// Calendario usado en las pruebas (2026):
//   Jue 24-sep = feriado base  →  Vie 25-sep = feriado por traslado (jueves→viernes)
//   Dom 01-nov = feriado base  →  Lun 02-nov = feriado por traslado (domingo→lunes)
// Los feriados se guardan como medianoche Bolivia = 04:00 UTC, igual que feriados.service.create().
const FERIADOS_BASE = ['2026-09-24', '2026-11-01'];

function configurar(
  feriados: string[] = FERIADOS_BASE,
  config = { trasladoJuevesAViernes: true, trasladoDomingoALunes: true }
) {
  prismaMock.feriado.findMany.mockResolvedValue(
    feriados.map((d) => ({ id: d, fecha: new Date(`${d}T04:00:00.000Z`), nombre: `Feriado ${d}`, ambito: 'nacional', origen: 'manual' }))
  );
  prismaMock.configuracionFeriados.findFirst.mockResolvedValue({ id: 'cfg-1', ...config });
}

const d = (iso: string) => new Date(iso);

beforeEach(() => {
  resetPrismaMock();
  limpiarCacheFeriados();
});

describe('esFeriado', () => {
  test('devuelve true para un feriado base cargado en la tabla', async () => {
    configurar();
    expect(await esFeriado(d('2026-09-24T12:00:00Z'))).toBe(true);
  });

  test('devuelve false para un día laboral común', async () => {
    configurar();
    expect(await esFeriado(d('2026-09-23T12:00:00Z'))).toBe(false);
  });

  test('regla jueves→viernes activada: el viernes siguiente a un feriado en jueves es feriado', async () => {
    configurar(FERIADOS_BASE, { trasladoJuevesAViernes: true, trasladoDomingoALunes: true });
    expect(await esFeriado(d('2026-09-25T12:00:00Z'))).toBe(true);
  });

  test('regla jueves→viernes desactivada: ese viernes NO es feriado', async () => {
    configurar(FERIADOS_BASE, { trasladoJuevesAViernes: false, trasladoDomingoALunes: true });
    expect(await esFeriado(d('2026-09-25T12:00:00Z'))).toBe(false);
  });

  test('regla domingo→lunes activada: el lunes siguiente a un feriado en domingo es feriado', async () => {
    configurar(FERIADOS_BASE, { trasladoJuevesAViernes: true, trasladoDomingoALunes: true });
    expect(await esFeriado(d('2026-11-02T12:00:00Z'))).toBe(true);
  });

  test('regla domingo→lunes desactivada: ese lunes NO es feriado', async () => {
    configurar(FERIADOS_BASE, { trasladoJuevesAViernes: true, trasladoDomingoALunes: false });
    expect(await esFeriado(d('2026-11-02T12:00:00Z'))).toBe(false);
  });

  test('el traslado jueves→viernes NO se aplica a otros días (el sábado siguiente no es feriado)', async () => {
    configurar();
    expect(await esFeriado(d('2026-09-26T12:00:00Z'))).toBe(false);
  });

  describe('zona horaria de Bolivia (UTC-4), independiente de la del servidor', () => {
    test('23:59 del 23-sep en Bolivia (03:59 UTC del 24) todavía NO es feriado', async () => {
      configurar();
      expect(await esFeriado(d('2026-09-24T03:59:00Z'))).toBe(false);
    });

    test('00:00 del 24-sep en Bolivia (04:00 UTC) ya es feriado', async () => {
      configurar();
      expect(await esFeriado(d('2026-09-24T04:00:00Z'))).toBe(true);
    });

    test('22:00 del 24-sep en Bolivia (02:00 UTC del 25) sigue siendo feriado base', async () => {
      configurar();
      expect(await esFeriado(d('2026-09-25T02:00:00Z'))).toBe(true);
    });
  });

  describe('cache en memoria', () => {
    test('consulta la BD una sola vez aunque se llame varias veces', async () => {
      configurar();
      await esFeriado(d('2026-09-23T12:00:00Z'));
      await esFeriado(d('2026-09-24T12:00:00Z'));
      await esFeriado(d('2026-09-25T12:00:00Z'));
      expect(prismaMock.feriado.findMany).toHaveBeenCalledTimes(1);
      expect(prismaMock.configuracionFeriados.findFirst).toHaveBeenCalledTimes(1);
    });

    test('limpiarCacheFeriados() fuerza a releer la BD (refleja feriados nuevos)', async () => {
      configurar([]);
      expect(await esFeriado(d('2026-10-07T12:00:00Z'))).toBe(false);

      configurar(['2026-10-07']);
      expect(await esFeriado(d('2026-10-07T12:00:00Z'))).toBe(false); // sigue con el cache viejo

      limpiarCacheFeriados();
      expect(await esFeriado(d('2026-10-07T12:00:00Z'))).toBe(true);
      expect(prismaMock.feriado.findMany).toHaveBeenCalledTimes(2);
    });
  });

  test('si no existe configuración, la crea con los valores por defecto', async () => {
    prismaMock.feriado.findMany.mockResolvedValue([]);
    prismaMock.configuracionFeriados.findFirst.mockResolvedValue(null);
    prismaMock.configuracionFeriados.create.mockResolvedValue({
      id: 'cfg-nueva', trasladoJuevesAViernes: true, trasladoDomingoALunes: true,
    });

    await esFeriado(d('2026-09-23T12:00:00Z'));

    expect(prismaMock.configuracionFeriados.create).toHaveBeenCalledWith({ data: {} });
  });
});

describe('esDiaHabil', () => {
  test('lunes a viernes normales son hábiles', async () => {
    configurar();
    expect(await esDiaHabil(d('2026-09-23T12:00:00Z'))).toBe(true); // miércoles
    expect(await esDiaHabil(d('2026-10-02T12:00:00Z'))).toBe(true); // viernes
  });

  test('sábado y domingo NO son hábiles', async () => {
    configurar();
    expect(await esDiaHabil(d('2026-09-26T12:00:00Z'))).toBe(false); // sábado
    expect(await esDiaHabil(d('2026-09-27T12:00:00Z'))).toBe(false); // domingo
  });

  test('un feriado entre semana NO es hábil', async () => {
    configurar();
    expect(await esDiaHabil(d('2026-09-24T12:00:00Z'))).toBe(false);
  });

  test('el viernes trasladado NO es hábil; con la regla apagada sí lo es', async () => {
    configurar(FERIADOS_BASE, { trasladoJuevesAViernes: true, trasladoDomingoALunes: true });
    expect(await esDiaHabil(d('2026-09-25T12:00:00Z'))).toBe(false);

    limpiarCacheFeriados();
    configurar(FERIADOS_BASE, { trasladoJuevesAViernes: false, trasladoDomingoALunes: true });
    expect(await esDiaHabil(d('2026-09-25T12:00:00Z'))).toBe(true);
  });

  describe('el día de la semana se toma en hora de Bolivia, no en UTC', () => {
    test('viernes 22:00 Bolivia (sábado 02:00 UTC) sigue siendo hábil', async () => {
      configurar();
      expect(await esDiaHabil(d('2026-10-03T02:00:00Z'))).toBe(true);
    });

    test('domingo 22:00 Bolivia (lunes 02:00 UTC) NO es hábil', async () => {
      configurar();
      expect(await esDiaHabil(d('2026-10-05T02:00:00Z'))).toBe(false);
    });
  });
});

describe('sumarDiasHabiles', () => {
  test('suma días saltando fines de semana', async () => {
    configurar([]);
    // Viernes 02-oct + 1 hábil = lunes 05-oct
    const r = await sumarDiasHabiles(d('2026-10-02T12:00:00Z'), 1);
    expect(r.toISOString()).toBe('2026-10-05T12:00:00.000Z');
  });

  test('suma 5 días hábiles = una semana calendario completa', async () => {
    configurar([]);
    const r = await sumarDiasHabiles(d('2026-10-05T12:00:00Z'), 5); // lunes → lunes
    expect(r.toISOString()).toBe('2026-10-12T12:00:00.000Z');
  });

  test('salta feriados y sus traslados: mié 23-sep +1 hábil cae el lunes 28-sep', async () => {
    configurar(); // jue 24 feriado, vie 25 trasladado, sáb 26, dom 27
    const r = await sumarDiasHabiles(d('2026-09-23T12:00:00Z'), 1);
    expect(r.toISOString()).toBe('2026-09-28T12:00:00.000Z');
  });

  test('con la regla jueves→viernes apagada, el mismo cálculo cae el viernes 25-sep', async () => {
    configurar(FERIADOS_BASE, { trasladoJuevesAViernes: false, trasladoDomingoALunes: true });
    const r = await sumarDiasHabiles(d('2026-09-23T12:00:00Z'), 1);
    expect(r.toISOString()).toBe('2026-09-25T12:00:00.000Z');
  });

  test('plazo por defecto del sistema (3 días hábiles) cruzando el feriado', async () => {
    configurar();
    // mié 23 → +1 = lun 28, +2 = mar 29, +3 = mié 30
    const r = await sumarDiasHabiles(d('2026-09-23T12:00:00Z'), 3);
    expect(r.toISOString()).toBe('2026-09-30T12:00:00.000Z');
  });

  test('0 días devuelve la misma fecha (sin contar el día de inicio)', async () => {
    configurar();
    const r = await sumarDiasHabiles(d('2026-09-23T12:00:00Z'), 0);
    expect(r.toISOString()).toBe('2026-09-23T12:00:00.000Z');
  });

  test('no muta la fecha original recibida', async () => {
    configurar();
    const inicio = d('2026-09-23T12:00:00Z');
    await sumarDiasHabiles(inicio, 5);
    expect(inicio.toISOString()).toBe('2026-09-23T12:00:00.000Z');
  });

  test('si el día de inicio es fin de semana, cuenta desde el siguiente hábil', async () => {
    configurar([]);
    // Sábado 03-oct + 1 hábil = lunes 05-oct
    const r = await sumarDiasHabiles(d('2026-10-03T12:00:00Z'), 1);
    expect(r.toISOString()).toBe('2026-10-05T12:00:00.000Z');
  });
});

describe('sumarDiasCorridos', () => {
  test('suma días de calendario sin saltar nada (fines de semana incluidos)', () => {
    expect(sumarDiasCorridos(d('2026-09-23T12:00:00Z'), 10).toISOString()).toBe('2026-10-03T12:00:00.000Z');
  });

  test('cruza fin de mes y de año correctamente', () => {
    expect(sumarDiasCorridos(d('2026-01-31T12:00:00Z'), 1).toISOString()).toBe('2026-02-01T12:00:00.000Z');
    expect(sumarDiasCorridos(d('2026-12-31T12:00:00Z'), 1).toISOString()).toBe('2027-01-01T12:00:00.000Z');
  });

  test('respeta años bisiestos', () => {
    expect(sumarDiasCorridos(d('2028-02-28T12:00:00Z'), 1).toISOString()).toBe('2028-02-29T12:00:00.000Z'); // bisiesto
    expect(sumarDiasCorridos(d('2027-02-28T12:00:00Z'), 1).toISOString()).toBe('2027-03-01T12:00:00.000Z'); // no bisiesto
  });

  test('0 días devuelve la misma fecha; días negativos restan', () => {
    expect(sumarDiasCorridos(d('2026-09-23T12:00:00Z'), 0).toISOString()).toBe('2026-09-23T12:00:00.000Z');
    expect(sumarDiasCorridos(d('2026-09-23T12:00:00Z'), -3).toISOString()).toBe('2026-09-20T12:00:00.000Z');
  });

  test('no muta la fecha original y devuelve una instancia nueva', () => {
    const inicio = d('2026-09-23T12:00:00Z');
    const r = sumarDiasCorridos(inicio, 5);
    expect(inicio.toISOString()).toBe('2026-09-23T12:00:00.000Z');
    expect(r).not.toBe(inicio);
  });

  test('no consulta la base de datos (función pura)', () => {
    sumarDiasCorridos(d('2026-09-23T12:00:00Z'), 5);
    expect(prismaMock.feriado.findMany).not.toHaveBeenCalled();
  });
});
