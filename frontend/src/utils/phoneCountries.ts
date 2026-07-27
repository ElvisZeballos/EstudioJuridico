export interface PhoneCountry {
  code: string;   // ej. '+591'
  iso2: string;   // ej. 'BO'
  name: string;   // ej. 'Bolivia'
}

// Bolivia siempre primero — es el país por defecto
export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: '+591', iso2: 'BO', name: 'Bolivia' },
  { code: '+54', iso2: 'AR', name: 'Argentina' },
  { code: '+51', iso2: 'PE', name: 'Perú' },
  { code: '+55', iso2: 'BR', name: 'Brasil' },
  { code: '+56', iso2: 'CL', name: 'Chile' },
  { code: '+595', iso2: 'PY', name: 'Paraguay' },
  { code: '+57', iso2: 'CO', name: 'Colombia' },
  { code: '+593', iso2: 'EC', name: 'Ecuador' },
  { code: '+58', iso2: 'VE', name: 'Venezuela' },
  { code: '+34', iso2: 'ES', name: 'España' },
  { code: '+1', iso2: 'US', name: 'Estados Unidos' },
];

export const DEFAULT_PHONE_COUNTRY = PHONE_COUNTRIES[0]; // Bolivia
export const OTHER_COUNTRY_VALUE = '__OTRO__';

/**
 * Separa un teléfono guardado (ej. "+54 11 4000-0004") en prefijo + número local,
 * para precargar el formulario de edición. Si el prefijo no está en la lista pero
 * el número sí tenía un "+", se cae en "Otro" con el código original. Si no tenía
 * "+" para nada, se asume un número local boliviano sin prefijo.
 */
export function splitPhone(fullPhone: string | null | undefined): { code: string; local: string; isOther: boolean } {
  if (!fullPhone) return { code: DEFAULT_PHONE_COUNTRY.code, local: '', isOther: false };
  const trimmed = fullPhone.trim();
  const byLongestCode = [...PHONE_COUNTRIES].sort((a, b) => b.code.length - a.code.length);
  for (const c of byLongestCode) {
    if (trimmed.startsWith(c.code)) {
      return { code: c.code, local: trimmed.slice(c.code.length).trim(), isOther: false };
    }
  }
  if (trimmed.startsWith('+')) {
    const match = trimmed.match(/^\+\d{1,4}/);
    const code = match ? match[0] : '+';
    return { code, local: trimmed.slice(code.length).trim(), isOther: true };
  }
  return { code: DEFAULT_PHONE_COUNTRY.code, local: trimmed, isOther: false };
}

/** Combina prefijo + número local en el string final que se guarda en la base. */
export function joinPhone(code: string, local: string): string {
  const cleanLocal = local.trim();
  const cleanCode = code.trim();
  return cleanLocal ? `${cleanCode} ${cleanLocal}` : '';
}

/** Filtra cualquier carácter que no sea dígito o guion — para el campo de número local. */
export function sanitizePhoneLocal(value: string): string {
  return value.replace(/[^0-9-]/g, '');
}

/** Filtra cualquier carácter que no sea "+" o dígito — para el código de país manual ("Otro"). */
export function sanitizeCustomCode(value: string): string {
  const cleaned = value.replace(/[^0-9+]/g, '');
  return cleaned.replace(/(?!^)\+/g, '');
}

/** True si el valor solo contiene dígitos y guiones (vacío también es válido — el campo es opcional). */
export function isValidPhoneLocal(value: string): boolean {
  return /^[0-9-]*$/.test(value);
}