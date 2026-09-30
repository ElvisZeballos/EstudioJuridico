// Variables de entorno EXCLUSIVAS para pruebas. No se lee backend/.env (dotenv
// está mockeado en mocks.ts), así que ninguna credencial real entra al test.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-solo-para-pruebas';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-!!!';
process.env.PORT = '0';
process.env.FRONTEND_URL = 'http://localhost:5173';
// URL inválida a propósito: si algún código llegara a instanciar Prisma real,
// fallaría de inmediato en vez de tocar la base de datos de desarrollo.
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/never_connects';

// Garantiza que ninguna prueba pueda gastar API de Claude ni enviar correos.
delete process.env.ANTHROPIC_API_KEY;
delete process.env.SMTP_HOST;
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;
delete process.env.GOOGLE_CLIENT_ID;
delete process.env.GOOGLE_CLIENT_SECRET;
