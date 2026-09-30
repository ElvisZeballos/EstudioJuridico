import { encrypt, decrypt, encryptIfDefined, decryptIfDefined } from '../../src/config/encryption';

describe('encryption (AES-256-CBC)', () => {
  test('cifrar y descifrar devuelve el texto original', () => {
    const original = '+591 71234567';
    expect(decrypt(encrypt(original))).toBe(original);
  });

  test('soporta caracteres especiales y acentos', () => {
    const original = 'Calle Jordán N° 123, Cochabamba — ñandú';
    expect(decrypt(encrypt(original))).toBe(original);
  });

  test('el resultado cifrado no contiene el texto original y tiene formato iv:datos', () => {
    const cifrado = encrypt('5215255');
    expect(cifrado).not.toContain('5215255');
    expect(cifrado).toMatch(/^[0-9a-f]{32}:[0-9a-f]+$/);
  });

  test('cifrar dos veces el mismo texto da resultados distintos (IV aleatorio)', () => {
    expect(encrypt('igual')).not.toBe(encrypt('igual'));
  });

  test('descifrar un texto que no está cifrado lo devuelve tal cual (datos legados)', () => {
    expect(decrypt('texto plano sin formato')).toBe('texto plano sin formato');
  });

  test('descifrar datos corruptos con formato iv:datos devuelve el original en vez de lanzar error', () => {
    expect(decrypt('zzzz:yyyy')).toBe('zzzz:yyyy');
  });

  test('cadena vacía se devuelve sin cifrar', () => {
    expect(encrypt('')).toBe('');
    expect(decrypt('')).toBe('');
  });

  test('encryptIfDefined / decryptIfDefined manejan null, undefined y vacío', () => {
    expect(encryptIfDefined(null)).toBeNull();
    expect(encryptIfDefined(undefined)).toBeNull();
    expect(encryptIfDefined('')).toBeNull();
    expect(decryptIfDefined(null)).toBeNull();
    expect(decryptIfDefined(undefined)).toBeNull();
    expect(decryptIfDefined('')).toBeNull();
    expect(decryptIfDefined(encryptIfDefined('dato'))).toBe('dato');
  });

  test('sin ENCRYPTION_KEY definida, cifrar lanza error explícito', () => {
    const clave = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    try {
      expect(() => encrypt('algo')).toThrow('ENCRYPTION_KEY is not defined');
    } finally {
      process.env.ENCRYPTION_KEY = clave;
    }
  });
});
