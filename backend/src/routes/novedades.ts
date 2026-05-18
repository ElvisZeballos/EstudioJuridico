import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { getNovedadesAgendadas, getNovedadesNotificaciones } from '../controllers/casoNovedadController';

const router = Router();

router.use(authenticateToken);
router.get('/agendadas', getNovedadesAgendadas);
router.get('/notificaciones', getNovedadesNotificaciones);

export default router;
