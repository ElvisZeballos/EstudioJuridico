import prisma from './prisma';

const BOLIVIA_TZ = 'America/La_Paz';

/** Clave "AAAA-MM-DD" de una fecha, según la zona horaria de Bolivia — sin
 *  depender de en qué huso horario esté corriendo el servidor (Railway corre
 *  en UTC). Bolivia no tiene horario de verano, así que el offset es fijo. */
function toYMD(fecha: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BOLIVIA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha);
}

/** Día de la semana (0=domingo ... 6=sábado) según la zona horaria de Bolivia. */
function diaSemanaBolivia(fecha: Date): number {
  const dias = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const abrev = new Intl.DateTimeFormat('en-US', { timeZone: BOLIVIA_TZ, weekday: 'short' }).format(fecha);
  return dias.indexOf(abrev);
}

let configCache: { trasladoJuevesAViernes: boolean; trasladoDomingoALunes: boolean } | null = null;
let feriadosCache: Set<string> | null = null;

/** Limpia el cache en memoria — llamar después de agregar/editar feriados o
 *  cambiar la configuración de reglas, para que el cambio se refleje al toque. */
export function limpiarCacheFeriados(): void {
  configCache = null;
  feriadosCache = null;
}

async function getConfiguracion() {
  if (configCache) return configCache;
  let config = await (prisma as any).configuracionFeriados.findFirst();
  if (!config) {
    config = await (prisma as any).configuracionFeriados.create({ data: {} });
  }
  configCache = config;
  return config;
}

async function getFeriadosBase(): Promise<Set<string>> {
  if (feriadosCache) return feriadosCache;
  const feriados = await (prisma as any).feriado.findMany();
  feriadosCache = new Set(feriados.map((f: { fecha: Date }) => toYMD(f.fecha)));
  return feriadosCache;
}

/** ¿Es feriado esta fecha? Contempla los feriados base cargados en la tabla,
 *  más las reglas de traslado activadas (jueves→viernes, domingo→lunes). */
export async function esFeriado(fecha: Date): Promise<boolean> {
  const [config, feriadosBase] = await Promise.all([getConfiguracion(), getFeriadosBase()]);
  const ymd = toYMD(fecha);

  if (feriadosBase.has(ymd)) return true;

  const dow = diaSemanaBolivia(fecha);

  if (config.trasladoJuevesAViernes && dow === 5) {
    const jueves = new Date(fecha);
    jueves.setUTCDate(jueves.getUTCDate() - 1);
    if (feriadosBase.has(toYMD(jueves))) return true;
  }

  if (config.trasladoDomingoALunes && dow === 1) {
    const domingo = new Date(fecha);
    domingo.setUTCDate(domingo.getUTCDate() - 1);
    if (feriadosBase.has(toYMD(domingo))) return true;
  }

  return false;
}

/** ¿Es día hábil? (no es sábado, ni domingo, ni feriado) */
export async function esDiaHabil(fecha: Date): Promise<boolean> {
  const dow = diaSemanaBolivia(fecha);
  if (dow === 0 || dow === 6) return false;
  return !(await esFeriado(fecha));
}

/** Suma `dias` días HÁBILES a partir de `fechaInicio` (sin contar el propio
 *  día de inicio), saltando fines de semana y feriados. */
export async function sumarDiasHabiles(fechaInicio: Date, dias: number): Promise<Date> {
  const resultado = new Date(fechaInicio);
  let contados = 0;
  while (contados < dias) {
    resultado.setUTCDate(resultado.getUTCDate() + 1);
    if (await esDiaHabil(resultado)) contados++;
  }
  return resultado;
}

/** Suma `dias` días CORRIDOS (calendario, sin saltar nada) a partir de `fechaInicio`. */
export function sumarDiasCorridos(fechaInicio: Date, dias: number): Date {
  const resultado = new Date(fechaInicio);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return resultado;
}