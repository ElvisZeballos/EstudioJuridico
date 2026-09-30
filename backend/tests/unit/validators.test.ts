import {
  isValidEmail,
  isValidUrl,
  normalizeNurej,
  isValidNurej,
  isPhoneInUse,
  isDniInUse,
} from '../../src/shared/validators';
import { encrypt } from '../../src/config/encryption';
import * as usersRepository from '../../src/modules/users/users.repository';

jest.mock('../../src/modules/users/users.repository', () => ({
  __esModule: true,
  findAllWithEncryptedFields: jest.fn(),
  findAllWithDni: jest.fn(),
}));

const repo = usersRepository as unknown as {
  findAllWithEncryptedFields: jest.Mock;
  findAllWithDni: jest.Mock;
};

describe('isValidEmail', () => {
  test.each(['abogado@estudio.com', 'a.b+c@sub.dominio.bo', '  user@test.com  '])('acepta %p', (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  test.each(['', 'sin-arroba.com', 'a@b', '@dominio.com', 'a b@c.com', 'a@@b.com'])('rechaza %p', (email) => {
    expect(isValidEmail(email)).toBe(false);
  });
});

describe('isValidUrl', () => {
  test('acepta http y https (sin distinguir mayúsculas)', () => {
    expect(isValidUrl('https://maps.google.com/?q=1')).toBe(true);
    expect(isValidUrl('HTTP://sitio.com')).toBe(true);
  });

  test('rechaza otros esquemas o texto suelto', () => {
    expect(isValidUrl('ftp://sitio.com')).toBe(false);
    expect(isValidUrl('javascript:alert(1)')).toBe(false);
    expect(isValidUrl('maps.google.com')).toBe(false);
    expect(isValidUrl('')).toBe(false);
  });
});

describe('NUREJ', () => {
  test('normalizeNurej elimina todo tipo de espacios', () => {
    expect(normalizeNurej('303 964 31-1')).toBe('30396431-1');
    expect(normalizeNurej(' 12345 ')).toBe('12345');
  });

  test.each(['30396431-1', '12345', '303 964 31-1'])('isValidNurej acepta %p', (n) => {
    expect(isValidNurej(n)).toBe(true);
  });

  test.each(['', 'abc', '123-', '-123', '123-45-6', '12a45', '123--4'])('isValidNurej rechaza %p', (n) => {
    expect(isValidNurej(n)).toBe(false);
  });
});

describe('isPhoneInUse (normalización de teléfonos)', () => {
  beforeEach(() => {
    repo.findAllWithEncryptedFields.mockReset();
  });

  const usuarios = () => [
    { id: 'u1', telefono: encrypt('+591 71234567') },
    { id: 'u2', telefono: null },
    { id: 'u3', telefono: encrypt('+591 60000000') },
  ];

  test('detecta el mismo número aunque cambien los espacios', async () => {
    repo.findAllWithEncryptedFields.mockResolvedValue(usuarios());
    expect(await isPhoneInUse('+59171234567')).toBe(true);
    expect(await isPhoneInUse('+591  712 34567')).toBe(true);
  });

  test('un número distinto no está en uso', async () => {
    repo.findAllWithEncryptedFields.mockResolvedValue(usuarios());
    expect(await isPhoneInUse('+591 79999999')).toBe(false);
  });

  test('excludeId ignora al propio usuario (edición de perfil)', async () => {
    repo.findAllWithEncryptedFields.mockResolvedValue(usuarios());
    expect(await isPhoneInUse('+59171234567', 'u1')).toBe(false);
    expect(await isPhoneInUse('+59171234567', 'otro')).toBe(true);
  });

  test('usuarios sin teléfono no generan falsos positivos', async () => {
    repo.findAllWithEncryptedFields.mockResolvedValue([{ id: 'u2', telefono: null }]);
    expect(await isPhoneInUse('+59171234567')).toBe(false);
  });

  test('sin usuarios registrados devuelve false', async () => {
    repo.findAllWithEncryptedFields.mockResolvedValue([]);
    expect(await isPhoneInUse('+59171234567')).toBe(false);
  });
});

describe('isDniInUse (normalización de documentos)', () => {
  beforeEach(() => {
    repo.findAllWithDni.mockReset();
  });

  test('ignora puntos, guiones, espacios y mayúsculas al comparar', async () => {
    repo.findAllWithDni.mockResolvedValue([{ id: 'u1', dni: encrypt('1234567-1A') }]);
    expect(await isDniInUse('1.234.567 1a')).toBe(true);
    expect(await isDniInUse('12345671A')).toBe(true);
  });

  test('un CI distinto no está en uso', async () => {
    repo.findAllWithDni.mockResolvedValue([{ id: 'u1', dni: encrypt('5215255') }]);
    expect(await isDniInUse('5215256')).toBe(false);
  });

  test('excludeId ignora al propio usuario', async () => {
    repo.findAllWithDni.mockResolvedValue([{ id: 'u1', dni: encrypt('5215255') }]);
    expect(await isDniInUse('5215255', 'u1')).toBe(false);
  });
});
