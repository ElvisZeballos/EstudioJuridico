import { Router } from 'express';
import { authenticateToken, requireRole } from '../../middleware/auth';
import * as juzgadosController from './juzgados.controller';

const router = Router();

router.use(authenticateToken);

// Read: any authenticated staff role (needed in case views for all roles)
router.get('/', requireRole('ABOGADO', 'AUXILIAR', 'CLIENTE'), juzgadosController.getAllJuzgados);
router.get('/:id', requireRole('ABOGADO', 'AUXILIAR', 'CLIENTE'), juzgadosController.getJuzgadoById);

// Write: abogado only
router.post('/', requireRole('ABOGADO'), juzgadosController.createJuzgado);
router.put('/:id', requireRole('ABOGADO'), juzgadosController.updateJuzgado);
router.delete('/:id', requireRole('ABOGADO'), juzgadosController.deleteJuzgado);

export default router;
