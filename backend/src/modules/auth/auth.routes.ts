import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateToken } from '../../middleware/auth';
import * as authController from './auth.controller';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión. Intenta nuevamente en 15 minutos.' },
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes de recuperación de contraseña. Intenta nuevamente en 15 minutos.' },
});

const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Intenta nuevamente en 15 minutos.' },
});

router.post('/login', loginLimiter, authController.login);
router.get('/me', authenticateToken, authController.getMe);
router.post('/refresh', authenticateToken, authController.refreshToken);
router.post('/forgot-password', forgotPasswordLimiter, authController.forgotPassword);
router.post('/reset-password', resetPasswordLimiter, authController.resetPassword);

export default router;
