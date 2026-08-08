import { logger } from '../../config/logger';
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from '../../infrastructure/googleCalendar';
import * as novedadesRepository from './novedades.repository';
import { getEstadoEfectivo } from '../../shared/casoEstado';

/**
 * Convierte un string "AAAA-MM-DDTHH:mm" (sin zona horaria, del input datetime-local)
 * a un Date real, anclado siempre a Bolivia (UTC-4 fijo, sin horario de verano) —
 * sin depender de la zona horaria configurada en el servidor.
 */
function parseBoliviaDatetime(naive: string): Date {
  return new Date(`${naive}:00-04:00`);
}

async function buildCasoFilter(userId: string, role: string): Promise<object | null> {
  if (role === 'ADMIN') return {};
  if (role === 'ABOGADO') return { abogados: { some: { abogadoId: userId } } };

  const client = await novedadesRepository.findClientByUserId(userId);
  if (!client) return null;
  return { clientes: { some: { clienteId: client.id } } };
}

async function syncToGoogleCalendar(
  userId: string,
  novedad: { titulo: string; contenido: string; fechaAgendada: Date; googleCalendarEventId?: string | null },
  casoTitulo: string,
  novedadId: string
) {
  try {
    const user = await novedadesRepository.findUserRefreshToken(userId);
    if (!user?.googleRefreshToken) return;

    const eventData = { titulo: novedad.titulo, contenido: novedad.contenido, fechaAgendada: novedad.fechaAgendada, casoTitulo };

    if (novedad.googleCalendarEventId) {
      await updateCalendarEvent(user.googleRefreshToken, novedad.googleCalendarEventId, eventData);
    } else {
      const eventId = await createCalendarEvent(user.googleRefreshToken, eventData);
      if (eventId) {
        await novedadesRepository.update(novedadId, { googleCalendarEventId: eventId });
      }
    }
  } catch (err) {
    logger.warn('GOOGLE_CALENDAR: error al sincronizar evento', { novedadId, error: (err as Error).message });
  }
}

export async function getAgendadas(userId: string, role: string) {
  const casoFilter = await buildCasoFilter(userId, role);
  if (casoFilter === null) return [];
  return novedadesRepository.findAgendadas(casoFilter);
}

export async function getNotificaciones(userId: string, role: string) {
  const casoFilter = await buildCasoFilter(userId, role);
  if (casoFilter === null) return [];
  return novedadesRepository.findNotificaciones(casoFilter);
}

export async function getByCaso(casoId: string, userId: string, role: string) {
  const caso = await novedadesRepository.findCasoWithAccess(casoId);
  if (!caso || !caso.active) return { error: 'Caso no encontrado o acceso denegado', status: 404 as const };

  if (role === 'ABOGADO' && !caso.abogados.some((a) => a.abogadoId === userId)) {
    return { error: 'Caso no encontrado o acceso denegado', status: 404 as const };
  }
  if (role === 'CLIENTE') {
    const client = await novedadesRepository.findClientByUserId(userId);
    if (!client || !caso.clientes.some((c) => c.clienteId === client.id)) {
      return { error: 'Caso no encontrado o acceso denegado', status: 404 as const };
    }
  }

  const novedades = await novedadesRepository.findByCaso(casoId);
  return { novedades };
}

export async function create(
  casoId: string,
  userId: string,
  role: string,
  data: { titulo: string; contenido: string; fecha: string; fechaAgendada?: string },
  actorLog: object
) {
  const { titulo, contenido, fecha, fechaAgendada } = data;
  if (!titulo || !contenido || !fecha) {
    return { error: 'Título, contenido y fecha son requeridos', status: 400 as const };
  }

  const caso = await novedadesRepository.findCasoWithAccess(casoId);
  if (!caso || !caso.active) return { error: 'Caso no encontrado o acceso denegado', status: 404 as const };

  if (role === 'ABOGADO' && !caso.abogados.some((a) => a.abogadoId === userId)) {
    return { error: 'Caso no encontrado o acceso denegado', status: 404 as const };
  }

  const estadoEfectivo = getEstadoEfectivo(caso.estado, caso.fechaCierre);
  if (estadoEfectivo === 'CONCLUIDO' || estadoEfectivo === 'ARCHIVADO') {
    return { error: 'No se pueden agregar novedades a un caso concluido o archivado.', status: 400 as const };
  }
  if (caso.fechaCierre && fecha > caso.fechaCierre.toISOString().slice(0, 10)) {
    return { error: 'No se pueden agregar novedades posteriores a la fecha de cierre del caso.', status: 400 as const };
  }

  const novedad = await novedadesRepository.create({
    casoId, autorId: userId, titulo, contenido,
    fecha: new Date(fecha),
    fechaAgendada: fechaAgendada ? parseBoliviaDatetime(fechaAgendada) : null,
  });

  if (novedad.fechaAgendada) {
    await syncToGoogleCalendar(
      userId,
      { titulo, contenido, fechaAgendada: novedad.fechaAgendada, googleCalendarEventId: null },
      caso.titulo,
      novedad.id
    );
  }

  logger.info('NOVEDADES: creada', { ...actorLog, novedadId: novedad.id, casoId });
  return { novedad };
}

export async function update(
  id: string,
  userId: string,
  role: string,
  data: { titulo?: string; contenido?: string; fecha?: string; fechaAgendada?: string | null },
  actorLog: object
) {
  const existing = await novedadesRepository.findById(id);
  if (!existing || !existing.active) return { error: 'Novedad no encontrada', status: 404 as const };

  if (role === 'ABOGADO' && existing.autorId !== userId) {
    return { error: 'Solo podés editar tus propias novedades', status: 403 as const };
  }

  const { titulo, contenido, fecha, fechaAgendada } = data;
  const newFechaAgendada = fechaAgendada === null ? null : fechaAgendada ? parseBoliviaDatetime(fechaAgendada) : undefined;

  const updated = await novedadesRepository.update(id, {
    ...(titulo !== undefined && { titulo }),
    ...(contenido !== undefined && { contenido }),
    ...(fecha !== undefined && { fecha: new Date(fecha) }),
    ...(fechaAgendada !== undefined && { fechaAgendada: newFechaAgendada }),
    ...(fechaAgendada === null && { googleCalendarEventId: null }),
  });

  if (updated.fechaAgendada) {
    await syncToGoogleCalendar(
      userId,
      {
        titulo: titulo ?? existing.titulo,
        contenido: contenido ?? existing.contenido,
        fechaAgendada: updated.fechaAgendada,
        googleCalendarEventId: existing.googleCalendarEventId,
      },
      existing.caso.titulo,
      id
    );
  } else if (fechaAgendada === null && existing.googleCalendarEventId) {
    try {
      const user = await novedadesRepository.findUserRefreshToken(userId);
      if (user?.googleRefreshToken) {
        await deleteCalendarEvent(user.googleRefreshToken, existing.googleCalendarEventId);
      }
    } catch (err) {
      logger.warn('GOOGLE_CALENDAR: error al eliminar evento', { novedadId: id, error: (err as Error).message });
    }
  }

  logger.info('NOVEDADES: modificada', { ...actorLog, novedadId: id });
  return { novedad: updated };
}

export async function deactivate(id: string, userId: string, role: string, actorLog: object) {
  const existing = await novedadesRepository.findById(id);
  if (!existing || !existing.active) return { error: 'Novedad no encontrada', status: 404 as const };

  if (role === 'ABOGADO' && existing.autorId !== userId) {
    return { error: 'Solo podés eliminar tus propias novedades', status: 403 as const };
  }

  if (existing.googleCalendarEventId) {
    try {
      const user = await novedadesRepository.findUserRefreshToken(userId);
      if (user?.googleRefreshToken) {
        await deleteCalendarEvent(user.googleRefreshToken, existing.googleCalendarEventId);
      }
    } catch (err) {
      logger.warn('GOOGLE_CALENDAR: error al eliminar evento', { novedadId: id, error: (err as Error).message });
    }
  }

  await novedadesRepository.deactivate(id);
  logger.info('NOVEDADES: eliminada', { ...actorLog, novedadId: id });
  return {};
}
