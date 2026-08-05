import { decryptIfDefined } from '../config/encryption';
import * as usersRepository from '../modules/users/users.repository';

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

export const NUREJ_REGEX = /^\d+(-\d+)?$/;

export function normalizeNurej(numero: string): string {
  return numero.replace(/\s+/g, '');
}

export function isValidNurej(numero: string): boolean {
  return NUREJ_REGEX.test(normalizeNurej(numero));
}

export async function isPhoneInUse(telefono: string, excludeId?: string): Promise<boolean> {
  const users = await usersRepository.findAllWithEncryptedFields();
  const normalized = telefono.replace(/\s+/g, '');
  return users.some(u => {
    if (excludeId && u.id === excludeId) return false;
    if (!u.telefono) return false;
    return decryptIfDefined(u.telefono)?.replace(/\s+/g, '') === normalized;
  });
}

export async function isDniInUse(dni: string, excludeId?: string): Promise<boolean> {
  const users = await usersRepository.findAllWithDni();
  const normalized = dni.replace(/[\s.\-]/g, '').toLowerCase();
  return users.some(u => {
    if (excludeId && u.id === excludeId) return false;
    if (!u.dni) return false;
    return decryptIfDefined(u.dni)?.replace(/[\s.\-]/g, '').toLowerCase() === normalized;
  });
}

