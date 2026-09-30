import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { loadApp, bearer } from '../helpers/app';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import { encrypt } from '../../src/config/encryption';

jest.mock('../../src/shared/prisma', () => ({
  __esModule: true,
  default: require('../helpers/prismaMock').prismaMock,
}));

const app = loadApp();
const { sendEmail } = jest.requireMock('../../src/infrastructure/email');

// OJO: /api/auth/login tiene un limitador de 10 intentos por IP cada 15 min.
// Este archivo hace 7 llamadas a /login a propósito, para no activarlo;
// el comportamiento del límite se prueba aparte en auth.ratelimit.test.ts.

const PASSWORD = 'Secreta123';
let hash: string;

beforeAll(async () => {
  hash = await bcrypt.hash(PASSWORD, 4);
});

beforeEach(() => {
  resetPrismaMock();
  sendEmail.mockClear();
});

const usuario = (over: Record<string, unknown> = {}) => ({
  id: 'u-1',
  email: 'abogado@estudio.com',
  password: hash,
  role: 'ABOGADO',
  nombre: 'Ana',
  apellido: 'Soto',
  photoPath: null,
  dni: encrypt('5215255'),
  telefono: encrypt('+591 71234567'),
  direccion: null,
  fechaNacimiento: null,
  active: true,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...over,
});

describe('POST /api/auth/login', () => {
  test('credenciales válidas → 200 con token JWT y datos del usuario', async () => {
    prismaMock.user.findUnique.mockResolvedValue(usuario());

    const res = await request(app).post('/api/auth/login').send({ email: 'abogado@estudio.com', password: PASSWORD });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toMatchObject({ id: 'u-1', email: 'abogado@estudio.com', role: 'ABOGADO', nombre: 'Ana' });
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: 'abogado@estudio.com' } });
  });

  test('el token emitido es válido, lleva id/email/rol y vence en 2 horas', async () => {
    prismaMock.user.findUnique.mockResolvedValue(usuario({ role: 'ADMIN' }));

    const res = await request(app).post('/api/auth/login').send({ email: 'abogado@estudio.com', password: PASSWORD });
    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET!) as jwt.JwtPayload;

    expect(decoded).toMatchObject({ id: 'u-1', email: 'abogado@estudio.com', role: 'ADMIN' });
    expect(decoded.exp! - decoded.iat!).toBe(2 * 60 * 60);
  });

  test('la respuesta NO expone el hash de la contraseña y descifra los datos sensibles', async () => {
    prismaMock.user.findUnique.mockResolvedValue(usuario());

    const res = await request(app).post('/api/auth/login').send({ email: 'abogado@estudio.com', password: PASSWORD });

    expect(res.body.user).not.toHaveProperty('password');
    expect(JSON.stringify(res.body)).not.toContain(hash);
    expect(res.body.user.dni).toBe('5215255');
    expect(res.body.user.telefono).toBe('+591 71234567');
  });

  test('contraseña incorrecta → 401 "Invalid credentials" y no entrega token', async () => {
    prismaMock.user.findUnique.mockResolvedValue(usuario());

    const res = await request(app).post('/api/auth/login').send({ email: 'abogado@estudio.com', password: 'Incorrecta1' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid credentials' });
    expect(res.body.token).toBeUndefined();
  });

  test('email no registrado → 401 con el MISMO mensaje que contraseña incorrecta (no revela qué correos existen)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const res = await request(app).post('/api/auth/login').send({ email: 'nadie@estudio.com', password: PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid credentials' });
  });

  test('cuenta desactivada → 401 aunque la contraseña sea correcta', async () => {
    prismaMock.user.findUnique.mockResolvedValue(usuario({ active: false }));

    const res = await request(app).post('/api/auth/login').send({ email: 'abogado@estudio.com', password: PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
  });

  test('faltan campos → 400 sin consultar la base de datos', async () => {
    const sinEmail = await request(app).post('/api/auth/login').send({ password: PASSWORD });
    const sinPassword = await request(app).post('/api/auth/login').send({ email: 'abogado@estudio.com' });

    expect(sinEmail.status).toBe(400);
    expect(sinPassword.status).toBe(400);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  test('error interno de la base de datos → 500 genérico, sin filtrar detalles', async () => {
    prismaMock.user.findUnique.mockRejectedValue(new Error('connection refused a 10.0.0.5'));

    const res = await request(app).post('/api/auth/login').send({ email: 'abogado@estudio.com', password: PASSWORD });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
    expect(JSON.stringify(res.body)).not.toContain('10.0.0.5');
  });
});

describe('GET /api/auth/me', () => {
  test('sin token → 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('token inválido → 403', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer token.falso.xyz');
    expect(res.status).toBe(403);
  });

  test('token válido → 200 con el perfil (sin contraseña)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(usuario());

    const res = await request(app).get('/api/auth/me').set('Authorization', bearer('ABOGADO', 'u-1'));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 'u-1', email: 'abogado@estudio.com' });
    expect(res.body).not.toHaveProperty('password');
  });

  test('token válido de un usuario que ya no existe → 404', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = await request(app).get('/api/auth/me').set('Authorization', bearer('ABOGADO', 'fantasma'));
    expect(res.status).toBe(404);
  });
});

describe('POST /api/auth/refresh', () => {
  test('sin token → 401', async () => {
    expect((await request(app).post('/api/auth/refresh')).status).toBe(401);
  });

  test('usuario activo → 200 con token nuevo', async () => {
    prismaMock.user.findUnique.mockResolvedValue(usuario());
    const res = await request(app).post('/api/auth/refresh').set('Authorization', bearer('ABOGADO', 'u-1'));
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
  });

  test('usuario desactivado después de emitir el token → 401 (no se puede renovar)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(usuario({ active: false }));
    const res = await request(app).post('/api/auth/refresh').set('Authorization', bearer('ABOGADO', 'u-1'));
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/forgot-password', () => {
  test('sin email → 400', async () => {
    expect((await request(app).post('/api/auth/forgot-password').send({})).status).toBe(400);
  });

  test('email inexistente → 200 con mensaje genérico y NO envía correo (no revela si existe)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nadie@estudio.com' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/Si el correo está registrado/);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('email existente → mismo 200 genérico, crea token de un solo uso y envía el correo', async () => {
    prismaMock.user.findUnique.mockResolvedValue(usuario());
    prismaMock.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.passwordResetToken.create.mockResolvedValue({});

    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'abogado@estudio.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/Si el correo está registrado/);
    expect(prismaMock.passwordResetToken.create).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/auth/reset-password', () => {
  const tokenValido = () => ({
    id: 'rt-1', userId: 'u-1', used: false, expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });

  test('sin token o sin contraseña → 400', async () => {
    expect((await request(app).post('/api/auth/reset-password').send({ token: 'x' })).status).toBe(400);
    expect((await request(app).post('/api/auth/reset-password').send({ password: 'Nueva1234' })).status).toBe(400);
  });

  test.each(['corta1A', 'todominuscula1', 'TODOMAYUSCULA1', 'SinNumeroAqui'])(
    'contraseña débil %p → 400 y no toca la BD',
    async (password) => {
      const res = await request(app).post('/api/auth/reset-password').send({ token: 't', password });
      expect(res.status).toBe(400);
      expect(prismaMock.passwordResetToken.findUnique).not.toHaveBeenCalled();
    }
  );

  test('token inexistente → 400', async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue(null);
    const res = await request(app).post('/api/auth/reset-password').send({ token: 'x', password: 'Nueva1234' });
    expect(res.status).toBe(400);
  });

  test('token ya utilizado → 400', async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({ ...tokenValido(), used: true });
    const res = await request(app).post('/api/auth/reset-password').send({ token: 'x', password: 'Nueva1234' });
    expect(res.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  test('token expirado → 400', async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({ ...tokenValido(), expiresAt: new Date(Date.now() - 1000) });
    const res = await request(app).post('/api/auth/reset-password').send({ token: 'x', password: 'Nueva1234' });
    expect(res.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  test('token válido → 200, guarda la contraseña HASHEADA (nunca en claro) y marca el token como usado', async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue(tokenValido());
    prismaMock.client.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.user.update.mockResolvedValue({});
    prismaMock.passwordResetToken.update.mockResolvedValue({});

    const res = await request(app).post('/api/auth/reset-password').send({ token: 'x', password: 'Nueva1234' });

    expect(res.status).toBe(200);
    const guardado = prismaMock.user.update.mock.calls[0][0].data.password as string;
    expect(guardado).not.toBe('Nueva1234');
    expect(await bcrypt.compare('Nueva1234', guardado)).toBe(true);
    expect(prismaMock.passwordResetToken.update).toHaveBeenCalledWith({ where: { id: 'rt-1' }, data: { used: true } });
  });
});
