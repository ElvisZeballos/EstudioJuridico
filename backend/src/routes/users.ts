import { Router } from 'express';
import {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  createUser,
  inviteUser,
  uploadUserPhoto,
} from '../controllers/userController';
import { authenticateToken, requireRole } from '../middleware/auth';
import { uploadPhoto } from '../middleware/upload';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Admin + Abogado: invite user by email
router.post('/invite', requireRole('ADMIN', 'ABOGADO'), inviteUser);

// Admin + Abogado: list abogados for form selectors
router.get('/abogados', requireRole('ADMIN', 'ABOGADO'), async (req, res) => {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const abogados = await prisma.user.findMany({
    where: { role: 'ABOGADO', active: true },
    select: { id: true, nombre: true, apellido: true, email: true, role: true },
    orderBy: { apellido: 'asc' },
  });
  res.json(abogados);
});

// Admin only: list all users, create user, delete user
router.get('/', requireRole('ADMIN'), getAllUsers);
router.post('/', requireRole('ADMIN'), createUser);
router.delete('/:id', requireRole('ADMIN'), deleteUser);

// Any authenticated user (with access check inside controller)
router.get('/:id', getUserById);
router.put('/:id', updateUser);
router.post('/:id/photo', uploadPhoto.single('photo'), uploadUserPhoto);

export default router;
