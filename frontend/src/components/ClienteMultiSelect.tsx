import { useState, useMemo } from 'react';
import { toggleId } from '../utils/format';
import type { Client } from '../types';

interface ClienteMultiSelectProps {
  clientes: Client[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  error?: string;
}

export function ClienteMultiSelect({ clientes, selectedIds, onChange, error }: ClienteMultiSelectProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () =>
      clientes.filter((cl) => {
        const q = search.toLowerCase();
        return (
          cl.nombre.toLowerCase().includes(q) ||
          cl.apellido.toLowerCase().includes(q) ||
          (cl.dni && cl.dni.toLowerCase().includes(q))
        );
      }),
    [clientes, search],
  );

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Clientes * <span className="text-xs text-gray-400 font-normal">({selectedIds.length} seleccionado{selectedIds.length !== 1 ? 's' : ''})</span>
        </label>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o CI..."
          className="w-48 px-2.5 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      {clientes.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-2">No hay clientes disponibles.</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-2">Sin coincidencias para "{search}".</p>
      ) : (
        <div className={`border rounded-xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-700 max-h-36 overflow-y-auto ${error ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}`}>
          {filtered.map((cl) => (
            <label key={cl.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedIds.includes(cl.id)}
                onChange={() => onChange(toggleId(selectedIds, cl.id))}
                className="w-4 h-4 accent-indigo-600"
              />
              <span className="text-sm text-gray-800 dark:text-gray-200">{cl.nombre} {cl.apellido}</span>
              {cl.dni && <span className="text-xs text-gray-400 font-mono">CI: {cl.dni}</span>}
              {!cl.userActive && <span className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 px-1.5 py-0.5 rounded-full">Pendiente</span>}
              <span className="text-xs text-gray-400 ml-auto">{cl.email}</span>
            </label>
          ))}
        </div>
      )}
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1 mt-0.5">
          <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
          {error}
        </p>
      )}
    </div>
  );
}