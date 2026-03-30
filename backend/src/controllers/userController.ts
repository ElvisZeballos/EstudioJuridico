import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
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
        dni: true, telefono: true, direccion: true, fechaNacimiento: true,
        photoPath: true, active: true, createdAt: true, updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    logger.info('USUARIOS: listado consultado', { ...actor(req), totalUsuarios: users.length });
    res.json(users.map(decryptUser));
  } catch (error) {
    logger.error('USUARIOS: error al listar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getUserById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (req.user?.role !== 'ADMIN' && req.user?.id !== id) {
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

    if (req.user?.role !== 'ADMIN' && req.user?.id !== id) {
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

    if (req.user?.role !== 'ADMIN' && req.user?.id !== id) {
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
