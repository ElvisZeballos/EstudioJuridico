import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../config/logger';

const prisma = new PrismaClient();

function actor(req: AuthRequest) {
  return {
    actorId: req.user?.id,
    actorEmail: req.user?.email,
    actorRole: req.user?.role,
    ip: req.ip || req.socket.remoteAddress,
  };
}

const casoInclude = {
  abogados: {
    include: {
      abogado: { select: { id: true, nombre: true, apellido: true, email: true } },
    },
  },
  clientes: {
    include: {
      cliente: {
        include: {
          user: { select: { nombre: true, apellido: true, email: true } },
        },
      },
    },
  },
  juzgado: { select: { id: true, nombre: true, ciudad: true } },
  abogadosContraparte: {
    select: { id: true, nombre: true, direccion: true, telefono: true },
    orderBy: { createdAt: 'asc' as const },
  },
  demandados: {
    select: { id: true, nombre: true, domicilio: true, carnet: true, telefono: true },
    orderBy: { createdAt: 'asc' as const },
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformCaso(caso: any) {
  return {
    ...caso,
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

const ESTADO_LABELS: Record<string, string> = {
  ACTIVO: 'Activo',
  PENDIENTE: 'Pendiente',
  CONCLUIDO: 'Concluido',
  ARCHIVADO: 'Archivado',
};

export async function getAllCasos(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { role, id: userId } = req.user!;

    let where: Record<string, unknown> = { active: true };

    if (role === 'ABOGADO') {
      where = { active: true, abogados: { some: { abogadoId: userId } } };
    } else if (role === 'CLIENTE') {
      const client = await prisma.client.findFirst({ where: { userId } });
      if (!client) {
        res.json([]);
        return;
      }
      where = { active: true, clientes: { some: { clienteId: client.id } } };
    }

    const casos = await prisma.caso.findMany({
      where,
      include: casoInclude,
      orderBy: { createdAt: 'desc' },
    });

    logger.info('CASOS: listado consultado', { ...actor(req), total: casos.length });
    res.json(casos.map(transformCaso));
  } catch (error) {
    logger.error('CASOS: error al listar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getCasoById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user!;

    const caso = await prisma.caso.findUnique({ where: { id }, include: casoInclude });

    if (!caso || !caso.active) {
      res.status(404).json({ error: 'Caso no encontrado' });
      return;
    }

    if (role === 'ABOGADO') {
      const isAssigned = caso.abogados.some((a) => a.abogadoId === userId);
      if (!isAssigned) {
        res.status(403).json({ error: 'Acceso denegado' });
        return;
      }
    } else if (role === 'CLIENTE') {
      const client = await prisma.client.findFirst({ where: { userId } });
      const isAssigned = client && caso.clientes.some((c) => c.clienteId === client.id);
      if (!isAssigned) {
        res.status(403).json({ error: 'Acceso denegado' });
        return;
      }
    }

    logger.info('CASOS: consultado', { ...actor(req), casoId: id });
    res.json(transformCaso(caso));
  } catch (error) {
    logger.error('CASOS: error al consultar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getCasoHistorial(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user!;

    const caso = await prisma.caso.findUnique({ where: { id }, include: { abogados: true } });
    if (!caso || !caso.active) {
      res.status(404).json({ error: 'Caso no encontrado' });
      return;
    }

    if (role === 'ABOGADO') {
      const isAssigned = caso.abogados.some((a) => a.abogadoId === userId);
      if (!isAssigned) {
        res.status(403).json({ error: 'Acceso denegado' });
        return;
      }
    }

    const historial = await prisma.casoHistorial.findMany({
      where: { casoId: id },
      include: {
        usuario: { select: { id: true, nombre: true, apellido: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(historial);
  } catch (error) {
    logger.error('CASOS: error al consultar historial', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createCaso(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { titulo, descripcion, estado, numero, fechaInicio, fechaCierre, notas, abogadoIds, clienteIds, juzgadoId, abogadosContraparte, demandados } = req.body;

    if (!titulo) {
      res.status(400).json({ error: 'El título es requerido' });
      return;
    }
    if (!abogadoIds || !Array.isArray(abogadoIds) || abogadoIds.length === 0) {
      res.status(400).json({ error: 'Se requiere al menos un abogado' });
      return;
    }
    if (!clienteIds || !Array.isArray(clienteIds) || clienteIds.length === 0) {
      res.status(400).json({ error: 'Se requiere al menos un cliente' });
      return;
    }

    const abogadosContraparteData = Array.isArray(abogadosContraparte)
      ? abogadosContraparte.filter((a: { nombre?: string }) => a.nombre)
      : [];
    const demandadosData = Array.isArray(demandados)
      ? demandados.filter((d: { nombre?: string }) => d.nombre)
      : [];

    const caso = await prisma.caso.create({
      data: {
        titulo,
        descripcion: descripcion || null,
        estado: estado || 'ACTIVO',
        numero: numero || null,
        fechaInicio: fechaInicio ? new Date(fechaInicio) : null,
        fechaCierre: fechaCierre ? new Date(fechaCierre) : null,
        notas: notas || null,
        juzgadoId: juzgadoId || null,
        abogados: { create: abogadoIds.map((abogadoId: string) => ({ abogadoId })) },
        clientes: { create: clienteIds.map((clienteId: string) => ({ clienteId })) },
        abogadosContraparte: abogadosContraparteData.length > 0 ? { create: abogadosContraparteData } : undefined,
        demandados: demandadosData.length > 0 ? { create: demandadosData } : undefined,
      },
      include: casoInclude,
    });

    logger.info('CASOS: creado', { ...actor(req), casoId: caso.id, titulo: caso.titulo });
    res.status(201).json(transformCaso(caso));
  } catch (error) {
    logger.error('CASOS: error al crear', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateCaso(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { titulo, descripcion, estado, numero, fechaInicio, fechaCierre, notas, abogadoIds, clienteIds, juzgadoId, abogadosContraparte, demandados } = req.body;
    const { role, id: userId } = req.user!;

    const existing = await prisma.caso.findUnique({ where: { id }, include: casoInclude });
    if (!existing || !existing.active) {
      res.status(404).json({ error: 'Caso no encontrado' });
      return;
    }

    if (role === 'ABOGADO') {
      const isAssigned = existing.abogados.some((a) => a.abogadoId === userId);
      if (!isAssigned) {
        res.status(403).json({ error: 'Acceso denegado' });
        return;
      }
    }

    // Detect changes for audit trail
    const changes: Array<{ campo: string; valorAntes: string | null; valorDespues: string | null }> = [];

    if (estado !== undefined && estado !== existing.estado) {
      changes.push({
        campo: 'Estado',
        valorAntes: ESTADO_LABELS[existing.estado] ?? existing.estado,
        valorDespues: ESTADO_LABELS[estado] ?? estado,
      });
    }

    if (numero !== undefined && (numero || null) !== existing.numero) {
      changes.push({
        campo: 'Nurej',
        valorAntes: existing.numero ?? null,
        valorDespues: numero || null,
      });
    }

    if (juzgadoId !== undefined && (juzgadoId || null) !== existing.juzgadoId) {
      const [anteriorJuzgado, nuevoJuzgado] = await Promise.all([
        existing.juzgadoId
          ? prisma.juzgado.findUnique({ where: { id: existing.juzgadoId }, select: { nombre: true } })
          : null,
        juzgadoId
          ? prisma.juzgado.findUnique({ where: { id: juzgadoId }, select: { nombre: true } })
          : null,
      ]);
      changes.push({
        campo: 'Juzgado',
        valorAntes: anteriorJuzgado?.nombre ?? null,
        valorDespues: nuevoJuzgado?.nombre ?? null,
      });
    }

    if (abogadoIds && Array.isArray(abogadoIds)) {
      const anteriorIds = existing.abogados.map((a) => a.abogadoId).sort();
      const nuevoIds = [...abogadoIds].sort();
      if (JSON.stringify(anteriorIds) !== JSON.stringify(nuevoIds)) {
        const [anteriorUsers, nuevoUsers] = await Promise.all([
          prisma.user.findMany({ where: { id: { in: anteriorIds } }, select: { nombre: true, apellido: true } }),
          prisma.user.findMany({ where: { id: { in: nuevoIds } }, select: { nombre: true, apellido: true } }),
        ]);
        changes.push({
          campo: 'Abogados',
          valorAntes: anteriorUsers.map((u) => `${u.nombre} ${u.apellido}`).join(', ') || null,
          valorDespues: nuevoUsers.map((u) => `${u.nombre} ${u.apellido}`).join(', ') || null,
        });
      }
    }

    const updateData: Record<string, unknown> = {
      ...(titulo !== undefined && { titulo }),
      ...(descripcion !== undefined && { descripcion }),
      ...(estado !== undefined && { estado }),
      ...(numero !== undefined && { numero: numero || null }),
      ...(fechaInicio !== undefined && { fechaInicio: fechaInicio ? new Date(fechaInicio) : null }),
      ...(fechaCierre !== undefined && { fechaCierre: fechaCierre ? new Date(fechaCierre) : null }),
      ...(notas !== undefined && { notas }),
      ...(juzgadoId !== undefined && { juzgadoId: juzgadoId || null }),
    };

    if (abogadoIds && Array.isArray(abogadoIds)) {
      await prisma.casoAbogado.deleteMany({ where: { casoId: id } });
      updateData.abogados = { create: abogadoIds.map((abogadoId: string) => ({ abogadoId })) };
    }
    if (clienteIds && Array.isArray(clienteIds)) {
      await prisma.casoCliente.deleteMany({ where: { casoId: id } });
      updateData.clientes = { create: clienteIds.map((clienteId: string) => ({ clienteId })) };
    }
    if (Array.isArray(abogadosContraparte)) {
      updateData.abogadosContraparte = {
        deleteMany: {},
        create: abogadosContraparte.filter((a: { nombre?: string }) => a.nombre),
      };
    }
    if (Array.isArray(demandados)) {
      updateData.demandados = {
        deleteMany: {},
        create: demandados.filter((d: { nombre?: string }) => d.nombre),
      };
    }

    const updated = await prisma.caso.update({ where: { id }, data: updateData, include: casoInclude });

    // Persist audit trail entries
    if (changes.length > 0) {
      await prisma.casoHistorial.createMany({
        data: changes.map((c) => ({
          casoId: id,
          usuarioId: userId!,
          campo: c.campo,
          valorAntes: c.valorAntes,
          valorDespues: c.valorDespues,
        })),
      });
    }

    logger.info('CASOS: modificado', {
      ...actor(req),
      casoId: id,
      cambios: changes.map((c) => c.campo),
    });
    res.json(transformCaso(updated));
  } catch (error) {
    logger.error('CASOS: error al modificar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteCaso(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const existing = await prisma.caso.findUnique({ where: { id } });
    if (!existing || !existing.active) {
      res.status(404).json({ error: 'Caso no encontrado' });
      return;
    }

    await prisma.caso.update({ where: { id }, data: { active: false } });

    logger.info('CASOS: eliminado', { ...actor(req), casoId: id, titulo: existing.titulo });
    res.json({ message: 'Caso eliminado correctamente' });
  } catch (error) {
    logger.error('CASOS: error al eliminar', { ...actor(req), error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}
