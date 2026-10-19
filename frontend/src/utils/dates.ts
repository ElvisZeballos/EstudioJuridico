// Utilidades de fechas para filtros. Todo se interpreta en hora de Bolivia (UTC-4).
export const BOLIVIA_TZ = 'America/La_Paz';

/** 'YYYY-MM-DD' del día de Bolivia para una fecha/ISO. */
export function boliviaDayKey(value: string | Date): string {
  return new Date(value).toLocaleDateString('en-CA', { timeZone: BOLIVIA_TZ });
}

export function boliviaTodayKey(): string {
  return boliviaDayKey(new Date());
}

/** Suma (o resta) días a una clave 'YYYY-MM-DD'. */
export function addDaysKey(key: string, days: number): string {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type DatePreset = 'todas' | 'hoy' | 'ayer' | '7dias' | 'proximos7' | 'fecha';

export const DATE_PRESET_OPTIONS: { value: DatePreset; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'hoy', label: 'Hoy' },
  { value: 'ayer', label: 'Ayer' },
  { value: '7dias', label: 'Últimos 7 días' },
  { value: 'proximos7', label: 'Próximos 7 días' },
  { value: 'fecha', label: 'Elegir fecha' },
];

export interface DateRange { desde: string; hasta: string }

/** Convierte un preset (y, si es 'fecha', las fechas elegidas) en un rango 'YYYY-MM-DD'. */
export function presetToRange(preset: DatePreset, desde = '', hasta = ''): DateRange {
  const hoy = boliviaTodayKey();
  switch (preset) {
    case 'hoy': return { desde: hoy, hasta: hoy };
    case 'ayer': { const a = addDaysKey(hoy, -1); return { desde: a, hasta: a }; }
    case '7dias': return { desde: addDaysKey(hoy, -6), hasta: hoy };
    case 'proximos7': return { desde: hoy, hasta: addDaysKey(hoy, 6) };
    case 'fecha': return { desde, hasta };
    default: return { desde: '', hasta: '' };
  }
}

/** ¿El instante cae dentro del rango (por día de Bolivia)? Rango vacío = siempre sí. */
export function enRango(value: string | Date | null | undefined, desde: string, hasta: string): boolean {
  if (!desde && !hasta) return true;
  if (!value) return false;
  const k = boliviaDayKey(value);
  if (desde && k < desde) return false;
  if (hasta && k > hasta) return false;
  return true;
}

/** Igual que enRango pero para campos @db.Date (se guardan a medianoche UTC): se compara el día UTC. */
export function enRangoUtc(value: string | Date | null | undefined, desde: string, hasta: string): boolean {
  if (!desde && !hasta) return true;
  if (!value) return false;
  const k = new Date(value).toISOString().slice(0, 10);
  if (desde && k < desde) return false;
  if (hasta && k > hasta) return false;
  return true;
}
