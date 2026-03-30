import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const { method, url, ip, headers } = req;

  const body = { ...req.body };
  if (body.password) body.password = '***';
  if (body.token) body.token = '***';

  logger.info(`REQUEST ${method} ${url}`, {
    ip: ip || req.socket.remoteAddress,
    userAgent: headers['user-agent'],
    contentType: headers['content-type'],
    body: Object.keys(body).length ? body : undefined,
  });

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    logger[level](`RESPONSE ${method} ${url} → ${res.statusCode} (${duration}ms)`, {
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });
  });

  next();
}
