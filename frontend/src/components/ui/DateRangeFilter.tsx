import { FilterChips } from './FilterChips';
import { DATE_PRESET_OPTIONS, boliviaTodayKey, type DatePreset } from '../../utils/dates';

interface Props {
  preset: DatePreset;
  desde: string;
  hasta: string;
  onChange: (next: { preset: DatePreset; desde: string; hasta: string }) => void;
  /** Presets a mostrar (por defecto todos). */
  presets?: DatePreset[];
  /** Permite elegir fechas futuras (para la agenda). */
  permitirFuturo?: boolean;
  className?: string;
}

const inputCls =
  'rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500';

/** Chips de fecha (Todas · Hoy · Ayer · 7 días · Elegir fecha) + selector de rango cuando se elige "Elegir fecha". */
export function DateRangeFilter({ preset, desde, hasta, onChange, presets, permitirFuturo = false, className = '' }: Props) {
  const options = presets ? DATE_PRESET_OPTIONS.filter((o) => presets.includes(o.value)) : DATE_PRESET_OPTIONS;
  const hoy = boliviaTodayKey();
  return (
    <div className={`space-y-2 ${className}`}>
      <FilterChips
        options={options}
        value={preset}
        onChange={(p) => onChange({ preset: p, desde: p === 'fecha' ? desde : '', hasta: p === 'fecha' ? hasta : '' })}
      />
      {preset === 'fecha' && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <label className="flex items-center gap-1">
            Desde
            <input
              type="date"
              value={desde}
              max={hasta || undefined}
              onChange={(e) => onChange({ preset, desde: e.target.value, hasta })}
              className={inputCls}
            />
          </label>
          <label className="flex items-center gap-1">
            Hasta
            <input
              type="date"
              value={hasta}
              min={desde || undefined}
              max={permitirFuturo ? undefined : hoy}
              onChange={(e) => onChange({ preset, desde, hasta: e.target.value })}
              className={inputCls}
            />
          </label>
        </div>
      )}
    </div>
  );
}
