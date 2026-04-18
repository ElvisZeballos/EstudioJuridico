import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import {
  getNovedadesByCaso,
  createNovedad,
  updateNovedad,
  deleteNovedad,
} from '../controllers/casoNovedadController';

const router = Router({ mergeParams: true });

router.use(authenticateToken);
router.use(requireRole('ADMIN', 'ABOGADO', 'CLIENTE'));

router.get('/', getNovedadesByCaso);
router.post('/', requireRole('ADMIN', 'ABOGADO'), createNovedad);
router.put('/:id', requireRole('ADMIN', 'ABOGADO'), updateNovedad);
router.delete('/:id', requireRole('ADMIN', 'ABOGADO'), deleteNovedad);

export default router;
