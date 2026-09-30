import request from 'supertest';
import { loadApp } from '../helpers/app';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';

jest.mock('../../src/shared/prisma', () => ({
  __esModule: true,
  default: require('../helpers/prismaMock').prismaMock,
}));

// Archivo aparte a propósito: el limitador de intentos vive en memoria del
// módulo, y cada archivo de test tiene su propio registro de módulos, así que
// aquí arranca en cero sin afectar a auth.test.ts.
const app = loadApp();

beforeEach(() => {
  resetPrismaMock();
  prismaMock.user.findUnique.mockResolvedValue(null); // cualquier intento falla con 401
});

describe('límite de intentos de login (fuerza bruta)', () => {
  test('permite 10 intentos fallidos y bloquea el 11° con 429 y mensaje claro', async () => {
    for (let i = 1; i <= 10; i++) {
      const res = await request(app).post('/api/auth/login').send({ email: 'x@x.com', password: 'Mala12345' });
      expect(res.status).toBe(401);
    }

    const bloqueado = await request(app).post('/api/auth/login').send({ email: 'x@x.com', password: 'Mala12345' });

    expect(bloqueado.status).toBe(429);
    expect(bloqueado.body.error).toMatch(/Demasiados intentos/);
  });

  test('una vez bloqueado, ni siquiera consulta la base de datos', async () => {
    prismaMock.user.findUnique.mockClear();
    const res = await request(app).post('/api/auth/login').send({ email: 'x@x.com', password: 'Mala12345' });
    expect(res.status).toBe(429);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  test('el bloqueo aplica solo a /login: otros endpoints siguen respondiendo', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });
});
