import { Router } from 'express';
import {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  createUser,
  inviteUser,
  uploadUserPhoto,
  deleteUserPhoto,
  sendPasswordReset,
  changePassword,
} from '../controllers/userController';
import { authenticateToken, requireRole } from '../middleware/auth';
import { uploadPhoto, processPhoto } from '../middleware/upload';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Admin + Abogado: invite user by email
router.post('/invite', requireRole('ADMIN', 'ABOGADO'), inviteUser);

// Admin + Abogado + Auxiliar: list abogados for form selectors
router.get('/abogados', requireRole('ADMIN', 'ABOGADO', 'AUXILIAR'), async (req, res) => {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const abogados = await prisma.user.findMany({
    where: { role: 'ABOGADO', active: true },
    select: { id: true, nombre: true, apellido: true, email: true, role: true },
    orderBy: { apellido: 'asc' },
  });
  res.json(abogados);
});

// Admin + Auxiliar: list all users (Auxiliar is read-only via frontend)
router.get('/', requireRole('ADMIN', 'AUXILIAR'), getAllUsers);
router.post('/', requireRole('ADMIN'), createUser);
router.delete('/:id', requireRole('ADMIN'), deleteUser);
router.post('/:id/reset-password', requireRole('ADMIN'), sendPasswordReset);

// Any authenticated user (with access check inside controller)
router.get('/:id', getUserById);
router.put('/:id', updateUser);
router.post('/:id/change-password', changePassword);
router.post('/:id/photo', uploadPhoto.single('photo'), processPhoto, uploadUserPhoto);
router.delete('/:id/photo', deleteUserPhoto);

export default router;
