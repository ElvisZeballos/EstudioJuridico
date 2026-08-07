import { Router } from 'express';
import { authenticateToken, requireRole } from '../../middleware/auth';
import * as clientsController from './clients.controller';

const router = Router();

router.use(authenticateToken);

router.get('/stats', requireRole('ADMIN', 'ABOGADO', 'AUXILIAR'), clientsController.getClientStats);
router.get('/', requireRole('ADMIN', 'ABOGADO', 'CLIENTE', 'AUXILIAR'), clientsController.getAllClients);
router.post('/', requireRole('ABOGADO'), clientsController.createClient);
router.get('/:id', requireRole('ADMIN', 'ABOGADO', 'CLIENTE', 'AUXILIAR'), clientsController.getClientById);
router.put('/:id', requireRole('ABOGADO'), clientsController.updateClient);
router.delete('/:id', requireRole('ABOGADO'), clientsController.deleteClient);

export default router;
