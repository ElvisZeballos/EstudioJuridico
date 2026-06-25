import { Router } from 'express';
import { authenticateToken, requireRole } from '../../middleware/auth';
import * as casosController from './casos.controller';

const router = Router();

router.use(authenticateToken);
router.use(requireRole('ABOGADO', 'CLIENTE', 'AUXILIAR'));

router.get('/', casosController.getAllCasos);
router.get('/:id/historial', casosController.getCasoHistorial);
router.get('/:id', casosController.getCasoById);
router.post('/', requireRole('ABOGADO'), casosController.createCaso);
router.put('/:id', requireRole('ABOGADO'), casosController.updateCaso);
router.delete('/:id', requireRole('ABOGADO'), casosController.deleteCaso);

export default router;
