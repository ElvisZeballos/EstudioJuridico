import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { encryptIfDefined, decryptIfDefined } from '../config/encryption';
import path from 'path';
import fs from 'fs';

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
        id: true,
        email: true,
        role: true,
        nombre: true,
        apellido: true,
        dni: true,
        telefono: true,
        direccion: true,
        fechaNacimiento: true,
        photoPath: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const decrypted = users.map(decryptUser);
    res.json(decrypted);
  } catch (error) {
    console.error('GetAllUsers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getUserById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // Non-admins can only view their own profile
    if (req.user?.role !== 'ADMIN' && req.user?.id !== id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        nombre: true,
        apellido: true,
        dni: true,
        telefono: true,
        direccion: true,
        fechaNacimiento: true,
        photoPath: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(decryptUser(user));
  } catch (error) {
    console.error('GetUserById error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // Non-admins can only edit their own profile
    if (req.user?.role !== 'ADMIN' && req.user?.id !== id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const { nombre, apellido, email, role, dni, telefono, direccion, fechaNacimiento, password, active } = req.body;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Only admins can change roles and active status
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

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        role: true,
        nombre: true,
        apellido: true,
        dni: true,
        telefono: true,
        direccion: true,
        fechaNacimiento: true,
        photoPath: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json(decryptUser(updated));
  } catch (error) {
    console.error('UpdateUser error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function uploadUserPhoto(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // Non-admins can only update their own photo
    if (req.user?.role !== 'ADMIN' && req.user?.id !== id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Delete old photo if exists
    if (existing.photoPath) {
      const oldPath = path.join(process.cwd(), 'uploads', path.basename(existing.photoPath));
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    const photoPath = `/uploads/${req.file.filename}`;

    const updated = await prisma.user.update({
      where: { id },
      data: { photoPath },
      select: {
        id: true,
        email: true,
        role: true,
        nombre: true,
        apellido: true,
        dni: true,
        telefono: true,
        direccion: true,
        fechaNacimiento: true,
        photoPath: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json(decryptUser(updated));
  } catch (error) {
    console.error('UploadUserPhoto error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (req.user?.id === id) {
      res.status(400).json({ error: 'Cannot delete your own account' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Soft delete
    await prisma.user.update({
      where: { id },
      data: { active: false },
    });

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    console.error('DeleteUser error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { email, password, nombre, apellido, role, dni, telefono, direccion, fechaNacimiento } = req.body;

    if (!email || !password || !nombre || !apellido) {
      res.status(400).json({ error: 'Email, password, nombre and apellido are required' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        nombre,
        apellido,
        role: role || 'CLIENTE',
        dni: encryptIfDefined(dni),
        telefono: encryptIfDefined(telefono),
        direccion: encryptIfDefined(direccion),
        fechaNacimiento: encryptIfDefined(fechaNacimiento),
      },
      select: {
        id: true,
        email: true,
        role: true,
        nombre: true,
        apellido: true,
        dni: true,
        telefono: true,
        direccion: true,
        fechaNacimiento: true,
        photoPath: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(201).json(decryptUser(user));
  } catch (error) {
    console.error('CreateUser error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
