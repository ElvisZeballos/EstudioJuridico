import express from 'express';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';

/**
 * Carga la aplicación Express real (src/index.ts) SIN abrir un puerto.
 * index.ts llama a app.listen() al importarse; se neutraliza aquí (del lado
 * del test) para no dejar un servidor colgado ni arrancar el cron.
 * Debe llamarse una sola vez por archivo de test, antes de usar la app.
 */
export function loadApp(): Express {
  jest.spyOn(express.application, 'listen').mockImplementation(function (this: Express) {
    return this as never;
  });
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../src/index').default as Express;
}

export type TestRole = 'ADMIN' | 'ABOGADO' | 'CLIENTE' | 'AUXILIAR';

/** Genera un JWT válido firmado con el JWT_SECRET de pruebas. */
export function tokenFor(role: TestRole, id = `id-${role.toLowerCase()}`, expiresIn: string | number = '1h'): string {
  return jwt.sign({ id, email: `${role.toLowerCase()}@test.com`, role }, process.env.JWT_SECRET!, { expiresIn } as jwt.SignOptions);
}

export function bearer(role: TestRole, id?: string): string {
  return `Bearer ${tokenFor(role, id)}`;
}
