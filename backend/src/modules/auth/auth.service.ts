import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { decryptIfDefined } from '../../config/encryption';
import { logger } from '../../config/logger';
import { sendEmail } from '../../infrastructure/email';
import * as authRepository from './auth.repository';

function generateToken(user: { id: string; email: string; role: string }): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    secret,
    { expiresIn: '2h' }
  );
}

function formatUserResponse(user: {
  id: string; email: string; role: string; nombre: string; apellido: string;
  photoPath: string | null; dni: string | null; telefono: string | null;
  direccion: string | null; fechaNacimiento: string | null; active: boolean;
  createdAt: Date; updatedAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    nombre: user.nombre,
    apellido: user.apellido,
    photoPath: user.photoPath,
    dni: decryptIfDefined(user.dni),
    telefono: decryptIfDefined(user.telefono),
    direccion: decryptIfDefined(user.direccion),
    fechaNacimiento: decryptIfDefined(user.fechaNacimiento),
    active: user.active,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function login(email: string, password: string, ip: string | undefined) {
  logger.info('LOGIN intento', { email, ip });

  const user = await authRepository.findUserByEmail(email);
  if (!user) {
    logger.warn('LOGIN fallido: usuario no encontrado', { email, ip });
    return { error: 'Invalid credentials', status: 401 as const };
  }

  if (!user.active) {
    logger.warn('LOGIN fallido: cuenta desactivada', { email, ip, userId: user.id });
    return { error: 'Account is disabled', status: 401 as const };
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    logger.warn('LOGIN fallido: contraseña incorrecta', { email, ip, userId: user.id });
    return { error: 'Invalid credentials', status: 401 as const };
  }

  const token = generateToken({ id: user.id, email: user.email, role: user.role });
  logger.info('LOGIN exitoso', { email, userId: user.id, role: user.role, ip });

  return { token, user: formatUserResponse(user) };
}

export async function refreshToken(userId: string) {
  const user = await authRepository.findUserById(userId);
  if (!user || !user.active) {
    return { error: 'Account not found or disabled', status: 401 as const };
  }
  const token = generateToken({ id: user.id, email: user.email, role: user.role });
  logger.info('TOKEN: renovado', { userId: user.id, email: user.email, role: user.role });
  return { token };
}

export async function getMe(userId: string) {
  const user = await authRepository.findUserById(userId);
  if (!user) return { error: 'User not found', status: 404 as const };
  return { user: formatUserResponse(user) };
}

export async function forgotPassword(email: string, ip: string | undefined) {
  logger.info('FORGOT-PASSWORD: solicitud recibida', { email, ip });

  const user = await authRepository.findUserByEmail(email);
  if (!user || !user.active) {
    logger.info('FORGOT-PASSWORD: correo no registrado o inactivo (respuesta genérica)', { email, ip });
    return {};
  }

  await authRepository.invalidatePendingResetTokens(user.id);

  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await authRepository.createPasswordResetToken(user.id, token, expiresAt);

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetLink = `${frontendUrl}/reset-password?token=${token}`;

  await sendEmail(
    user.email,
    'Restablecer contraseña - Estudio Jurídico',
    `<div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #4f46e5;">Restablecer contraseña</h2>
      <p>Hola <strong>${user.nombre}</strong>,</p>
      <p>Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón para continuar:</p>
      <a href="${resetLink}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">
        Restablecer contraseña
      </a>
      <p style="color:#888;font-size:13px;">Este enlace expira en 1 hora. Si no solicitaste esto, ignora este correo.</p>
    </div>`
  );

  logger.info('FORGOT-PASSWORD: correo enviado', { email, userId: user.id, ip, expiresAt });
  return {};
}

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export async function resetPassword(token: string, password: string, ip: string | undefined) {
  if (!PASSWORD_REGEX.test(password)) {
    return {
      error: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número',
      status: 400 as const,
    };
  }

  const resetToken = await authRepository.findPasswordResetToken(token);

  if (!resetToken) {
    logger.warn('RESET-PASSWORD: token no encontrado', { ip });
    return { error: 'Token inválido o expirado', status: 400 as const };
  }

  if (resetToken.used) {
    logger.warn('RESET-PASSWORD: token ya utilizado', { userId: resetToken.userId, ip });
    return { error: 'Token inválido o expirado', status: 400 as const };
  }

  if (resetToken.expiresAt < new Date()) {
    logger.warn('RESET-PASSWORD: token expirado', { userId: resetToken.userId, expiredAt: resetToken.expiresAt, ip });
    return { error: 'Token inválido o expirado', status: 400 as const };
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  await authRepository.updateUserPassword(resetToken.userId, hashedPassword);
  await authRepository.markResetTokenUsed(resetToken.id);

  logger.info('RESET-PASSWORD: contraseña actualizada', { userId: resetToken.userId, ip });
  return {};
}
