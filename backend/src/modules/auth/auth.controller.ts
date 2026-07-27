import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { logger } from '../../config/logger';
import * as authService from './auth.service';

export async function login(req: Request, res: Response): Promise<void> {
  const ip = req.ip || req.socket.remoteAddress;
  const { email, password } = req.body;

  if (!email || !password) {
    logger.warn('LOGIN fallido: campos faltantes', { ip });
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  try {
    const result = await authService.login(email, password, ip);
    if ('error' in result) {
      res.status(result.status ?? 500).json({ error: result.error });
      return;
    }
    res.json(result);
  } catch (error) {
    logger.error('LOGIN error interno', { error: (error as Error).message, ip });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function refreshToken(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await authService.refreshToken(req.user!.id);
    if ('error' in result) {
      res.status(result.status ?? 500).json({ error: result.error });
      return;
    }
    res.json(result);
  } catch (error) {
    logger.error('TOKEN: error al renovar', { error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getMe(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await authService.getMe(req.user!.id);
    if ('error' in result) {
      res.status(result.status ?? 500).json({ error: result.error });
      return;
    }
    res.json(result.user);
  } catch (error) {
    logger.error('GETME error interno', { error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const ip = req.ip || req.socket.remoteAddress;
  const { email } = req.body;

  if (!email) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  try {
    await authService.forgotPassword(email, ip);
    res.json({ message: 'Si el correo está registrado, recibirás un enlace.' });
  } catch (error) {
    logger.error('FORGOT-PASSWORD: error interno', { error: (error as Error).message, ip });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const ip = req.ip || req.socket.remoteAddress;
  const { token, password } = req.body;

  if (!token || !password) {
    res.status(400).json({ error: 'Token and password are required' });
    return;
  }

  try {
    const result = await authService.resetPassword(token, password, ip);
    if ('error' in result) {
      res.status(result.status ?? 500).json({ error: result.error });
      return;
    }
    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    logger.error('RESET-PASSWORD: error interno', { error: (error as Error).message, ip });
    res.status(500).json({ error: 'Internal server error' });
  }
}
