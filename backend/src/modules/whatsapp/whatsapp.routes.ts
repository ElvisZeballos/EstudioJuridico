import { Router } from 'express';
import { authenticateToken, requireRole } from '../../middleware/auth';
import * as whatsappController from './whatsapp.controller';

const router = Router();

router.use(authenticateToken);

router.post('/connect', requireRole('ABOGADO', 'ADMIN'), whatsappController.connectWhatsApp);
router.get('/status', requireRole('ABOGADO', 'ADMIN'), whatsappController.getWhatsAppStatus);
router.delete('/disconnect', requireRole('ABOGADO', 'ADMIN'), whatsappController.disconnectWhatsApp);
router.post('/run-extraction', requireRole('ABOGADO', 'ADMIN'), whatsappController.triggerExtraction);
router.get('/test-groq', requireRole('ABOGADO', 'ADMIN'), whatsappController.testGroq);
router.get('/debug', requireRole('ABOGADO', 'ADMIN'), whatsappController.debugWhatsApp);

export default router;
