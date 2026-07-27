import { Router, Response } from 'express';
import jwt from 'jsonwebtoken';
import { authenticateToken, AuthRequest } from '../../middleware/auth';
import { getAuthUrl, getTokensFromCode } from '../../infrastructure/googleCalendar';
import { logger } from '../../config/logger';
import prisma from '../../shared/prisma';

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

router.get('/connect', authenticateToken, (req: AuthRequest, res: Response) => {
  const url = getAuthUrl(req.user!.id);
  res.json({ url });
});

router.get('/callback', async (req, res) => {
  const { code, state } = req.query as { code: string; state: string };

  if (!code || !state) {
    return res.redirect(`${FRONTEND_URL}/dashboard?googleError=missing_params`);
  }

  let userId: string;
  try {
    const payload = jwt.verify(state, process.env.JWT_SECRET!) as { userId: string };
    userId = payload.userId;
  } catch (err) {
    logger.error('GOOGLE_CALENDAR: state inválido o expirado', { error: (err as Error).message });
    return res.redirect(`${FRONTEND_URL}/dashboard?googleError=invalid_state`);
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

router.get('/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { googleRefreshToken: true },
  });
  res.json({ connected: !!user?.googleRefreshToken });
});

router.delete('/disconnect', authenticateToken, async (req: AuthRequest, res: Response) => {
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { googleRefreshToken: null },
  });
  logger.info('GOOGLE_CALENDAR: desconectado', { userId: req.user!.id });
  res.json({ message: 'Google Calendar desconectado' });
});

export default router;
