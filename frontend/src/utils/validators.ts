export function isValidUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}
// Debe coincidir con PASSWORD_REGEX del backend
// (backend/src/modules/auth/auth.service.ts y backend/src/modules/users/users.service.ts)
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export const PASSWORD_REQUIREMENTS_MESSAGE =
  'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.';

export function isValidPassword(value: string): boolean {
  return PASSWORD_REGEX.test(value);
}