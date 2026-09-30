import request from 'supertest';
import { loadApp, bearer } from '../helpers/app';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';

jest.mock('../../src/shared/prisma', () => ({
  __esModule: true,
  default: require('../helpers/prismaMock').prismaMock,
}));

// Pruebas de aislamiento entre usuarios: un usuario NO debe poder leer datos
// de un caso que no le corresponde, aunque conozca su id.

const app = loadApp();

// Caso que pertenece al abogado "ab-dueno" y al cliente "cl-dueno".
const CASO = {
  id: 'caso-ajeno', active: true, estado: 'ACTIVO', fechaCierre: null, titulo: 'Caso de otro estudio',
  abogados: [{ abogadoId: 'ab-dueno' }],
  clientes: [{ clienteId: 'cl-dueno' }],
};
const HISTORIAL = [{ id: 'h-1', campo: 'estado', valorAntes: 'ACTIVO', valorDespues: 'PENDIENTE', usuario: { id: 'ab-dueno' } }];
const NOVEDADES = [{ id: 'n-1', titulo: 'Novedad', contenido: 'Contenido confidencial' }];

beforeEach(() => {
  resetPrismaMock();
  prismaMock.caso.findUnique.mockResolvedValue(CASO);
  prismaMock.casoHistorial.findMany.mockResolvedValue(HISTORIAL);
  prismaMock.casoNovedad.findMany.mockResolvedValue(NOVEDADES);
  prismaMock.client.findFirst.mockResolvedValue({ id: 'cl-otro' }); // el cliente que consulta NO es el del caso
  prismaMock.abogadoAuxiliar.findMany.mockResolvedValue([{ abogadoId: 'ab-otro' }]); // el auxiliar NO trabaja con el dueño
});

describe('GET /api/casos/:id/historial', () => {
  const url = '/api/casos/caso-ajeno/historial';

  test('sin token → 401', async () => {
    expect((await request(app).get(url)).status).toBe(401);
  });

  test('ABOGADO asignado al caso → 200', async () => {
    const res = await request(app).get(url).set('Authorization', bearer('ABOGADO', 'ab-dueno'));
    expect(res.status).toBe(200);
  });

  test('ABOGADO NO asignado al caso → 403', async () => {
    const res = await request(app).get(url).set('Authorization', bearer('ABOGADO', 'ab-otro'));
    expect(res.status).toBe(403);
  });

  test('HALLAZGO: CLIENTE que no figura en el caso debería recibir 403, pero recibe el historial completo', async () => {
    const res = await request(app).get(url).set('Authorization', bearer('CLIENTE', 'user-cli-otro'));
    expect(res.status).toBe(403);
  });

  test('HALLAZGO: AUXILIAR que no trabaja con el abogado del caso debería recibir 403, pero recibe el historial completo', async () => {
    const res = await request(app).get(url).set('Authorization', bearer('AUXILIAR', 'aux-1'));
    expect(res.status).toBe(403);
  });
});

describe('GET /api/casos/:casoId/novedades', () => {
  const url = '/api/casos/caso-ajeno/novedades';

  test('sin token → 401', async () => {
    expect((await request(app).get(url)).status).toBe(401);
  });

  test('ABOGADO asignado → 200; ABOGADO ajeno → 404', async () => {
    expect((await request(app).get(url).set('Authorization', bearer('ABOGADO', 'ab-dueno'))).status).toBe(200);
    expect((await request(app).get(url).set('Authorization', bearer('ABOGADO', 'ab-otro'))).status).toBe(404);
  });

  test('CLIENTE que no figura en el caso → 404 (correctamente bloqueado)', async () => {
    const res = await request(app).get(url).set('Authorization', bearer('CLIENTE', 'user-cli-otro'));
    expect(res.status).toBe(404);
  });

  test('HALLAZGO: AUXILIAR que no trabaja con el abogado del caso debería ser bloqueado, pero recibe las novedades', async () => {
    const res = await request(app).get(url).set('Authorization', bearer('AUXILIAR', 'aux-1'));
    expect([403, 404]).toContain(res.status);
  });
});
