import { Router } from 'express';
import { authenticateToken, requireRole } from '../../middleware/auth';
import * as whatsappController from './whatsapp.controller';

const router = Router();

router.use(authenticateToken);

router.post('/connect', whatsappController.connectWhatsApp);
router.get('/status', whatsappController.getWhatsAppStatus);
router.delete('/disconnect', whatsappController.disconnectWhatsApp);
router.post('/run-extraction', requireRole('ABOGADO', 'ADMIN'), whatsappController.triggerExtraction);
router.get('/test-groq', requireRole('ABOGADO', 'ADMIN'), whatsappController.testGroq);
router.get('/debug', whatsappController.debugWhatsApp);

export default router;
