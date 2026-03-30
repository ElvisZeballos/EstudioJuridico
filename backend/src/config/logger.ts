import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import os from 'os';

const LOGS_DIR = path.join(process.cwd(), 'logs');

const logFormat = winston.format.printf(({ timestamp, level, message, ...meta }) => {
  const metaStr = Object.keys(meta).length ? '\n  ' + JSON.stringify(meta, null, 2).replace(/\n/g, '\n  ') : '';
  return `[${timestamp}] ${level.toUpperCase().padEnd(5)} | ${message}${metaStr}`;
});

const dailyTransport = new DailyRotateFile({
  dirname: LOGS_DIR,
  filename: '%DATE%.txt',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: false,
  maxFiles: '30d',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    logFormat
  ),
});

const errorTransport = new DailyRotateFile({
  dirname: path.join(LOGS_DIR, 'errors'),
  filename: '%DATE%-errors.txt',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: false,
  maxFiles: '30d',
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    logFormat
  ),
});

export const logger = winston.createLogger({
  level: 'debug',
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        logFormat
      ),
    }),
    dailyTransport,
    errorTransport,
  ],
});

// Log info del sistema al iniciar
export function logSystemInfo() {
  logger.info('=== SERVIDOR INICIADO ===', {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    pid: process.pid,
    logsDir: LOGS_DIR,
  });
}
