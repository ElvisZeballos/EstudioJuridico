import { useState, useRef, useEffect } from 'react';
import { PHONE_COUNTRIES, OTHER_COUNTRY_VALUE } from '../../utils/phoneCountries';

interface PhoneCountrySelectProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

function flagUrl(iso2: string): string {
  return `https://flagcdn.com/24x18/${iso2.toLowerCase()}.png`;
}

export function PhoneCountrySelect({ value, onChange, error }: PhoneCountrySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = PHONE_COUNTRIES.find((c) => c.code === value);
  const isOther = value === OTHER_COUNTRY_VALUE;

  return (
    <div className="flex flex-col gap-1" ref={containerRef}>
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Prefijo</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((o) => !o)}
          className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border ${
            error ? 'border-red-400' : 'border-gray-200 dark:border-gray-700'
          } bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white`}
        >
          {isOther ? (
            <>
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="flex-1 text-left">Otro</span>
            </>
          ) : selected ? (
            <>
              <img src={flagUrl(selected.iso2)} alt={selected.name} className="w-5 h-auto rounded-sm shrink-0" />
              <span className="flex-1 text-left font-medium">{selected.code}</span>
            </>
          ) : (
            <span className="flex-1 text-left text-gray-400">Seleccionar</span>
          )}
          <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {isOpen && (
          <div className="absolute z-20 mt-1 w-64 max-h-64 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
            {PHONE_COUNTRIES.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => { onChange(c.code); setIsOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
              >
                <img src={flagUrl(c.iso2)} alt={c.name} className="w-5 h-auto rounded-sm shrink-0" />
                <span className="flex-1">{c.name}</span>
                <span className="text-gray-400">{c.code}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => { onChange(OTHER_COUNTRY_VALUE); setIsOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 text-left border-t border-gray-100 dark:border-gray-700"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="flex-1">Otro</span>
            </button>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );
}