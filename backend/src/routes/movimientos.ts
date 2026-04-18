import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import {
  getAllMovimientos,
  getMovimientosByCaso,
  getMovimientoStats,
  getStatsByCaso,
  createMovimiento,
  updateMovimiento,
  deleteMovimiento,
} from '../controllers/movimientoController';

const router = Router();

router.use(authenticateToken);
router.use(requireRole('ADMIN', 'ABOGADO'));

router.get('/', getAllMovimientos);
router.get('/stats', getMovimientoStats);
router.get('/caso/:casoId', getMovimientosByCaso);
router.get('/caso/:casoId/stats', getStatsByCaso);
router.post('/', createMovimiento);
router.put('/:id', updateMovimiento);
router.delete('/:id', deleteMovimiento);

export default router;
