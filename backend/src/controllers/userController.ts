import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';
import { AuthRequest } from '../middleware/auth';
import { encryptIfDefined, decryptIfDefined } from '../config/encryption';
import { logger } from '../config/logger';
import path from 'path';
import fs from 'fs';

function actor(req: AuthRequest) {
  return {
    actorId: req.user?.id,
    actorEmail: req.user?.email,
    actorRole: req.user?.role,
    ip: req.ip || req.socket.remoteAddress,
  };
}

const prisma = new PrismaClient();

function decryptUser(user: {
  id: string;
  email: string;
  role: string;
  nombre: string;
  apellido: string;
  dni: string | null;
  telefono: string | null;
  direccion: string | null;
  fechaNacimiento: string | null;
  photoPath: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...user,
    dni: decryptIfDefined(user.dni),
    telefono: decryptIfDefined(user.telefono),
    direccion: decryptIfDefined(user.direccion),
    fechaNacimiento: decryptIfDefined(user.fechaNacimiento),
  };
}

export async function getAllUsers(req: AuthRequest, res: Response): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true, email: true, role: true, nombre: true, apellido: true,
        photoPath: true, active: true, createdAt: true, updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    logger.info('USUARIOS: listado consultado', { ...actor(req), totalUsuarios: users.length });
    res.json(users);
  } catch (error) {
    logger.error('USUARIOS: error al listar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getUserById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (req.user?.id !== id) {
      logger.warn('USUARIOS: acceso denegado al perfil', { ...actor(req), targetUserId: id });
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, role: true, nombre: true, apellido: true,
        dni: true, telefono: true, direccion: true, fechaNacimiento: true,
        photoPath: true, active: true, createdAt: true, updatedAt: true,
      },
    });

    if (!user) {
      logger.warn('USUARIOS: usuario no encontrado', { ...actor(req), targetUserId: id });
      res.status(404).json({ error: 'User not found' });
      return;
    }

    logger.info('USUARIOS: perfil consultado', { ...actor(req), targetUserId: id, targetEmail: user.email });
    res.json(decryptUser(user));
  } catch (error) {
    logger.error('USUARIOS: error al consultar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (req.user?.id !== id) {
      logger.warn('USUARIOS: intento de modificar usuario sin permiso', { ...actor(req), targetUserId: id });
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const { nombre, apellido, email, role, dni, telefono, direccion, fechaNacimiento, password, active } = req.body;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      logger.warn('USUARIOS: usuario a modificar no encontrado', { ...actor(req), targetUserId: id });
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const updateData: Record<string, unknown> = {
      ...(nombre !== undefined && { nombre }),
      ...(apellido !== undefined && { apellido }),
      ...(email !== undefined && { email }),
      ...(dni !== undefined && { dni: encryptIfDefined(dni) }),
      ...(telefono !== undefined && { telefono: encryptIfDefined(telefono) }),
      ...(direccion !== undefined && { direccion: encryptIfDefined(direccion) }),
      ...(fechaNacimiento !== undefined && { fechaNacimiento: encryptIfDefined(fechaNacimiento) }),
    };

    if (req.user?.role === 'ADMIN') {
      if (role !== undefined) updateData.role = role;
      if (active !== undefined) updateData.active = active;
    }

    if (password) {
      updateData.password = await bcrypt.hash(password, 12);
    }

    const camposModificados = Object.keys(updateData).filter(k => k !== 'password');

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true, email: true, role: true, nombre: true, apellido: true,
        dni: true, telefono: true, direccion: true, fechaNacimiento: true,
        photoPath: true, active: true, createdAt: true, updatedAt: true,
      },
    });

    logger.info('USUARIOS: usuario modificado', {
      ...actor(req),
      targetUserId: id,
      targetEmail: existing.email,
      camposModificados,
      passwordCambiada: !!password,
    });

    res.json(decryptUser(updated));
  } catch (error) {
    logger.error('USUARIOS: error al modificar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function uploadUserPhoto(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (req.user?.id !== id) {
      logger.warn('USUARIOS: intento de subir foto sin permiso', { ...actor(req), targetUserId: id });
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    if (!req.file) {
      logger.warn('USUARIOS: subida de foto sin archivo', { ...actor(req), targetUserId: id });
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (existing.photoPath) {
      const oldPath = path.join(process.cwd(), 'uploads', path.basename(existing.photoPath));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const photoPath = `/uploads/${req.file.filename}`;

    const updated = await prisma.user.update({
      where: { id },
      data: { photoPath },
      select: {
        id: true, email: true, role: true, nombre: true, apellido: true,
        dni: true, telefono: true, direccion: true, fechaNacimiento: true,
        photoPath: true, active: true, createdAt: true, updatedAt: true,
      },
    });

    logger.info('USUARIOS: foto actualizada', { ...actor(req), targetUserId: id, targetEmail: existing.email, archivo: req.file.filename });
    res.json(decryptUser(updated));
  } catch (error) {
    logger.error('USUARIOS: error al subir foto', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (req.user?.id === id) {
      logger.warn('USUARIOS: intento de desactivar cuenta propia', { ...actor(req) });
      res.status(400).json({ error: 'Cannot delete your own account' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      logger.warn('USUARIOS: usuario a eliminar no encontrado', { ...actor(req), targetUserId: id });
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await prisma.user.update({ where: { id }, data: { active: false } });

    logger.info('USUARIOS: usuario desactivado', {
      ...actor(req),
      targetUserId: id,
      targetEmail: existing.email,
      targetRole: existing.role,
    });

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    logger.error('USUARIOS: error al desactivar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function sendPasswordReset(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || !user.active) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    await prisma.passwordResetToken.updateMany({
      where: { userId: id, used: false },
      data: { used: true },
    });

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: { token, userId: id, expiresAt },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: user.email,
      subject: 'Restablecer contraseña - Estudio Jurídico',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #4f46e5;">Restablecer contraseña</h2>
          <p>Hola <strong>${user.nombre}</strong>,</p>
          <p>El administrador ha iniciado un restablecimiento de contraseña para tu cuenta. Haz clic en el botón para continuar:</p>
          <a href="${resetLink}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">
            Restablecer contraseña
          </a>
          <p style="color:#888;font-size:13px;">Este enlace expira en 1 hora. Si no esperabas este correo, contáctanos.</p>
        </div>
      `,
    });

    logger.info('USUARIOS: correo de restablecimiento enviado por admin', {
      ...actor(req),
      targetUserId: id,
      targetEmail: user.email,
    });

    res.json({ message: 'Correo de restablecimiento enviado.' });
  } catch (error) {
    logger.error('USUARIOS: error al enviar restablecimiento', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function inviteUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { email, role } = req.body;
    const actorRole = req.user?.role;

    if (!email) {
      res.status(400).json({ error: 'El email es requerido' });
      return;
    }

    // ABOGADO can only invite CLIENTEs
    const assignedRole = actorRole === 'ABOGADO' ? 'CLIENTE' : (role || 'CLIENTE');
    const validRoles = ['ADMIN', 'ABOGADO', 'CLIENTE'];
    if (!validRoles.includes(assignedRole)) {
      res.status(400).json({ error: 'Rol inválido' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'El email ya está registrado' });
      return;
    }

    const placeholderPassword = await bcrypt.hash(uuidv4(), 12);
    const nombrePlaceholder = email.split('@')[0];

    const user = await prisma.user.create({
      data: {
        email,
        password: placeholderPassword,
        nombre: nombrePlaceholder,
        apellido: '-',
        role: assignedRole as 'ADMIN' | 'ABOGADO' | 'CLIENTE',
        active: false,
      },
      select: {
        id: true, email: true, role: true, nombre: true, apellido: true,
        dni: true, telefono: true, direccion: true, fechaNacimiento: true,
        photoPath: true, active: true, createdAt: true, updatedAt: true,
      },
    });

    // Create invitation token (reuses PasswordResetToken table)
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await prisma.passwordResetToken.create({ data: { token, userId: user.id, expiresAt } });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const setupLink = `${frontendUrl}/reset-password?token=${token}`;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: 'Bienvenido al Estudio Jurídico — Configura tu cuenta',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #4f46e5;">Bienvenido al Estudio Jurídico</h2>
          <p>Has sido invitado a acceder al sistema. Para configurar tu contraseña y activar tu cuenta, haz clic en el botón:</p>
          <a href="${setupLink}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">
            Configurar contraseña
          </a>
          <p style="color:#888;font-size:13px;">Este enlace expira en 7 días. Si no esperabas este correo, puedes ignorarlo.</p>
        </div>
      `,
    });

    logger.info('USUARIOS: invitación enviada', {
      ...actor(req),
      nuevoUserId: user.id,
      nuevoEmail: email,
      nuevoRol: assignedRole,
    });

    res.status(201).json({ message: 'Invitación enviada correctamente', user: decryptUser(user) });
  } catch (error) {
    logger.error('USUARIOS: error al invitar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { email, password, nombre, apellido, role, dni, telefono, direccion, fechaNacimiento } = req.body;

    if (!email || !password || !nombre || !apellido) {
      logger.warn('USUARIOS: creación fallida por campos faltantes', { ...actor(req) });
      res.status(400).json({ error: 'Email, password, nombre and apellido are required' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      logger.warn('USUARIOS: intento de crear usuario con email ya registrado', { ...actor(req), emailDuplicado: email });
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email, password: hashedPassword, nombre, apellido,
        role: role || 'CLIENTE',
        dni: encryptIfDefined(dni),
        telefono: encryptIfDefined(telefono),
        direccion: encryptIfDefined(direccion),
        fechaNacimiento: encryptIfDefined(fechaNacimiento),
      },
      select: {
        id: true, email: true, role: true, nombre: true, apellido: true,
        dni: true, telefono: true, direccion: true, fechaNacimiento: true,
        photoPath: true, active: true, createdAt: true, updatedAt: true,
      },
    });

    logger.info('USUARIOS: usuario creado', {
      ...actor(req),
      nuevoUsuarioId: user.id,
      nuevoUsuarioEmail: user.email,
      nuevoUsuarioRole: user.role,
    });

    res.status(201).json(decryptUser(user));
  } catch (error) {
    logger.error('USUARIOS: error al crear', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}
