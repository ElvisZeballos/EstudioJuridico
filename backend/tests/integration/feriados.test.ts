import request from 'supertest';
import { loadApp, bearer, TestRole } from '../helpers/app';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';

jest.mock('../../src/shared/prisma', () => ({
  __esModule: true,
  default: require('../helpers/prismaMock').prismaMock,
}));

const app = loadApp();

const CONFIG = { id: 'cfg-1', trasladoJuevesAViernes: true, trasladoDomingoALunes: true };
const FERIADO = { id: 'f-1', fecha: new Date('2026-09-24T04:00:00.000Z'), nombre: 'Día de Cochabamba', ambito: 'departamental', origen: 'manual' };

beforeEach(() => {
  resetPrismaMock();
  prismaMock.feriado.findMany.mockResolvedValue([FERIADO]);
  prismaMock.feriado.findUnique.mockResolvedValue(FERIADO);
  prismaMock.feriado.findFirst.mockResolvedValue(null);
  prismaMock.feriado.create.mockImplementation(async ({ data }: { data: object }) => ({ id: 'f-nuevo', ...data }));
  prismaMock.feriado.delete.mockResolvedValue(FERIADO);
  prismaMock.configuracionFeriados.findFirst.mockResolvedValue(CONFIG);
  prismaMock.configuracionFeriados.update.mockImplementation(async ({ data }: { data: object }) => ({ ...CONFIG, ...data }));
});

const noTocaBD = () => {
  expect(prismaMock.feriado.findMany).not.toHaveBeenCalled();
  expect(prismaMock.feriado.create).not.toHaveBeenCalled();
  expect(prismaMock.feriado.delete).not.toHaveBeenCalled();
  expect(prismaMock.configuracionFeriados.update).not.toHaveBeenCalled();
};

describe('autenticación en /api/feriados', () => {
  test('sin token → 401 en todos los endpoints', async () => {
    const respuestas = await Promise.all([
      request(app).get('/api/feriados'),
      request(app).post('/api/feriados').send({}),
      request(app).delete('/api/feriados/f-1'),
      request(app).get('/api/feriados/configuracion'),
      request(app).put('/api/feriados/configuracion').send({}),
    ]);
    respuestas.forEach((r) => expect(r.status).toBe(401));
    noTocaBD();
  });

  test('token inválido → 403', async () => {
    const res = await request(app).get('/api/feriados').set('Authorization', 'Bearer basura');
    expect(res.status).toBe(403);
  });
});

describe('restricción por rol', () => {
  // Lectura: ABOGADO y AUXILIAR. Escritura: solo ABOGADO. ADMIN y CLIENTE no acceden.
  const lectura: [TestRole, number][] = [['ABOGADO', 200], ['AUXILIAR', 200], ['ADMIN', 403], ['CLIENTE', 403]];
  const escritura: [TestRole, number][] = [['ABOGADO', 200], ['AUXILIAR', 403], ['ADMIN', 403], ['CLIENTE', 403]];

  test.each(lectura)('GET /api/feriados como %s → %i', async (rol, esperado) => {
    const res = await request(app).get('/api/feriados').set('Authorization', bearer(rol));
    expect(res.status).toBe(esperado);
  });

  test.each(lectura)('GET /api/feriados/configuracion como %s → %i', async (rol, esperado) => {
    const res = await request(app).get('/api/feriados/configuracion').set('Authorization', bearer(rol));
    expect(res.status).toBe(esperado);
  });

  test.each([['ABOGADO', 201], ['AUXILIAR', 403], ['ADMIN', 403], ['CLIENTE', 403]] as [TestRole, number][])(
    'POST /api/feriados como %s → %i',
    async (rol, esperado) => {
      const res = await request(app).post('/api/feriados').set('Authorization', bearer(rol)).send({ fecha: '2026-11-02', nombre: 'Difuntos' });
      expect(res.status).toBe(esperado);
      if (esperado === 403) expect(prismaMock.feriado.create).not.toHaveBeenCalled();
    }
  );

  test.each(escritura)('DELETE /api/feriados/:id como %s → %i', async (rol, esperado) => {
    const res = await request(app).delete('/api/feriados/f-1').set('Authorization', bearer(rol));
    expect(res.status).toBe(esperado);
    if (esperado === 403) expect(prismaMock.feriado.delete).not.toHaveBeenCalled();
  });

  test.each(escritura)('PUT /api/feriados/configuracion como %s → %i', async (rol, esperado) => {
    const res = await request(app).put('/api/feriados/configuracion').set('Authorization', bearer(rol)).send({ trasladoDomingoALunes: false });
    expect(res.status).toBe(esperado);
    if (esperado === 403) expect(prismaMock.configuracionFeriados.update).not.toHaveBeenCalled();
  });
});

describe('comportamiento como ABOGADO', () => {
  const auth = () => bearer('ABOGADO');

  test('GET lista los feriados', async () => {
    const res = await request(app).get('/api/feriados').set('Authorization', auth());
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: 'f-1', nombre: 'Día de Cochabamba' });
  });

  test('POST crea el feriado anclado a medianoche de Bolivia (04:00 UTC) con origen "manual"', async () => {
    const res = await request(app).post('/api/feriados').set('Authorization', auth()).send({ fecha: '2026-11-02', nombre: 'Día de Difuntos', ambito: 'nacional' });

    expect(res.status).toBe(201);
    expect(prismaMock.feriado.create).toHaveBeenCalledWith({
      data: { fecha: new Date('2026-11-02T04:00:00.000Z'), nombre: 'Día de Difuntos', ambito: 'nacional', origen: 'manual' },
    });
  });

  test('POST con ámbito desconocido o ausente lo guarda como "nacional"', async () => {
    await request(app).post('/api/feriados').set('Authorization', auth()).send({ fecha: '2026-11-02', nombre: 'X', ambito: 'inventado' });
    expect(prismaMock.feriado.create.mock.calls[0][0].data.ambito).toBe('nacional');
  });

  test('POST con ámbito "departamental" lo respeta', async () => {
    await request(app).post('/api/feriados').set('Authorization', auth()).send({ fecha: '2026-09-24', nombre: 'Cochabamba', ambito: 'departamental' });
    expect(prismaMock.feriado.create.mock.calls[0][0].data.ambito).toBe('departamental');
  });

  test.each([
    [{ nombre: 'Sin fecha' }],
    [{ fecha: '2026-11-02' }],
    [{}],
  ])('POST con datos incompletos %j → 400', async (body) => {
    const res = await request(app).post('/api/feriados').set('Authorization', auth()).send(body);
    expect(res.status).toBe(400);
    expect(prismaMock.feriado.create).not.toHaveBeenCalled();
  });

  test.each(['24/09/2026', '2026-9-24', '2026-09-24T00:00:00Z', 'mañana'])('POST con fecha en formato inválido %p → 400', async (fecha) => {
    const res = await request(app).post('/api/feriados').set('Authorization', auth()).send({ fecha, nombre: 'X' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/AAAA-MM-DD/);
  });

  test('POST de una fecha que ya tiene feriado → 409', async () => {
    prismaMock.feriado.findFirst.mockResolvedValue(FERIADO);
    const res = await request(app).post('/api/feriados').set('Authorization', auth()).send({ fecha: '2026-09-24', nombre: 'Repetido' });
    expect(res.status).toBe(409);
    expect(prismaMock.feriado.create).not.toHaveBeenCalled();
  });

  test('DELETE de un feriado existente → 200 y lo elimina', async () => {
    const res = await request(app).delete('/api/feriados/f-1').set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(prismaMock.feriado.delete).toHaveBeenCalledWith({ where: { id: 'f-1' } });
  });

  test('DELETE de un feriado inexistente → 404', async () => {
    prismaMock.feriado.findUnique.mockResolvedValue(null);
    const res = await request(app).delete('/api/feriados/no-existe').set('Authorization', auth());
    expect(res.status).toBe(404);
    expect(prismaMock.feriado.delete).not.toHaveBeenCalled();
  });

  test('PUT /configuracion actualiza las reglas de traslado', async () => {
    const res = await request(app).put('/api/feriados/configuracion').set('Authorization', auth()).send({ trasladoJuevesAViernes: false });
    expect(res.status).toBe(200);
    expect(res.body.trasladoJuevesAViernes).toBe(false);
    expect(prismaMock.configuracionFeriados.update).toHaveBeenCalledWith({ where: { id: 'cfg-1' }, data: { trasladoJuevesAViernes: false } });
  });

  test('error de base de datos → 500 genérico', async () => {
    prismaMock.feriado.findMany.mockRejectedValue(new Error('db caída'));
    const res = await request(app).get('/api/feriados').set('Authorization', auth());
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });
});
