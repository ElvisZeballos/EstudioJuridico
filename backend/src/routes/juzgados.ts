import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import {
  getAllJuzgados,
  getJuzgadoById,
  createJuzgado,
  updateJuzgado,
  deleteJuzgado,
} from '../controllers/juzgadoController';

const router = Router();

router.use(authenticateToken, requireRole('ABOGADO'));

router.get('/', getAllJuzgados);
router.get('/:id', getJuzgadoById);
router.post('/', createJuzgado);
router.put('/:id', updateJuzgado);
router.delete('/:id', deleteJuzgado);

export default router;
