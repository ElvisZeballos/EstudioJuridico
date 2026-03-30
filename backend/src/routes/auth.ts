import { Router } from 'express';
import { login, register, getMe, forgotPassword, resetPassword } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/login', login);
router.post('/register', register);
router.get('/me', authenticateToken, getMe);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;
