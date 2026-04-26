import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);
router.use(requireRole('ADMIN'));

function getDirSizeBytes(dirPath: string): number {
  let total = 0;
  try {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) total += getDirSizeBytes(fullPath);
      else if (entry.isFile()) total += fs.statSync(fullPath).size;
    }
  } catch { /* ignore unreadable paths */ }
  return total;
}

router.get('/stats', async (_req, res) => {
  try {
    // Database latency
    const dbStart = Date.now();
    let dbConnected = false;
    let dbLatencyMs = 0;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbConnected = true;
      dbLatencyMs = Date.now() - dbStart;
    } catch { /* db unreachable */ }

    // Storage info
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const uploadsDirBytes = getDirSizeBytes(uploadsDir);
    let diskAvailableGB: number | null = null;
    let diskTotalGB: number | null = null;
    try {
      const statfs = (fs as unknown as { statfsSync: (p: string) => { bfree: number; blocks: number; bsize: number } }).statfsSync;
      if (typeof statfs === 'function') {
        const s = statfs(uploadsDir);
        diskAvailableGB = Math.round((s.bfree * s.bsize) / 1073741824 * 10) / 10;
        diskTotalGB     = Math.round((s.blocks * s.bsize) / 1073741824 * 10) / 10;
      }
    } catch { /* not available on this platform */ }

    // System counts
    const [userCount, activeUserCount, clientCount, casoCount] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { active: true } }),
      prisma.client.count({ where: { active: true } }),
      prisma.caso.count({ where: { active: true } }),
    ]);

    const mem = process.memoryUsage();

    res.json({
      server: {
        uptime:      Math.floor(process.uptime()),
        nodeVersion: process.version,
        env:         process.env.NODE_ENV || 'development',
        platform:    os.platform(),
        memory: {
          heapUsedMB:  Math.round(mem.heapUsed  / 1048576),
          heapTotalMB: Math.round(mem.heapTotal / 1048576),
          rssMB:       Math.round(mem.rss       / 1048576),
        },
      },
      database: {
        connected:  dbConnected,
        latencyMs:  dbLatencyMs,
        provider:   'postgresql',
        url:        process.env.DATABASE_URL
          ? new URL(process.env.DATABASE_URL).hostname
          : 'desconocido',
      },
      storage: {
        uploadsDirMB:  Math.round(uploadsDirBytes / 10485.76) / 100,
        diskAvailableGB,
        diskTotalGB,
      },
      counts: {
        totalUsers:   userCount,
        activeUsers:  activeUserCount,
        totalClients: clientCount,
        totalCasos:   casoCount,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch {
    res.status(500).json({ error: 'Error al obtener estadísticas del sistema' });
  }
});

export default router;
