// Simula el servidor de producción (Railway corre en UTC) para que los tests de
// fechas no dependan de la zona horaria de la máquina donde se ejecutan.
process.env.TZ = 'UTC';

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  testTimeout: 30000, // máquinas lentas (antivirus/disco): evita falsos fallos por el límite de 5 s
  setupFiles: ['<rootDir>/tests/setup/env.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup/mocks.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  collectCoverageFrom: [
    'src/shared/**/*.ts',
    'src/config/encryption.ts',
    'src/middleware/auth.ts',
    'src/modules/auth/**/*.ts',
    'src/modules/feriados/**/*.ts',
    'src/modules/novedades/**/*.ts',
    'src/services/notificationProcessor.ts',
  ],
  coverageDirectory: 'coverage',
};
