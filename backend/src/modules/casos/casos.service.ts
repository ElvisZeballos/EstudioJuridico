import { CasoEstado } from '@prisma/client';
import { logger } from '../../config/logger';
import * as casosRepository from './casos.repository';

const ESTADO_LABELS: Record<string, string> = {
  ACTIVO: 'Activo',
  PENDIENTE: 'Pendiente',
  CONCLUIDO: 'Concluido',
  ARCHIVADO: 'Archivado',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformCaso(caso: any) {
  return {
    ...caso,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    clientes: caso.clientes.map((cl: any) => ({
      ...cl,
      cliente: {
        id: cl.cliente.id,
        nombre: cl.cliente.user.nombre,
        apellido: cl.cliente.user.apellido,
        email: cl.cliente.user.email,
      },
    })),
  };
}

export async function getAll(userId: string, role: string) {
  let where: Record<string, unknown> = { active: true };

  if (role === 'ABOGADO') {
    where = { active: true, abogados: { some: { abogadoId: userId } } };
  } else if (role === 'CLIENTE') {
    const client = await casosRepository.findClientByUserId(userId);
    if (!client) return [];
    where = { active: true, clientes: { some: { clienteId: client.id } } };
  } else if (role === 'AUXILIAR') {
    const { getAbogadosByAuxiliar } = await import('../../modules/users/users.repository');
    const abogadoIds = await getAbogadosByAuxiliar(userId);
    if (abogadoIds.length === 0) return [];
    where = { active: true, abogados: { some: { abogadoId: { in: abogadoIds } } } };
  }

  const casos = await casosRepository.findAll(where);
  return casos.map(transformCaso);
}

export async function getById(id: string, userId: string, role: string) {
  const caso = await casosRepository.findById(id);
  if (!caso || !caso.active) return { error: 'Caso no encontrado', status: 404 as const };

  if (role === 'ABOGADO') {
    const isAssigned = caso.abogados.some((a) => a.abogadoId === userId);
    if (!isAssigned) return { error: 'Acceso denegado', status: 403 as const };
  } else if (role === 'CLIENTE') {
    const client = await casosRepository.findClientByUserId(userId);
    const isAssigned = client && caso.clientes.some((c) => c.clienteId === client.id);
    if (!isAssigned) return { error: 'Acceso denegado', status: 403 as const };
  } else if (role === 'AUXILIAR') {
    const { getAbogadosByAuxiliar } = await import('../../modules/users/users.repository');
    const abogadoIds = await getAbogadosByAuxiliar(userId);
    const isAssigned = caso.abogados.some((a) => abogadoIds.includes(a.abogadoId));
    if (!isAssigned) return { error: 'Acceso denegado', status: 403 as const };
  }

  return { caso: transformCaso(caso) };
}

export async function getHistorial(id: string, userId: string, role: string) {
  const caso = await casosRepository.findByIdWithAbogados(id);
  if (!caso || !caso.active) return { error: 'Caso no encontrado', status: 404 as const };

  if (role === 'ABOGADO') {
    const isAssigned = caso.abogados.some((a) => a.abogadoId === userId);
    if (!isAssigned) return { error: 'Acceso denegado', status: 403 as const };
  }

  const historial = await casosRepository.findHistorial(id);
  return { historial };
}

export async function create(
  data: {
    titulo: string; descripcion?: string; estado?: string; numero?: string;
    fechaInicio?: string; fechaCierre?: string; notas?: string;
    abogadoIds: string[]; clienteIds: string[]; juzgadoId?: string;
    abogadosContraparte?: { nombre: string }[];
    demandados?: { nombre: string }[];
  },
  actorLog: object
) {
  const { titulo, descripcion, estado, numero, fechaInicio, fechaCierre, notas, abogadoIds, clienteIds, juzgadoId, abogadosContraparte, demandados } = data;

  if (!titulo) return { error: 'El título es requerido', status: 400 as const };
  if (!abogadoIds?.length) return { error: 'Se requiere al menos un abogado', status: 400 as const };
  if (!clienteIds?.length) return { error: 'Se requiere al menos un cliente', status: 400 as const };

  const abogadosContraparteData = Array.isArray(abogadosContraparte)
    ? abogadosContraparte.filter((a) => a.nombre)
    : [];
  const demandadosData = Array.isArray(demandados)
    ? demandados.filter((d) => d.nombre)
    : [];

  const caso = await casosRepository.create({
    titulo,
    descripcion: descripcion || null,
    estado: (estado || 'ACTIVO') as CasoEstado,
    numero: numero || null,
    fechaInicio: fechaInicio ? new Date(fechaInicio) : null,
    fechaCierre: fechaCierre ? new Date(fechaCierre) : null,
    notas: notas || null,
    juzgadoId: juzgadoId || null,
    abogados: { create: abogadoIds.map((abogadoId: string) => ({ abogadoId })) },
    clientes: { create: clienteIds.map((clienteId: string) => ({ clienteId })) },
    abogadosContraparte: abogadosContraparteData.length > 0 ? { create: abogadosContraparteData } : undefined,
    demandados: demandadosData.length > 0 ? { create: demandadosData } : undefined,
  });

  logger.info('CASOS: creado', { ...actorLog, casoId: caso.id, titulo: caso.titulo });
  return { caso: transformCaso(caso) };
}

async function buildHistorialChanges(existing: NonNullable<Awaited<ReturnType<typeof casosRepository.findById>>>, data: Record<string, unknown>) {
  const changes: Array<{ campo: string; valorAntes: string | null; valorDespues: string | null }> = [];
  const { estado, numero, juzgadoId, abogadoIds } = data;

  if (estado !== undefined && estado !== existing.estado) {
    changes.push({
      campo: 'Estado',
      valorAntes: ESTADO_LABELS[existing.estado] ?? existing.estado,
      valorDespues: ESTADO_LABELS[estado as string] ?? (estado as string),
    });
  }

  if (numero !== undefined && ((numero as string) || null) !== existing.numero) {
    changes.push({ campo: 'Nurej', valorAntes: existing.numero ?? null, valorDespues: (numero as string) || null });
  }

  if (juzgadoId !== undefined && ((juzgadoId as string) || null) !== existing.juzgadoId) {
    const [anteriorJuzgado, nuevoJuzgado] = await Promise.all([
      existing.juzgadoId ? casosRepository.findJuzgado(existing.juzgadoId) : null,
      juzgadoId ? casosRepository.findJuzgado(juzgadoId as string) : null,
    ]);
    changes.push({
      campo: 'Juzgado',
      valorAntes: anteriorJuzgado?.nombre ?? null,
      valorDespues: nuevoJuzgado?.nombre ?? null,
    });
  }

  if (abogadoIds && Array.isArray(abogadoIds)) {
    const anteriorIds = existing.abogados.map((a) => a.abogadoId).sort();
    const nuevoIds = [...(abogadoIds as string[])].sort();
    if (JSON.stringify(anteriorIds) !== JSON.stringify(nuevoIds)) {
      const [anteriorUsers, nuevoUsers] = await Promise.all([
        casosRepository.findUsersByIds(anteriorIds),
        casosRepository.findUsersByIds(nuevoIds),
      ]);
      changes.push({
        campo: 'Abogados',
        valorAntes: anteriorUsers.map((u) => `${u.nombre} ${u.apellido}`).join(', ') || null,
        valorDespues: nuevoUsers.map((u) => `${u.nombre} ${u.apellido}`).join(', ') || null,
      });
    }
  }

  return changes;
}

export async function update(
  id: string,
  userId: string,
  role: string,
  data: Record<string, unknown>,
  actorLog: object
) {
  const existing = await casosRepository.findById(id);
  if (!existing || !existing.active) return { error: 'Caso no encontrado', status: 404 as const };

  if (role === 'ABOGADO') {
    const isAssigned = existing.abogados.some((a) => a.abogadoId === userId);
    if (!isAssigned) return { error: 'Acceso denegado', status: 403 as const };
  }

  const { titulo, descripcion, estado, numero, fechaInicio, fechaCierre, notas, abogadoIds, clienteIds, juzgadoId, abogadosContraparte, demandados } = data;

  const changes = await buildHistorialChanges(existing, data);

  const updateData: Record<string, unknown> = {
    ...(titulo !== undefined && { titulo }),
    ...(descripcion !== undefined && { descripcion }),
    ...(estado !== undefined && { estado }),
    ...(numero !== undefined && { numero: (numero as string) || null }),
    ...(fechaInicio !== undefined && { fechaInicio: fechaInicio ? new Date(fechaInicio as string) : null }),
    ...(fechaCierre !== undefined && { fechaCierre: fechaCierre ? new Date(fechaCierre as string) : null }),
    ...(notas !== undefined && { notas }),
    ...(juzgadoId !== undefined && { juzgadoId: (juzgadoId as string) || null }),
  };

  if (abogadoIds && Array.isArray(abogadoIds)) {
    await casosRepository.deleteAbogados(id);
    updateData.abogados = { create: (abogadoIds as string[]).map((abogadoId) => ({ abogadoId })) };
  }
  if (clienteIds && Array.isArray(clienteIds)) {
    await casosRepository.deleteClientes(id);
    updateData.clientes = { create: (clienteIds as string[]).map((clienteId) => ({ clienteId })) };
  }
  if (Array.isArray(abogadosContraparte)) {
    updateData.abogadosContraparte = {
      deleteMany: {},
      create: (abogadosContraparte as { nombre?: string }[]).filter((a) => a.nombre),
    };
  }
  if (Array.isArray(demandados)) {
    updateData.demandados = {
      deleteMany: {},
      create: (demandados as { nombre?: string }[]).filter((d) => d.nombre),
    };
  }

  const updated = await casosRepository.update(id, updateData);

  if (changes.length > 0) {
    await casosRepository.createHistorialEntries(
      changes.map((c) => ({ casoId: id, usuarioId: userId, campo: c.campo, valorAntes: c.valorAntes, valorDespues: c.valorDespues }))
    );
  }

  logger.info('CASOS: modificado', { ...actorLog, casoId: id, cambios: changes.map((c) => c.campo) });
  return { caso: transformCaso(updated) };
}

export async function deactivate(id: string, actorLog: object) {
  const existing = await casosRepository.findByIdWithAbogados(id);
  if (!existing || !existing.active) return { error: 'Caso no encontrado', status: 404 as const };

  await casosRepository.deactivate(id);
  logger.info('CASOS: eliminado', { ...actorLog, casoId: id });
  return {};
}
