import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import {
  connectWhatsApp,
  getWhatsAppStatus,
  disconnectWhatsAppHandler,
  triggerExtractionHandler,
  debugWhatsAppHandler,
} from '../controllers/whatsappController';

const router = Router();

router.use(authenticateToken);

router.post('/connect', connectWhatsApp);
router.get('/status', getWhatsAppStatus);
router.delete('/disconnect', disconnectWhatsAppHandler);
router.post('/run-extraction', requireRole('ABOGADO', 'ADMIN'), triggerExtractionHandler);
router.get('/debug', debugWhatsAppHandler);

export default router;
