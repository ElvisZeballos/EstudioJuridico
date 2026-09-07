import { useState, useEffect, useMemo } from 'react';
import { juzgadosApi } from '../services/api';
import { Modal, ConfirmModal } from '../components/ui/Modal';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import type { Juzgado, JuzgadoFormData } from '../types';
import { JUZGADO_TIPOS, inferJuzgadoTipo } from '../constants/juzgado';
import { useFormState } from '../hooks/useFormState';
import { useAuth } from '../context/AuthContext';
import { ViewSwitcher } from '../components/ui/ViewSwitcher';
import { useViewMode } from '../hooks/useViewMode';

const emptyForm: JuzgadoFormData = {
  nombre: '', tipo: '', direccion: '', ciudad: '', telefono: '', mapsUrl: '', notas: '',
};

const TIPO_OPTIONS = [
  { value: '', label: 'Sin especificar' },
  ...JUZGADO_TIPOS.map((t) => ({ value: t, label: t })),
];

export function Juzgados() {
  const { user } = useAuth();
  const canWrite = user?.role === 'ABOGADO';
  const showViewSwitcher = user?.role === 'ABOGADO' || user?.role === 'AUXILIAR';
  const { viewMode, setViewMode } = useViewMode('juzgados', showViewSwitcher);
  const [juzgados, setJuzgados] = useState<Juzgado[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Juzgado | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Juzgado | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const {
    form, setForm, isSaving, formError, fieldErrors, setFieldErrors, reset, submit,
  } = useFormState<JuzgadoFormData>(emptyForm);

  const filtered = useMemo(
    () =>
      juzgados.filter((j) => {
        if (tipoFilter && j.tipo !== tipoFilter) return false;
        const q = searchTerm.toLowerCase();
        if (!q) return true;
        return (
          j.nombre.toLowerCase().includes(q) ||
          (j.ciudad && j.ciudad.toLowerCase().includes(q)) ||
          (j.direccion && j.direccion.toLowerCase().includes(q))
        );
      }),
    [juzgados, searchTerm, tipoFilter],
  );

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setIsLoading(true);
      const data = await juzgadosApi.getAll();
      setJuzgados(data);
    } finally {
      setIsLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    reset();
    setShowModal(true);
  }

  function openEdit(j: Juzgado) {
    setEditing(j);
        reset({
      nombre: j.nombre,
      tipo: j.tipo || '',
      direccion: j.direccion || '',
      ciudad: j.ciudad || '',
      telefono: j.telefono || '',
      mapsUrl: j.mapsUrl || '',
      notas: j.notas || '',
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.nombre.trim()) errs.nombre = 'El nombre es requerido.';
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    setFieldErrors({});

    await submit(async () => {
      if (editing) {
        await juzgadosApi.update(editing.id, form);
      } else {
        await juzgadosApi.create(form);
      }
      setShowModal(false);
      load();
    });
  }

    async function handleDelete(j: Juzgado) {
    setDeleteError('');
    try {
      await juzgadosApi.delete(j.id);
      setDeleteConfirm(null);
      load();
    } catch (err: any) {
      setDeleteConfirm(null);
      setDeleteError(err.response?.data?.error || 'No se pudo eliminar el juzgado.');
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Juzgados</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {filtered.length} juzgado{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canWrite && (
          <Button onClick={openCreate} icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          }>
            Nuevo juzgado
          </Button>
        )}
            </div>

      {deleteError && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {deleteError}
        </div>
      )}

      {/* Búsqueda y filtro */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Buscar por nombre, ciudad o dirección..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          leftIcon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          }
          containerClassName="flex-1"
        />
        <Select
          value={tipoFilter}
          onChange={(e) => setTipoFilter(e.target.value)}
          options={[{ value: '', label: 'Todos los tipos' }, ...JUZGADO_TIPOS.map((t) => ({ value: t, label: t }))]}
          containerClassName="sm:w-56"
        />
        {showViewSwitcher && <ViewSwitcher value={viewMode} onChange={setViewMode} />}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : juzgados.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
          <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400">No hay juzgados registrados.</p>
          {canWrite && (
            <button onClick={openCreate} className="mt-3 text-indigo-600 dark:text-indigo-400 text-sm hover:underline">
              Agregar el primero
            </button>
          )}
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-3">
          {filtered.map((j) => (
            <div
              key={j.id}
              className="flex items-center gap-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 px-5 py-4 hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-gray-900 dark:text-white truncate">{j.nombre}</h3>
                  {j.tipo && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                      {j.tipo}
                    </span>
                  )}
                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
                  {j.ciudad}{j.direccion ? ` — ${j.direccion}` : ''}{j.telefono ? ` · ${j.telefono}` : ''}
                </p>
                {j.mapsUrl && (
                  <a
                    href={j.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline mt-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Ver en Google Maps
                  </a>
                )}
              </div>
              {canWrite && (
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(j)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                    title="Editar"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(j)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                    title="Eliminar"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((j) => (
            <div key={j.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-white truncate">{j.nombre}</h3>
                  {j.tipo && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                      {j.tipo}
                    </span>
                  )}
                </div>
                {canWrite && (
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(j)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                      title="Editar"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(j)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                      title="Eliminar"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 text-sm text-gray-600 dark:text-gray-400">
                                {j.ciudad && (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="truncate">{j.ciudad}{j.direccion ? ` — ${j.direccion}` : ''}</span>
                  </div>
                )}
                {j.mapsUrl && (
                  <a
                    href={j.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 010 5.656l-4 4a4 4 0 01-5.656-5.656l1.5-1.5a1 1 0 111.414 1.414l-1.5 1.5a2 2 0 102.828 2.828l4-4a2 2 0 000-2.828" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 010-5.656l4-4a4 4 0 015.656 5.656l-1.5 1.5a1 1 0 11-1.414-1.414l1.5-1.5a2 2 0 10-2.828-2.828l-4 4a2 2 0 000 2.828" />
                    </svg>
                    Ver en Google Maps
                  </a>
                )}
                {j.telefono && (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <span>{j.telefono}</span>
                  </div>
                )}
                {j.notas && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 line-clamp-2 mt-1">{j.notas}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal crear/editar */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Editar juzgado' : 'Nuevo juzgado'}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowModal(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" form="juzgado-form" isLoading={isSaving}>
              {editing ? 'Guardar cambios' : 'Crear juzgado'}
            </Button>
          </>
        }
      >
        <form id="juzgado-form" onSubmit={handleSubmit} className="space-y-4" autoComplete="off" noValidate>
          {formError && (
            <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nombre *"
              value={form.nombre}
              onChange={(e) => {
                const nombre = e.target.value;
                const inferred = inferJuzgadoTipo(nombre);
                setForm((p) => ({ ...p, nombre, tipo: inferred || p.tipo }));
              }}
              placeholder="Ej: Juzgado 1° Civil"
              error={fieldErrors.nombre}
              containerClassName="col-span-2"
            />
            <Select
              label="Tipo"
              value={form.tipo ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))}
              options={TIPO_OPTIONS}
            />
            <Input
              label="Ciudad"
              value={form.ciudad ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, ciudad: e.target.value }))}
              placeholder="Ej: Cochabamba"
            />
                        <Input
              label="Dirección"
              value={form.direccion ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, direccion: e.target.value }))}
              placeholder="Ej: Av. Heroínas E-0123"
              containerClassName="col-span-2"
            />
            <Input
              label="Enlace de Google Maps"
              value={form.mapsUrl ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, mapsUrl: e.target.value }))}
              placeholder="https://maps.app.goo.gl/..."
              containerClassName="col-span-2"
            />
            <Input
              label="Teléfono"
              value={form.telefono ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, telefono: e.target.value }))}
              placeholder="Ej: +591 44123456"
              containerClassName="col-span-2"
            />
            <Textarea
              label="Notas"
              value={form.notas ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))}
              rows={3}
              placeholder="Información adicional..."
              containerClassName="col-span-2"
            />
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        title="Eliminar juzgado"
        message={`¿Eliminar "${deleteConfirm?.nombre}"? El juzgado dejará de mostrarse en el sistema. Esta acción puede revertirse.`}
        confirmLabel="Eliminar"
      />
    </div>
  );
}
