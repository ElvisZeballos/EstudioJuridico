import { Router } from 'express';
import {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  createUser,
  uploadUserPhoto,
} from '../controllers/userController';
import { authenticateToken, requireRole } from '../middleware/auth';
import { uploadPhoto } from '../middleware/upload';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Admin only: list all users, create user, delete user
router.get('/', requireRole('ADMIN'), getAllUsers);
router.post('/', requireRole('ADMIN'), createUser);
router.delete('/:id', requireRole('ADMIN'), deleteUser);

// Any authenticated user (with access check inside controller)
router.get('/:id', getUserById);
router.put('/:id', updateUser);
router.post('/:id/photo', uploadPhoto.single('photo'), uploadUserPhoto);

export default router;
