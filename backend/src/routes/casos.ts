import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import {
  getAllCasos,
  getCasoById,
  getCasoHistorial,
  createCaso,
  updateCaso,
  deleteCaso,
} from '../controllers/casoController';

const router = Router();

router.use(authenticateToken);
router.use(requireRole('ABOGADO', 'CLIENTE', 'AUXILIAR'));

router.get('/', getAllCasos);
router.get('/:id/historial', getCasoHistorial);
router.get('/:id', getCasoById);
router.post('/', requireRole('ABOGADO'), createCaso);
router.put('/:id', requireRole('ABOGADO', 'AUXILIAR'), updateCaso);
router.delete('/:id', requireRole('ABOGADO'), deleteCaso);

export default router;
