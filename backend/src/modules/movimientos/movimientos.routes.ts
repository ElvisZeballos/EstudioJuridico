import { Router } from 'express';
import { authenticateToken, requireRole } from '../../middleware/auth';
import * as movimientosController from './movimientos.controller';

const router = Router();

router.use(authenticateToken);
router.use(requireRole('ABOGADO'));

router.get('/', movimientosController.getAllMovimientos);
router.get('/stats', movimientosController.getMovimientoStats);
router.get('/caso/:casoId', movimientosController.getMovimientosByCaso);
router.get('/caso/:casoId/stats', movimientosController.getStatsByCaso);
router.post('/', movimientosController.createMovimiento);
router.put('/:id', movimientosController.updateMovimiento);
router.delete('/:id', movimientosController.deleteMovimiento);

export default router;
