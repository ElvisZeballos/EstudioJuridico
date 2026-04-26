import { Router } from 'express';
import {
  getAllClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  getClientStats,
} from '../controllers/clientController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Stats endpoint
router.get('/stats', requireRole('ABOGADO', 'AUXILIAR'), getClientStats);

// List and create
router.get('/', requireRole('ABOGADO', 'CLIENTE', 'AUXILIAR'), getAllClients);
router.post('/', requireRole('ABOGADO'), createClient);

// Single client operations
router.get('/:id', requireRole('ABOGADO', 'CLIENTE', 'AUXILIAR'), getClientById);
router.put('/:id', requireRole('ABOGADO', 'AUXILIAR'), updateClient);
router.delete('/:id', requireRole('ABOGADO'), deleteClient);

export default router;
