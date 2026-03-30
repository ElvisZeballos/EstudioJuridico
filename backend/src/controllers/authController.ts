import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';
import { AuthRequest } from '../middleware/auth';
import { encryptIfDefined, decryptIfDefined } from '../config/encryption';

const prisma = new PrismaClient();

function generateToken(user: { id: string; email: string; role: string }): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    secret,
    { expiresIn: '7d' }
  );
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    if (!user.active) {
      res.status(401).json({ error: 'Account is disabled' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = generateToken({ id: user.id, email: user.email, role: user.role });

    res.json({
      token,
      user: {
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
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function register(req: Request, res: Response): Promise<void> {
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
    });

    const token = generateToken({ id: user.id, email: user.email, role: user.role });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        nombre: user.nombre,
        apellido: user.apellido,
        photoPath: user.photoPath,
        dni,
        telefono,
        direccion,
        fechaNacimiento,
        active: user.active,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    // Siempre responder OK para no revelar si el email existe
    if (!user || !user.active) {
      res.json({ message: 'Si el correo está registrado, recibirás un enlace.' });
      return;
    }

    // Invalidar tokens previos
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await prisma.passwordResetToken.create({
      data: { token, userId: user.id, expiresAt },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: user.email,
      subject: 'Restablecer contraseña - Estudio Jurídico',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #4f46e5;">Restablecer contraseña</h2>
          <p>Hola <strong>${user.nombre}</strong>,</p>
          <p>Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón para continuar:</p>
          <a href="${resetLink}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">
            Restablecer contraseña
          </a>
          <p style="color:#888;font-size:13px;">Este enlace expira en 1 hora. Si no solicitaste esto, ignora este correo.</p>
        </div>
      `,
    });

    res.json({ message: 'Si el correo está registrado, recibirás un enlace.' });
  } catch (error) {
    console.error('ForgotPassword error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      res.status(400).json({ error: 'Token and password are required' });
      return;
    }

    const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });

    if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
      res.status(400).json({ error: 'Token inválido o expirado' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword },
    });

    await prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { used: true },
    });

    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error('ResetPassword error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getMe(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
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
    });
  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
