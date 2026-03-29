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
router.get('/stats', requireRole('ADMIN', 'ABOGADO'), getClientStats);

// List and create
router.get('/', getAllClients);
router.post('/', requireRole('ADMIN', 'ABOGADO'), createClient);

// Single client operations
router.get('/:id', getClientById);
router.put('/:id', requireRole('ADMIN', 'ABOGADO'), updateClient);
router.delete('/:id', requireRole('ADMIN'), deleteClient);

export default router;
