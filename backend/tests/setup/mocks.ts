// Mocks globales (se aplican a TODOS los archivos de test).
// Objetivo: aislar el sistema de todo lo externo — logs a disco, .env real,
// cron, WhatsApp (Baileys), Claude, SMTP, Google Calendar/Drive.
// Se usan factories explícitas (no automock) para que Jest NO cargue los
// módulos reales (Baileys, sharp, googleapis...) solo para inspeccionarlos.

jest.mock('dotenv', () => ({
  __esModule: true,
  default: { config: jest.fn() },
  config: jest.fn(),
}));

jest.mock('../../src/config/logger', () => ({
  __esModule: true,
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  logSystemInfo: jest.fn(),
}));

jest.mock('../../src/services/cronService', () => ({
  __esModule: true,
  startCronJobs: jest.fn(),
}));

jest.mock('../../src/services/whatsappService', () => ({
  __esModule: true,
  startWhatsAppSession: jest.fn(),
  getSessionStatus: jest.fn(),
  getDbSessionStatus: jest.fn(),
  disconnectWhatsApp: jest.fn(),
  sendWhatsAppMessage: jest.fn(),
}));

jest.mock('../../src/services/whatsappRunner', () => ({
  __esModule: true,
  runExtractionForUser: jest.fn(),
  runWhatsAppExtraction: jest.fn(),
}));

jest.mock('../../src/infrastructure/claude', () => ({
  __esModule: true,
  analyzeNotifications: jest.fn(),
}));

jest.mock('../../src/infrastructure/email', () => ({
  __esModule: true,
  sendEmail: jest.fn().mockResolvedValue(undefined),
  sendEmailWithAttachments: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/infrastructure/googleCalendar', () => ({
  __esModule: true,
  getAuthUrl: jest.fn(),
  getTokensFromCode: jest.fn(),
  createCalendarEvent: jest.fn(),
  updateCalendarEvent: jest.fn(),
  deleteCalendarEvent: jest.fn(),
}));

jest.mock('../../src/infrastructure/googleDrive', () => ({
  __esModule: true,
  uploadToDrive: jest.fn(),
}));
