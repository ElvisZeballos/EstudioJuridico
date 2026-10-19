interface Option<T extends string> { value: T; label: string; count?: number }

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}

/** Fila de "chips" para elegir una opción (filtro rápido). */
export function FilterChips<T extends string>({ options, value, onChange, className = '' }: Props<T>) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`} role="group">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              active
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400'
            }`}
          >
            {o.label}
            {o.count !== undefined && <span className={`ml-1 ${active ? 'text-indigo-100' : 'text-gray-400'}`}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
