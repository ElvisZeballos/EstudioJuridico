import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

import { logger, logSystemInfo } from './config/logger';
import { requestLogger } from './middleware/requestLogger';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import clientRoutes from './routes/clients';
import juzgadoRoutes from './routes/juzgados';
import casoRoutes from './routes/casos';

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Middleware
app.use(cors({
  origin: [FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestLogger);

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/juzgados', juzgadoRoutes);
app.use('/api/casos', casoRoutes);

// 404 handler
app.use((req, res) => {
  logger.warn(`RUTA NO ENCONTRADA: ${req.method} ${req.url}`, { ip: req.ip });
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('ERROR NO MANEJADO', {
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    ip: req.ip,
  });
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  logSystemInfo();
  logger.info(`API escuchando en http://localhost:${PORT}`, {
    port: PORT,
    frontendUrl: FRONTEND_URL,
    uploadsDir: path.join(process.cwd(), 'uploads'),
  });
});

export default app;
