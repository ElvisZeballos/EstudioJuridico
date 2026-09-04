import { logger } from '../../config/logger';
import * as juzgadosRepository from './juzgados.repository';

export async function getAll() {
  return juzgadosRepository.findAll();
}

export async function getById(id: string, actorLog: object) {
  const juzgado = await juzgadosRepository.findById(id);
  if (!juzgado || !juzgado.active) {
    logger.warn('JUZGADOS: no encontrado', { ...actorLog, juzgadoId: id });
    return { error: 'Juzgado not found', status: 404 as const };
  }
  return { juzgado };
}

export async function create(
  data: { nombre: string; tipo?: string; direccion?: string; ciudad?: string; telefono?: string; notas?: string },
  actorLog: object
) {
  if (!data.nombre) {
    logger.warn('JUZGADOS: creación fallida, nombre requerido', actorLog);
    return { error: 'El nombre es requerido', status: 400 as const };
  }

  const juzgado = await juzgadosRepository.create({
    nombre: data.nombre,
    tipo: data.tipo || null,
    direccion: data.direccion || null,
    ciudad: data.ciudad || null,
    telefono: data.telefono || null,
    notas: data.notas || null,
  });

  logger.info('JUZGADOS: creado', { ...actorLog, juzgadoId: juzgado.id, nombre: juzgado.nombre });
  return { juzgado };
}

export async function update(
  id: string,
  data: { nombre?: string; tipo?: string; direccion?: string; ciudad?: string; telefono?: string; notas?: string },
  actorLog: object
) {
  const existing = await juzgadosRepository.findById(id);
  if (!existing || !existing.active) {
    logger.warn('JUZGADOS: no encontrado para modificar', { ...actorLog, juzgadoId: id });
    return { error: 'Juzgado not found', status: 404 as const };
  }

  const updateData: Record<string, unknown> = {
    ...(data.nombre !== undefined && { nombre: data.nombre }),
    ...(data.tipo !== undefined && { tipo: data.tipo }),
    ...(data.direccion !== undefined && { direccion: data.direccion }),
    ...(data.ciudad !== undefined && { ciudad: data.ciudad }),
    ...(data.telefono !== undefined && { telefono: data.telefono }),
    ...(data.notas !== undefined && { notas: data.notas }),
  };

  const updated = await juzgadosRepository.update(id, updateData);
  logger.info('JUZGADOS: modificado', { ...actorLog, juzgadoId: id, camposModificados: Object.keys(updateData) });
  return { juzgado: updated };
}

export async function deactivate(id: string, actorLog: object) {
  const existing = await juzgadosRepository.findById(id);
  if (!existing || !existing.active) {
    logger.warn('JUZGADOS: no encontrado para eliminar', { ...actorLog, juzgadoId: id });
    return { error: 'Juzgado not found', status: 404 as const };
  }

  const casosVinculados = await juzgadosRepository.countCasos(id);
  if (casosVinculados > 0) {
    logger.warn('JUZGADOS: eliminación bloqueada, tiene casos vinculados', { ...actorLog, juzgadoId: id, casosVinculados });
    return {
      error: `No se puede eliminar: hay ${casosVinculados} caso${casosVinculados !== 1 ? 's' : ''} vinculado${casosVinculados !== 1 ? 's' : ''} a este juzgado.`,
      status: 409 as const,
    };
  }

  await juzgadosRepository.deactivate(id);
  logger.info('JUZGADOS: eliminado', { ...actorLog, juzgadoId: id, nombre: existing.nombre });
  return {};
}
