import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../config/logger';
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from '../services/googleCalendar';

const prisma = new PrismaClient();

function actor(req: AuthRequest) {
  return {
    actorId: req.user?.id,
    actorEmail: req.user?.email,
    actorRole: req.user?.role,
    ip: req.ip || req.socket.remoteAddress,
  };
}

const novedadInclude = {
  autor: { select: { id: true, nombre: true, apellido: true, email: true, role: true } },
  caso: { select: { id: true, titulo: true } },
};

async function checkCasoAccess(casoId: string, userId: string, role: string) {
  const caso = await prisma.caso.findUnique({
    where: { id: casoId },
    include: { abogados: true, clientes: true },
  });
  if (!caso || !caso.active) return null;

  if (role === 'ABOGADO') {
    if (!caso.abogados.some((a) => a.abogadoId === userId)) return null;
  } else if (role === 'CLIENTE') {
    const client = await prisma.client.findFirst({ where: { userId } });
    if (!client || !caso.clientes.some((c) => c.clienteId === client.id)) return null;
  }
  return caso;
}

async function syncToGoogleCalendar(
  userId: string,
  novedad: { titulo: string; contenido: string; fechaAgendada: Date; googleCalendarEventId?: string | null },
  casoTitulo: string,
  novedadId: string
) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { googleRefreshToken: true } });
    if (!user?.googleRefreshToken) return;

    const eventData = { titulo: novedad.titulo, contenido: novedad.contenido, fechaAgendada: novedad.fechaAgendada, casoTitulo };

    if (novedad.googleCalendarEventId) {
      await updateCalendarEvent(user.googleRefreshToken, novedad.googleCalendarEventId, eventData);
    } else {
      const eventId = await createCalendarEvent(user.googleRefreshToken, eventData);
      if (eventId) {
        await prisma.casoNovedad.update({ where: { id: novedadId }, data: { googleCalendarEventId: eventId } });
      }
    }
  } catch (err) {
    logger.warn('GOOGLE_CALENDAR: error al sincronizar evento', { novedadId, error: (err as Error).message });
  }
}

export async function getNovedadesByCaso(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { casoId } = req.params;
    const { id: userId, role } = req.user!;

    const caso = await checkCasoAccess(casoId, userId, role);
    if (!caso) {
      res.status(404).json({ error: 'Caso no encontrado o acceso denegado' });
      return;
    }

    const novedades = await prisma.casoNovedad.findMany({
      where: { casoId, active: true },
      include: novedadInclude,
      orderBy: { fecha: 'desc' },
    });

    logger.info('NOVEDADES: listado consultado', { ...actor(req), casoId, total: novedades.length });
    res.json(novedades);
  } catch (error) {
    logger.error('NOVEDADES: error al listar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Returns all scheduled novedades accessible to the user (for the dashboard calendar)
export async function getNovedadesAgendadas(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id: userId, role } = req.user!;

    let casoFilter: object;

    if (role === 'ADMIN') {
      casoFilter = {};
    } else if (role === 'ABOGADO') {
      casoFilter = { abogados: { some: { abogadoId: userId } } };
    } else {
      const client = await prisma.client.findFirst({ where: { userId } });
      if (!client) { res.json([]); return; }
      casoFilter = { clientes: { some: { clienteId: client.id } } };
    }

    const novedades = await prisma.casoNovedad.findMany({
      where: {
        active: true,
        fechaAgendada: { not: null },
        caso: { active: true, ...casoFilter },
      },
      include: novedadInclude,
      orderBy: { fechaAgendada: 'asc' },
    });

    logger.info('NOVEDADES: agendadas consultadas', { ...actor(req), total: novedades.length });
    res.json(novedades);
  } catch (error) {
    logger.error('NOVEDADES: error al listar agendadas', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createNovedad(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { casoId } = req.params;
    const { titulo, contenido, fecha, fechaAgendada } = req.body;
    const { id: userId, role } = req.user!;

    if (!titulo || !contenido || !fecha) {
      res.status(400).json({ error: 'Título, contenido y fecha son requeridos' });
      return;
    }

    const caso = await checkCasoAccess(casoId, userId, role);
    if (!caso) {
      res.status(404).json({ error: 'Caso no encontrado o acceso denegado' });
      return;
    }

    const novedad = await prisma.casoNovedad.create({
      data: {
        casoId,
        autorId: userId!,
        titulo,
        contenido,
        fecha: new Date(fecha),
        fechaAgendada: fechaAgendada ? new Date(fechaAgendada) : null,
      },
      include: novedadInclude,
    });

    if (novedad.fechaAgendada) {
      await syncToGoogleCalendar(userId!, { titulo, contenido, fechaAgendada: novedad.fechaAgendada, googleCalendarEventId: null }, caso.titulo, novedad.id);
    }

    logger.info('NOVEDADES: creada', { ...actor(req), novedadId: novedad.id, casoId });
    res.status(201).json(novedad);
  } catch (error) {
    logger.error('NOVEDADES: error al crear', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateNovedad(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { titulo, contenido, fecha, fechaAgendada } = req.body;
    const { id: userId, role } = req.user!;

    const existing = await prisma.casoNovedad.findUnique({ where: { id }, include: { caso: { select: { titulo: true } } } });
    if (!existing || !existing.active) {
      res.status(404).json({ error: 'Novedad no encontrada' });
      return;
    }

    if (role === 'ABOGADO' && existing.autorId !== userId) {
      res.status(403).json({ error: 'Solo podés editar tus propias novedades' });
      return;
    }

    const newFechaAgendada = fechaAgendada === null ? null : fechaAgendada ? new Date(fechaAgendada) : undefined;

    const updated = await prisma.casoNovedad.update({
      where: { id },
      data: {
        ...(titulo !== undefined && { titulo }),
        ...(contenido !== undefined && { contenido }),
        ...(fecha !== undefined && { fecha: new Date(fecha) }),
        ...(fechaAgendada !== undefined && { fechaAgendada: newFechaAgendada }),
        // If fechaAgendada is removed, clear the Google Calendar event ID too
        ...(fechaAgendada === null && { googleCalendarEventId: null }),
      },
      include: novedadInclude,
    });

    // Handle Google Calendar sync
    if (updated.fechaAgendada) {
      const finalTitulo = titulo ?? existing.titulo;
      const finalContenido = contenido ?? existing.contenido;
      await syncToGoogleCalendar(
        userId!,
        { titulo: finalTitulo, contenido: finalContenido, fechaAgendada: updated.fechaAgendada, googleCalendarEventId: existing.googleCalendarEventId },
        existing.caso.titulo,
        id
      );
    } else if (fechaAgendada === null && existing.googleCalendarEventId) {
      // Agenda removed — delete from Google Calendar
      try {
        const user = await prisma.user.findUnique({ where: { id: userId! }, select: { googleRefreshToken: true } });
        if (user?.googleRefreshToken) {
          await deleteCalendarEvent(user.googleRefreshToken, existing.googleCalendarEventId);
        }
      } catch (err) {
        logger.warn('GOOGLE_CALENDAR: error al eliminar evento', { novedadId: id, error: (err as Error).message });
      }
    }

    logger.info('NOVEDADES: modificada', { ...actor(req), novedadId: id });
    res.json(updated);
  } catch (error) {
    logger.error('NOVEDADES: error al modificar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteNovedad(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { id: userId, role } = req.user!;

    const existing = await prisma.casoNovedad.findUnique({ where: { id } });
    if (!existing || !existing.active) {
      res.status(404).json({ error: 'Novedad no encontrada' });
      return;
    }

    if (role === 'ABOGADO' && existing.autorId !== userId) {
      res.status(403).json({ error: 'Solo podés eliminar tus propias novedades' });
      return;
    }

    // Delete Google Calendar event if exists
    if (existing.googleCalendarEventId) {
      try {
        const user = await prisma.user.findUnique({ where: { id: userId! }, select: { googleRefreshToken: true } });
        if (user?.googleRefreshToken) {
          await deleteCalendarEvent(user.googleRefreshToken, existing.googleCalendarEventId);
        }
      } catch (err) {
        logger.warn('GOOGLE_CALENDAR: error al eliminar evento', { novedadId: id, error: (err as Error).message });
      }
    }

    await prisma.casoNovedad.update({ where: { id }, data: { active: false } });

    logger.info('NOVEDADES: eliminada', { ...actor(req), novedadId: id });
    res.json({ message: 'Novedad eliminada correctamente' });
  } catch (error) {
    logger.error('NOVEDADES: error al eliminar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}
