import cron from 'node-cron';
import { logger } from '../config/logger';
import { runWhatsAppExtraction } from './whatsappRunner';

// 5 PM UTC-5 = 22:00 UTC
const WHATSAPP_RUNNER_SCHEDULE = '0 22 * * *';

export function startCronJobs(): void {
  cron.schedule(
    WHATSAPP_RUNNER_SCHEDULE,
    async () => {
      logger.info('Cron: iniciando extracción diaria de WhatsApp (5 PM UTC-5)');
      try {
        await runWhatsAppExtraction();
      } catch (err) {
        logger.error(`Cron: error en extracción de WhatsApp: ${(err as Error).message}`);
      }
    },
    { timezone: 'UTC' }
  );

  logger.info('Cron: extracción de WhatsApp programada para las 22:00 UTC (5 PM UTC-5)');
}
