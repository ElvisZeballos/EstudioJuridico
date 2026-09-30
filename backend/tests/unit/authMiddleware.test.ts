import jwt from 'jsonwebtoken';
import type { Response } from 'express';
import { authenticateToken, requireRole, AuthRequest } from '../../src/middleware/auth';

function fakeRes() {
  const res = { status: jest.fn(), json: jest.fn() } as unknown as Response & { status: jest.Mock; json: jest.Mock };
  res.status.mockReturnValue(res);
  return res;
}

const reqCon = (authorization?: string): AuthRequest =>
  ({ headers: authorization ? { authorization } : {} } as unknown as AuthRequest);

describe('authenticateToken', () => {
  test('sin header Authorization → 401', () => {
    const res = fakeRes();
    const next = jest.fn();
    authenticateToken(reqCon(), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('token válido → llama a next() y deja req.user con id, email y rol', () => {
    const token = jwt.sign({ id: 'u1', email: 'a@b.com', role: 'ABOGADO' }, process.env.JWT_SECRET!);
    const req = reqCon(`Bearer ${token}`);
    const res = fakeRes();
    const next = jest.fn();
    authenticateToken(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ id: 'u1', email: 'a@b.com', role: 'ABOGADO' });
  });

  test('token firmado con otra clave → 403', () => {
    const token = jwt.sign({ id: 'u1', email: 'a@b.com', role: 'ADMIN' }, 'otra-clave');
    const res = fakeRes();
    const next = jest.fn();
    authenticateToken(reqCon(`Bearer ${token}`), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('token expirado → 403', () => {
    const token = jwt.sign({ id: 'u1', email: 'a@b.com', role: 'ADMIN' }, process.env.JWT_SECRET!, { expiresIn: -10 });
    const res = fakeRes();
    authenticateToken(reqCon(`Bearer ${token}`), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('token malformado → 403', () => {
    const res = fakeRes();
    authenticateToken(reqCon('Bearer esto.no.es.un.jwt'), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('sin JWT_SECRET configurado → 500 (falla segura, no deja pasar)', () => {
    const secret = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    try {
      const res = fakeRes();
      const next = jest.fn();
      authenticateToken(reqCon('Bearer cualquiera'), res, next);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(next).not.toHaveBeenCalled();
    } finally {
      process.env.JWT_SECRET = secret;
    }
  });
});

describe('requireRole', () => {
  const reqRol = (role?: string) => ({ user: role ? { id: 'u', email: 'e', role } : undefined } as unknown as AuthRequest);

  test('rol permitido → next()', () => {
    const next = jest.fn();
    requireRole('ABOGADO', 'AUXILIAR')(reqRol('AUXILIAR'), fakeRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('rol no permitido → 403', () => {
    const res = fakeRes();
    const next = jest.fn();
    requireRole('ABOGADO')(reqRol('CLIENTE'), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('sin usuario autenticado → 401', () => {
    const res = fakeRes();
    requireRole('ABOGADO')(reqRol(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
