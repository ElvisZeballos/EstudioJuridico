import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { getNovedadesAgendadas } from '../controllers/casoNovedadController';

const router = Router();

router.use(authenticateToken);
router.get('/agendadas', getNovedadesAgendadas);

export default router;
