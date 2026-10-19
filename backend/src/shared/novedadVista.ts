import prisma from './prisma';

/** Abogados a los que "representa" el usuario: él mismo si es abogado, o los que asiste si es auxiliar. */
export async function getAbogadosQueRepresenta(userId: string, role: string): Promise<string[]> {
  if (role === 'ABOGADO') return [userId];
  if (role === 'AUXILIAR') {
    const { getAbogadosByAuxiliar } = await import('../modules/users/users.repository');
    return getAbogadosByAuxiliar(userId);
  }
  return [];
}

/** De los abogados del caso, cuáles representa el usuario. */
export function alcanceEnCaso(representados: string[], abogadosDelCaso: string[]): string[] {
  return abogadosDelCaso.filter((id) => representados.includes(id));
}

/** Sin ver = algún abogado del alcance todavía no la vio. */
export function estaSinVer(alcance: string[], vistaPor: string[]): boolean {
  return alcance.length > 0 && alcance.some((id) => !vistaPor.includes(id));
}

/** Cuántas notificaciones sin ver tiene cada caso, desde el punto de vista del usuario. */
export async function contarSinVerPorCaso(
  casos: { id: string; abogados: { abogadoId: string }[] }[],
  userId: string,
  role: string
): Promise<Map<string, number>> {
  const conteo = new Map<string, number>();
  const representados = await getAbogadosQueRepresenta(userId, role);
  if (representados.length === 0 || casos.length === 0) return conteo;

  const notificaciones = await prisma.casoNovedad.findMany({
    where: { casoId: { in: casos.map((c) => c.id) }, active: true, esNotificacion: true },
    select: { casoId: true, vistas: { select: { abogadoId: true } } },
  });
  const abogadosPorCaso = new Map(casos.map((c) => [c.id, c.abogados.map((a) => a.abogadoId)]));

  for (const n of notificaciones) {
    const alcance = alcanceEnCaso(representados, abogadosPorCaso.get(n.casoId) ?? []);
    if (estaSinVer(alcance, n.vistas.map((v) => v.abogadoId))) {
      conteo.set(n.casoId, (conteo.get(n.casoId) ?? 0) + 1);
    }
  }
  return conteo;
}