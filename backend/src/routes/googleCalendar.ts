import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { getAuthUrl, getTokensFromCode } from '../services/googleCalendar';
import { logger } from '../config/logger';

const router = Router();
const prisma = new PrismaClient();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Returns the Google OAuth URL
router.get('/connect', authenticateToken, (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const url = getAuthUrl(userId);
  res.json({ url });
});

// Google OAuth callback — exchange code for tokens
router.get('/callback', async (req, res) => {
  const { code, state: userId } = req.query as { code: string; state: string };

  if (!code || !userId) {
    return res.redirect(`${FRONTEND_URL}/dashboard?googleError=missing_params`);
  }

  try {
    const tokens = await getTokensFromCode(code);
    if (!tokens.refresh_token) {
      return res.redirect(`${FRONTEND_URL}/dashboard?googleError=no_refresh_token`);
    }

    await prisma.user.update({
      where: { id: userId },
      data: { googleRefreshToken: tokens.refresh_token },
    });

    logger.info('GOOGLE_CALENDAR: conectado', { userId });
    return res.redirect(`${FRONTEND_URL}/dashboard?googleConnected=true`);
  } catch (err) {
    logger.error('GOOGLE_CALENDAR: error en callback', { error: (err as Error).message });
    return res.redirect(`${FRONTEND_URL}/dashboard?googleError=auth_failed`);
  }
});

// Returns if the authenticateTokend user is connected to Google Calendar
router.get('/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { googleRefreshToken: true } });
  res.json({ connected: !!user?.googleRefreshToken });
});

// Disconnects Google Calendar
router.delete('/disconnect', authenticateToken, async (req: AuthRequest, res: Response) => {
  await prisma.user.update({ where: { id: req.user!.id }, data: { googleRefreshToken: null } });
  logger.info('GOOGLE_CALENDAR: desconectado', { userId: req.user!.id });
  res.json({ message: 'Google Calendar desconectado' });
});

export default router;
