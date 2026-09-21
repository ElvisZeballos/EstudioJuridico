import { Router } from 'express';
import { authenticateToken, requireRole } from '../../middleware/auth';
import * as feriadosController from './feriados.controller';

const router = Router();

router.use(authenticateToken);

router.get('/', requireRole('ABOGADO', 'AUXILIAR'), feriadosController.getAllFeriados);
router.post('/', requireRole('ABOGADO'), feriadosController.createFeriado);
router.delete('/:id', requireRole('ABOGADO'), feriadosController.deleteFeriado);

router.get('/configuracion', requireRole('ABOGADO', 'AUXILIAR'), feriadosController.getConfiguracion);
router.put('/configuracion', requireRole('ABOGADO'), feriadosController.updateConfiguracion);

export default router;