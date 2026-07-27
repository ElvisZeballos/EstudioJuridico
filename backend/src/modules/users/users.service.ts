import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';
import { encryptIfDefined, decryptIfDefined } from '../../config/encryption';
import { logger } from '../../config/logger';
import { sendEmail } from '../../infrastructure/email';
import * as usersRepository from './users.repository';

type ServiceError = { error: string; status: number };

export function decryptUser(user: {
  id: string; email: string; role: string; nombre: string; apellido: string;
  dni: string | null; telefono: string | null; direccion: string | null;
  fechaNacimiento: string | null; photoPath: string | null;
  active: boolean; createdAt: Date; updatedAt: Date;
}) {
  return {
    ...user,
    dni: decryptIfDefined(user.dni),
    telefono: decryptIfDefined(user.telefono),
    direccion: decryptIfDefined(user.direccion),
    fechaNacimiento: decryptIfDefined(user.fechaNacimiento),
  };
}

async function isPhoneInUse(telefono: string, excludeId?: string): Promise<boolean> {
  const users = await usersRepository.findAllWithEncryptedFields();
  const normalized = telefono.replace(/\s+/g, '');
  return users.some(u => {
    if (excludeId && u.id === excludeId) return false;
    if (!u.telefono) return false;
    return decryptIfDefined(u.telefono)?.replace(/\s+/g, '') === normalized;
  });
}

async function isDniInUse(dni: string, excludeId?: string): Promise<boolean> {
  const users = await usersRepository.findAllWithDni();
  const normalized = dni.replace(/[\s.\-]/g, '').toLowerCase();
  return users.some(u => {
    if (excludeId && u.id === excludeId) return false;
    if (!u.dni) return false;
    return decryptIfDefined(u.dni)?.replace(/[\s.\-]/g, '').toLowerCase() === normalized;
  });
}

export async function getAll() {
  return usersRepository.findAll();
}

export async function getById(id: string, requesterId: string) {
  if (requesterId !== id) {
    return { error: 'Access denied', status: 403 as const };
  }
  const user = await usersRepository.findById(id);
  if (!user) return { error: 'User not found', status: 404 as const };
  return { user: decryptUser(user) };
}

export async function getAbogados() {
  return usersRepository.findAllAbogados();
}

export async function create(data: {
  email: string; password: string; nombre: string; apellido: string;
  role?: string; dni?: string; telefono?: string; direccion?: string; fechaNacimiento?: string;
}, actorLog: object) {
  const { email, password, nombre, apellido, role, dni, telefono, direccion, fechaNacimiento } = data;

  if (!email || !password || !nombre || !apellido) {
    return { error: 'Email, password, nombre and apellido are required', status: 400 as const };
  }

  const existing = await usersRepository.findByEmail(email);
  if (existing) {
    logger.warn('USUARIOS: intento de crear usuario con email ya registrado', { ...actorLog, emailDuplicado: email });
    return { error: 'El correo electrónico ya está en uso.', status: 409 as const };
  }

  if (telefono && await isPhoneInUse(telefono)) {
    return { error: 'El número de teléfono ya está en uso.', status: 409 as const };
  }
  if (dni && await isDniInUse(dni)) {
    return { error: 'La cédula de identidad ya está en uso.', status: 409 as const };
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await usersRepository.create({
    email, password: hashedPassword, nombre, apellido,
    role: (role || 'CLIENTE') as 'ADMIN' | 'ABOGADO' | 'CLIENTE' | 'AUXILIAR',
    dni: encryptIfDefined(dni),
    telefono: encryptIfDefined(telefono),
    direccion: encryptIfDefined(direccion),
    fechaNacimiento: encryptIfDefined(fechaNacimiento),
  });

  logger.info('USUARIOS: usuario creado', { ...actorLog, nuevoUsuarioId: user.id, nuevoUsuarioEmail: user.email });
  return { user: decryptUser(user) };
}

export async function update(
  id: string,
  requesterId: string,
  requesterRole: string,
  body: Record<string, unknown>,
  actorLog: object
) {
  if (requesterId !== id && requesterRole !== 'ADMIN') {
    logger.warn('USUARIOS: intento de modificar usuario sin permiso', { ...actorLog, targetUserId: id });
    return { error: 'Access denied', status: 403 as const };
  }

  const existing = await usersRepository.findById(id);
  if (!existing) {
    return { error: 'User not found', status: 404 as const };
  }

  const { nombre, apellido, email, role, dni, telefono, direccion, fechaNacimiento, password, active } = body as Record<string, string | boolean | undefined>;

  if (telefono && typeof telefono === 'string' && await isPhoneInUse(telefono, id)) {
    return { error: 'El número de teléfono ya está en uso.', status: 409 as const };
  }
  if (dni && typeof dni === 'string' && await isDniInUse(dni, id)) {
    return { error: 'La cédula de identidad ya está en uso.', status: 409 as const };
  }

  const updateData: Record<string, unknown> = {
    ...(nombre !== undefined && { nombre }),
    ...(apellido !== undefined && { apellido }),
    ...(email !== undefined && { email }),
    ...(dni !== undefined && { dni: encryptIfDefined(dni as string) }),
    ...(telefono !== undefined && { telefono: encryptIfDefined(telefono as string) }),
    ...(direccion !== undefined && { direccion: encryptIfDefined(direccion as string) }),
    ...(fechaNacimiento !== undefined && { fechaNacimiento: encryptIfDefined(fechaNacimiento as string) }),
  };

  if (requesterRole === 'ADMIN') {
    if (role !== undefined) updateData.role = role;
    if (active !== undefined) updateData.active = active;
  }

  if (password && typeof password === 'string') {
    updateData.password = await bcrypt.hash(password, 12);
  }

  try {
    const updated = await usersRepository.update(id, updateData);
    const camposModificados = Object.keys(updateData).filter(k => k !== 'password');
    logger.info('USUARIOS: usuario modificado', { ...actorLog, targetUserId: id, camposModificados, passwordCambiada: !!password });
    return { user: decryptUser(updated) };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const field = (err.meta?.target as string[] | undefined)?.[0];
      const msg = field === 'email' ? 'El correo electrónico ya está en uso.' : 'Ya existe un usuario con ese dato.';
      return { error: msg, status: 409 as const };
    }
    throw err;
  }
}

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export async function changePassword(id: string, requesterId: string, currentPassword: string, newPassword: string) {
  if (requesterId !== id) return { error: 'Access denied', status: 403 as const };
  if (!currentPassword || !newPassword) return { error: 'Se requiere contraseña actual y nueva.', status: 400 as const };
  if (!PASSWORD_REGEX.test(newPassword)) {
    return { error: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.', status: 400 as const };
  }

  const user = await usersRepository.findById(id);
  if (!user) return { error: 'Usuario no encontrado.', status: 404 as const };

  const raw = await import('../../shared/prisma').then(m => m.default.user.findUnique({ where: { id }, select: { password: true } }));
  const valid = raw && await bcrypt.compare(currentPassword, raw.password);
  if (!valid) return { error: 'La contraseña actual es incorrecta.', status: 400 as const };

  await usersRepository.update(id, { password: await bcrypt.hash(newPassword, 12) });
  return {};
}

export async function deactivate(id: string, requesterId: string, actorLog: object) {
  if (requesterId === id) {
    return { error: 'Cannot delete your own account', status: 400 as const };
  }
  const existing = await usersRepository.findById(id);
  if (!existing) return { error: 'User not found', status: 404 as const };

  await usersRepository.deactivate(id);
  logger.info('USUARIOS: usuario desactivado', { ...actorLog, targetUserId: id, targetEmail: existing.email });
  return {};
}

export async function uploadPhoto(id: string, requesterId: string, filename: string, actorLog: object) {
  if (requesterId !== id) return { error: 'Access denied', status: 403 as const };

  const existing = await usersRepository.findById(id);
  if (!existing) return { error: 'User not found', status: 404 as const };

  if (existing.photoPath) {
    const { default: fs } = await import('fs');
    const { join, basename } = await import('path');
    const oldPath = join(process.cwd(), 'uploads', basename(existing.photoPath));
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  const photoPath = `/uploads/${filename}`;
  const updated = await usersRepository.update(id, { photoPath });
  logger.info('USUARIOS: foto actualizada', { ...actorLog, targetUserId: id, archivo: filename });
  return { user: decryptUser(updated) };
}

export async function deletePhoto(id: string, requesterId: string, actorLog: object): Promise<ServiceError | { user: ReturnType<typeof decryptUser> }> {
  if (requesterId !== id) return { error: 'Access denied', status: 403 as const };

  const existing = await usersRepository.findById(id);
  if (!existing) return { error: 'User not found', status: 404 as const };

  if (existing.photoPath) {
    const { default: fs } = await import('fs');
    const { join, basename } = await import('path');
    const oldPath = join(process.cwd(), 'uploads', basename(existing.photoPath));
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  const updated = await usersRepository.update(id, { photoPath: null });
  logger.info('USUARIOS: foto eliminada', { ...actorLog, targetUserId: id });
  return { user: decryptUser(updated) };
}

export async function sendPasswordReset(id: string, actorLog: object): Promise<ServiceError | Record<string, never>> {
  const user = await usersRepository.findById(id);
  if (!user || !user.active) return { error: 'No se puede enviar un restablecimiento a un usuario eliminado. Reactívalo primero.', status: 404 as const };

  await usersRepository.invalidatePendingResetTokens(id);

  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await usersRepository.createPasswordResetToken(id, token, expiresAt);

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetLink = `${frontendUrl}/reset-password?token=${token}`;

  try {
    await sendEmail(
      user.email,
      'Restablecer contraseña - Estudio Jurídico',
      `<div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #4f46e5;">Restablecer contraseña</h2>
        <p>Hola <strong>${user.nombre}</strong>,</p>
        <p>El administrador ha iniciado un restablecimiento de contraseña para tu cuenta.</p>
        <a href="${resetLink}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">
          Restablecer contraseña
        </a>
        <p style="color:#888;font-size:13px;">Este enlace expira en 1 hora.</p>
      </div>`
    );
  } catch (emailErr) {
    logger.warn('USUARIOS: no se pudo enviar email de restablecimiento (SMTP)', { ...actorLog, targetUserId: id, error: (emailErr as Error).message });
  }

  logger.info('USUARIOS: correo de restablecimiento enviado por admin', { ...actorLog, targetUserId: id, targetEmail: user.email });
  return {};
}

export async function getAuxiliares() {
  return usersRepository.findAuxiliares();
}

export async function getMyAuxiliares(abogadoId: string) {
  return usersRepository.getAuxiliaresByAbogado(abogadoId);
}

export async function addAuxiliar(abogadoId: string, auxiliarId: string): Promise<ServiceError | Record<string, never>> {
  const auxiliar = await usersRepository.findById(auxiliarId);
  if (!auxiliar || auxiliar.role !== 'AUXILIAR') {
    return { error: 'Usuario no encontrado o no es auxiliar', status: 400 as const };
  }
  await usersRepository.addAuxiliar(abogadoId, auxiliarId);
  return {};
}

export async function removeAuxiliar(abogadoId: string, auxiliarId: string) {
  await usersRepository.removeAuxiliar(abogadoId, auxiliarId);
  return {};
}

export async function inviteUser(
  email: string,
  role: string | undefined,
  actorRole: string,
  actorLog: object
): Promise<ServiceError | { user: ReturnType<typeof decryptUser> }> {
  if (!email) return { error: 'El email es requerido', status: 400 as const };

  const assignedRole = actorRole === 'ABOGADO' ? 'CLIENTE' : (role || 'CLIENTE');
  if (!['ADMIN', 'ABOGADO', 'CLIENTE', 'AUXILIAR'].includes(assignedRole)) {
    return { error: 'Rol inválido', status: 400 as const };
  }

  const existing = await usersRepository.findByEmail(email);
  if (existing) return { error: 'El email ya está registrado', status: 409 as const };

  const placeholderPassword = await bcrypt.hash(uuidv4(), 12);
  const user = await usersRepository.create({
    email,
    password: placeholderPassword,
    nombre: email.split('@')[0],
    apellido: '-',
    role: assignedRole as 'ADMIN' | 'ABOGADO' | 'CLIENTE' | 'AUXILIAR',
    active: false,
  });

  if (assignedRole === 'CLIENTE') {
    await usersRepository.createClient(user.id);
  }

  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await usersRepository.createPasswordResetToken(user.id, token, expiresAt);

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const setupLink = `${frontendUrl}/reset-password?token=${token}`;

  try {
    await sendEmail(
      email,
      'Bienvenido al Estudio Jurídico — Configura tu cuenta',
      `<div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #4f46e5;">Bienvenido al Estudio Jurídico</h2>
        <p>Has sido invitado a acceder al sistema.</p>
        <a href="${setupLink}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">
          Configurar contraseña
        </a>
        <p style="color:#888;font-size:13px;">Este enlace expira en 7 días.</p>
      </div>`
    );
  } catch (emailErr) {
    logger.warn('USUARIOS: no se pudo enviar email de invitación (SMTP)', { ...actorLog, nuevoEmail: email, error: (emailErr as Error).message });
  }

  logger.info('USUARIOS: invitación creada', { ...actorLog, nuevoUserId: user.id, nuevoEmail: email, nuevoRol: assignedRole });
  return { user: decryptUser(user) };
}
