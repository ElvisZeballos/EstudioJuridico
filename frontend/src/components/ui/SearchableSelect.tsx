import { useState, useMemo, useRef, useEffect } from 'react';
import { matchesAllTerms } from '../../utils/search';

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  error?: string;
  containerClassName?: string;
}

export function SearchableSelect({ label, value, onChange, options, placeholder = 'Seleccionar...', error, containerClassName }: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

      const filtered = useMemo(
    () => options.filter((o) => matchesAllTerms(o.label, search)),
    [options, search],
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={containerClassName} ref={ref}>
      {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`w-full text-left px-3 py-2 rounded-xl border bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${error ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}`}
        >
          {selected ? selected.label : <span className="text-gray-400">{placeholder}</span>}
        </button>
        {open && (
          <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Escribí para buscar..."
              className="w-full px-3 py-2 text-sm border-b border-gray-200 dark:border-gray-700 bg-transparent focus:outline-none text-gray-800 dark:text-gray-200"
            />
            <div className="max-h-56 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.length === 0 ? (
                <p className="px-3 py-2 text-sm text-gray-400">Sin coincidencias.</p>
              ) : (
                filtered.map((o) => (
                  <button
                    type="button"
                    key={o.value || '__empty__'}
                    onClick={() => { onChange(o.value); setOpen(false); setSearch(''); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30 ${o.value === value ? 'bg-indigo-50 dark:bg-indigo-900/20 font-medium' : ''}`}
                  >
                    {o.label}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
          <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
          {error}
        </p>
      )}
    </div>
  );
}