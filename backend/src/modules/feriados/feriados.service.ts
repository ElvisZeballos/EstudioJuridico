import * as feriadosRepository from './feriados.repository';
import { limpiarCacheFeriados } from '../../shared/feriados';
import { logger } from '../../config/logger';

export async function getAll() {
  return feriadosRepository.findAll();
}

export async function create(
  data: { fecha?: string; nombre?: string; ambito?: string },
  actorLog: object
) {
  if (!data.fecha || !data.nombre) {
    return { error: 'La fecha y el nombre son requeridos', status: 400 as const };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.fecha)) {
    return { error: 'La fecha debe tener el formato AAAA-MM-DD', status: 400 as const };
  }
  const ambito = data.ambito === 'departamental' ? 'departamental' : 'nacional';
  // Medianoche en Bolivia = 04:00 UTC (Bolivia es UTC-4 todo el año, sin horario de verano)
  const fechaConHora = new Date(`${data.fecha}T04:00:00.000Z`);

  const existente = await feriadosRepository.findByFecha(fechaConHora);
  if (existente) {
    return { error: 'Ya existe un feriado cargado para esa fecha', status: 409 as const };
  }

  const feriado = await feriadosRepository.create({
    fecha: fechaConHora,
    nombre: data.nombre,
    ambito,
    origen: 'manual',
  });

  limpiarCacheFeriados();
  logger.info('FERIADOS: creado', { ...actorLog, feriadoId: feriado.id, fecha: data.fecha });
  return { feriado };
}

export async function deactivate(id: string, actorLog: object) {
  const existing = await feriadosRepository.findById(id);
  if (!existing) {
    return { error: 'Feriado not found', status: 404 as const };
  }
  await feriadosRepository.remove(id);
  limpiarCacheFeriados();
  logger.info('FERIADOS: eliminado', { ...actorLog, feriadoId: id });
  return {};
}

export async function getConfiguracion() {
  return feriadosRepository.getConfiguracion();
}

export async function updateConfiguracion(
  data: { trasladoJuevesAViernes?: boolean; trasladoDomingoALunes?: boolean },
  actorLog: object
) {
  const config = await feriadosRepository.getConfiguracion();
  const updated = await feriadosRepository.updateConfiguracion(config.id, data);
  limpiarCacheFeriados();
  logger.info('FERIADOS: configuración actualizada', { ...actorLog, ...data });
  return { config: updated };
}