import { decryptIfDefined } from '../config/encryption';
import * as usersRepository from '../modules/users/users.repository';

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

export function isValidUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export const NUREJ_REGEX = /^\d+(-\d+)?$/;

export function normalizeNurej(numero: string): string {
  return numero.replace(/\s+/g, '');
}

export function isValidNurej(numero: string): boolean {
  return NUREJ_REGEX.test(normalizeNurej(numero));
}

function calcularEdad(fechaNacimiento: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(fechaNacimiento.trim());
  if (!match) return null;
  const [, anio, mes, dia] = match.map(Number);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  // Fecha de hoy en Bolivia (YYYY-MM-DD), sin depender del huso del servidor
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });
  const [hoyAnio, hoyMes, hoyDia] = hoy.split('-').map(Number);
  let edad = hoyAnio - anio;
  if (hoyMes < mes || (hoyMes === mes && hoyDia < dia)) edad--;
  return edad;
}

export function validarEdadMinima(fechaNacimiento: string, edadMinima: number, rol: string): string | null {
  const edad = calcularEdad(fechaNacimiento);
  if (edad === null) return 'Fecha de nacimiento inválida';
  if (edad < 0) return 'La fecha de nacimiento no puede ser una fecha futura';
  if (edad < edadMinima) return `No se pueden registrar datos de un ${rol} menor de ${edadMinima} años.`;
  return null;
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

