import { useState, useEffect, useMemo } from 'react';
import { feriadosApi } from '../services/api';
import { ConfirmModal } from '../components/ui/Modal';
import { Input, Select } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Toggle } from '../components/ui/Toggle';
import type { Feriado, FeriadoFormData, ConfiguracionFeriados } from '../types';
import { useAuth } from '../context/AuthContext';

const emptyForm: FeriadoFormData = { fecha: '', nombre: '', ambito: 'nacional' };

export function Feriados() {
  const { user } = useAuth();
  const canWrite = user?.role === 'ABOGADO';

  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [config, setConfig] = useState<ConfiguracionFeriados | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState<FeriadoFormData>(emptyForm);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Feriado | null>(null);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setIsLoading(true);
      const [f, c] = await Promise.all([feriadosApi.getAll(), feriadosApi.getConfiguracion()]);
      setFeriados(f);
      setConfig(c);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleToggle(campo: 'trasladoJuevesAViernes' | 'trasladoDomingoALunes', valor: boolean) {
    if (!config) return;
    const prev = config;
    setConfig({ ...config, [campo]: valor });
    try {
      const updated = await feriadosApi.updateConfiguracion({ [campo]: valor });
      setConfig(updated);
    } catch {
      setConfig(prev);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fecha || !form.nombre.trim()) {
      setFormError('La fecha y el nombre son requeridos.');
      return;
    }
    setFormError('');
    setIsSaving(true);
    try {
      await feriadosApi.create(form);
      setForm(emptyForm);
      load();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'No se pudo crear el feriado.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(f: Feriado) {
    setDeleteError('');
    try {
      await feriadosApi.delete(f.id);
      setDeleteConfirm(null);
      load();
    } catch (err: any) {
      setDeleteConfirm(null);
      setDeleteError(err.response?.data?.error || 'No se pudo eliminar el feriado.');
    }
  }

    const feriadosVisibles = useMemo(() => {
    const BOLIVIA_TZ = 'America/La_Paz';
    const dias = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const diaSemanaBolivia = (fecha: Date) =>
      dias.indexOf(new Intl.DateTimeFormat('en-US', { timeZone: BOLIVIA_TZ, weekday: 'short' }).format(fecha));

    type FeriadoVisible = { key: string; fecha: Date; nombre: string; ambito: string; esDerivado: boolean; original?: Feriado };

    const lista: FeriadoVisible[] = feriados.map((f) => ({
      key: f.id, fecha: new Date(f.fecha), nombre: f.nombre, ambito: f.ambito, esDerivado: false, original: f,
    }));

    if (config) {
      for (const f of feriados) {
        const fechaBase = new Date(f.fecha);
        const dow = diaSemanaBolivia(fechaBase);

        if (config.trasladoJuevesAViernes && dow === 4) {
          const viernes = new Date(fechaBase);
          viernes.setUTCDate(viernes.getUTCDate() + 1);
          lista.push({ key: `${f.id}-v`, fecha: viernes, nombre: `${f.nombre} (traslado jueves→viernes)`, ambito: f.ambito, esDerivado: true });
        }
        if (config.trasladoDomingoALunes && dow === 0) {
          const lunes = new Date(fechaBase);
          lunes.setUTCDate(lunes.getUTCDate() + 1);
          lista.push({ key: `${f.id}-l`, fecha: lunes, nombre: `${f.nombre} (traslado domingo→lunes)`, ambito: f.ambito, esDerivado: true });
        }
      }
    }

    return lista.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  }, [feriados, config]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Feriados</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Calendario de feriados usado para calcular días hábiles en los plazos de las notificaciones.
        </p>
      </div>

      {deleteError && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          {deleteError}
        </div>
      )}

      {/* Reglas de traslado */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 dark:text-white">Reglas de traslado</h2>
        {config && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-800 dark:text-gray-200">Feriado en jueves → viernes también es feriado</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Para fines de semana largos (ej. Corpus Christi, Independencia)</p>
              </div>
              <Toggle
                checked={config.trasladoJuevesAViernes}
                onChange={(v) => handleToggle('trasladoJuevesAViernes', v)}
                disabled={!canWrite}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-800 dark:text-gray-200">Feriado en domingo → se traslada a lunes</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Para feriados que caen en domingo</p>
              </div>
              <Toggle
                checked={config.trasladoDomingoALunes}
                onChange={(v) => handleToggle('trasladoDomingoALunes', v)}
                disabled={!canWrite}
              />
            </div>
          </>
        )}
      </div>

      {/* Agregar feriado */}
      {canWrite && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Agregar feriado</h2>
          {formError && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
              {formError}
            </div>
          )}
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-[160px_1fr_180px_auto] gap-3 items-end">
            <Input
              label="Fecha"
              type="date"
              value={form.fecha}
              onChange={(e) => setForm((p) => ({ ...p, fecha: e.target.value }))}
            />
            <Input
              label="Nombre"
              value={form.nombre}
              onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
              placeholder="Ej: Feriado adicional (decreto suelto)"
            />
            <Select
              label="Ámbito"
              value={form.ambito}
              onChange={(e) => setForm((p) => ({ ...p, ambito: e.target.value as 'nacional' | 'departamental' }))}
              options={[
                { value: 'nacional', label: 'Nacional' },
                { value: 'departamental', label: 'Departamental (Cochabamba)' },
              ]}
            />
            <Button type="submit" isLoading={isSaving}>Agregar</Button>
          </form>
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
          {feriadosVisibles.map((f) => (
            <div key={f.key} className="flex items-center justify-between px-5 py-3">
              <div>
                <span className="font-medium text-gray-900 dark:text-white">
                  {f.fecha.toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/La_Paz' })}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-3">{f.nombre}</span>
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                  {f.ambito === 'departamental' ? 'Cochabamba' : 'Nacional'}
                </span>
                {f.esDerivado && (
                  <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                    Derivado (regla)
                  </span>
                )}
              </div>
              {canWrite && f.original && (
                <button
                  onClick={() => setDeleteConfirm(f.original!)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                  title="Eliminar"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        title="Eliminar feriado"
        message={`¿Eliminar "${deleteConfirm?.nombre}"?`}
        confirmLabel="Eliminar"
      />
    </div>
  );
}