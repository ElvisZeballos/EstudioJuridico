import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { actor } from '../../shared/actor';
import { logger } from '../../config/logger';
import * as usersService from './users.service';

export async function getAllUsers(req: AuthRequest, res: Response): Promise<void> {
  try {
    const users = await usersService.getAll();
    logger.info('USUARIOS: listado consultado', { ...actor(req), totalUsuarios: users.length });
    res.json(users);
  } catch (error) {
    logger.error('USUARIOS: error al listar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getUserById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await usersService.getById(req.params.id, req.user!.id);
    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    logger.info('USUARIOS: perfil consultado', { ...actor(req), targetUserId: req.params.id });
    res.json(result.user);
  } catch (error) {
    logger.error('USUARIOS: error al consultar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getAbogados(req: AuthRequest, res: Response): Promise<void> {
  try {
    const abogados = await usersService.getAbogados();
    res.json(abogados);
  } catch (error) {
    logger.error('USUARIOS: error al listar abogados', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await usersService.create(req.body, actor(req));
    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.status(201).json(result.user);
  } catch (error) {
    logger.error('USUARIOS: error al crear', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await usersService.update(req.params.id, req.user!.id, req.user!.role, req.body, actor(req));
    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json(result.user);
  } catch (error) {
    logger.error('USUARIOS: error al modificar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function changePassword(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await usersService.changePassword(req.params.id, req.user!.id, currentPassword, newPassword);
    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    logger.info('USUARIOS: contraseña cambiada', { ...actor(req), targetUserId: req.params.id });
    res.json({ message: 'Contraseña actualizada correctamente.' });
  } catch (error) {
    logger.error('USUARIOS: error al cambiar contraseña', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await usersService.deactivate(req.params.id, req.user!.id, actor(req));
    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    logger.error('USUARIOS: error al desactivar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function uploadUserPhoto(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }
    const result = await usersService.uploadPhoto(req.params.id, req.user!.id, req.file.filename, actor(req));
    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json(result.user);
  } catch (error) {
    logger.error('USUARIOS: error al subir foto', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteUserPhoto(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await usersService.deletePhoto(req.params.id, req.user!.id, actor(req));
    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json(result.user);
  } catch (error) {
    logger.error('USUARIOS: error al eliminar foto', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function sendPasswordReset(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await usersService.sendPasswordReset(req.params.id, actor(req));
    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ message: 'Correo de restablecimiento enviado.' });
  } catch (error) {
    logger.error('USUARIOS: error al enviar restablecimiento', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getAuxiliares(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const auxiliares = await usersService.getAuxiliares();
    res.json(auxiliares);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getMyAuxiliares(req: AuthRequest, res: Response): Promise<void> {
  try {
    const auxiliares = await usersService.getMyAuxiliares(req.user!.id);
    res.json(auxiliares);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function addAuxiliar(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await usersService.addAuxiliar(req.user!.id, req.params.auxiliarId);
    if ('error' in result) { res.status(result.status).json({ error: result.error }); return; }
    res.json({ message: 'Auxiliar asignado' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function removeAuxiliar(req: AuthRequest, res: Response): Promise<void> {
  try {
    await usersService.removeAuxiliar(req.user!.id, req.params.auxiliarId);
    res.json({ message: 'Auxiliar removido' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function inviteUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { email, role } = req.body;
    const result = await usersService.inviteUser(email, role, req.user!.role, actor(req));
    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.status(201).json({ message: 'Invitación enviada correctamente', user: result.user });
  } catch (error) {
    logger.error('USUARIOS: error al invitar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}
