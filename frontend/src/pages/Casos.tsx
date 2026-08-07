import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { casosApi, usersApi, clientsApi, juzgadosApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Modal, ConfirmModal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Input, Select, Textarea } from '../components/ui/Input';
import { useFormState } from '../hooks/useFormState';
import { estadoInfo, CASO_ESTADOS } from '../constants/caso';
import { toggleId } from '../utils/format';
import { ClienteMultiSelect } from '../components/ClienteMultiSelect';
import type { Caso, CasoEstado, CasoFormData, User, Client, Juzgado } from '../types';

const emptyForm: CasoFormData = {
  titulo: '',
  descripcion: '',
  estado: 'ACTIVO',
  numero: '',
  fechaInicio: '',
  fechaCierre: '',
  notas: '',
  abogadoIds: [],
  clienteIds: [],
  juzgadoId: '',
  abogadosContraparte: [],
  demandados: [],
};

const ESTADO_OPTIONS = CASO_ESTADOS.map((e) => ({ value: e.value, label: e.label }));

export function Casos() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [casos, setCasos] = useState<Caso[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [juzgadoFilter, setJuzgadoFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Caso | null>(null);
  const [abogados, setAbogados] = useState<User[]>([]);
  const [clientes, setClientes] = useState<Client[]>([]);
  const [juzgados, setJuzgados] = useState<Juzgado[]>([]);

  const canWrite = user?.role === 'ADMIN' || user?.role === 'ABOGADO';
  const canDelete = user?.role === 'ADMIN';

  const juzgadosDisponibles = useMemo(() => {
    const map = new Map<string, string>();
    casos.forEach((c) => {
      if (c.juzgado) map.set(c.juzgado.id, `${c.juzgado.nombre}${c.juzgado.ciudad ? ` — ${c.juzgado.ciudad}` : ''}`);
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [casos]);

  const filtered = useMemo(
    () =>
      casos.filter((c) => {
        if (juzgadoFilter && c.juzgado?.id !== juzgadoFilter) return false;
        const q = searchTerm.toLowerCase();
        if (!q) return true;
        return (
          c.titulo.toLowerCase().includes(q) ||
          (c.numero && c.numero.toLowerCase().includes(q)) ||
          c.clientes.some((cl) => `${cl.cliente.nombre} ${cl.cliente.apellido}`.toLowerCase().includes(q))
        );
      }),
    [casos, searchTerm, juzgadoFilter],
  );

  const { form, setForm, isSaving, formError, fieldErrors, setFieldErrors, reset, submit } =
    useFormState<CasoFormData>(emptyForm);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setIsLoading(true);
      const data = await casosApi.getAll();
      setCasos(data);
    } finally {
      setIsLoading(false);
    }
  }

  async function openCreate() {
    reset();
    const [abogadosList, clients, juzgadosList] = await Promise.all([
      usersApi.getAbogados(),
      clientsApi.getAll({ all: true }),
      juzgadosApi.getAll(),
    ]);
    setAbogados(abogadosList);
    setClientes(clients);
    setJuzgados(juzgadosList);
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.titulo.trim()) errs.titulo = 'El título es requerido.';
    if (form.abogadoIds.length === 0) errs.abogados = 'Selecciona al menos un abogado.';
    if (form.clienteIds.length === 0) errs.clientes = 'Selecciona al menos un cliente.';
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    setFieldErrors({});

    await submit(async () => {
      const payload: CasoFormData = {
        ...form,
        fechaInicio: form.fechaInicio || undefined,
        fechaCierre: form.fechaCierre || undefined,
        juzgadoId: form.juzgadoId || undefined,
      };
      await casosApi.create(payload);
      setShowModal(false);
      load();
    });
  }

  async function handleDelete(c: Caso) {
    try {
      await casosApi.delete(c.id);
      setDeleteConfirm(null);
      load();
    } catch {
      // silent
    }
  }

  const juzgadoOptions = [
    { value: '', label: 'Sin juzgado asignado' },
    ...juzgados.map((j) => ({
      value: j.id,
      label: `${j.nombre}${j.ciudad ? ` — ${j.ciudad}` : ''}`,
    })),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Casos</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {filtered.length} caso{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canWrite && (
          <Button onClick={openCreate} icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          }>
            Nuevo caso
          </Button>
        )}
      </div>

      {/* Búsqueda y filtro */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Buscar por título, NUREJ o cliente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          leftIcon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          }
          containerClassName="flex-1"
        />
        {juzgadosDisponibles.length > 0 && (
          <Select
            value={juzgadoFilter}
            onChange={(e) => setJuzgadoFilter(e.target.value)}
            options={[{ value: '', label: 'Todos los juzgados' }, ...juzgadosDisponibles]}
            containerClassName="sm:w-64"
          />
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : casos.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
          <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400">No hay casos registrados.</p>
          {canWrite && (
            <button onClick={openCreate} className="mt-3 text-indigo-600 dark:text-indigo-400 text-sm hover:underline">
              Agregar el primero
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => {
            const estado = estadoInfo(c.estado);
            return (
              <div
                key={c.id}
                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/casos/${c.id}`)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">{c.titulo}</h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${estado.color}`}>
                        {estado.label}
                      </span>
                      {c.numero && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">#{c.numero}</span>
                      )}
                    </div>
                  </div>
                  {canDelete && (
                    <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setDeleteConfirm(c)}
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

                {c.descripcion && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{c.descripcion}</p>
                )}

                <div className="space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="truncate">
                      {c.abogados.map((a) => `${a.abogado.nombre} ${a.abogado.apellido}`).join(', ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="truncate">
                      {c.clientes.map((cl) => `${cl.cliente.nombre} ${cl.cliente.apellido}`).join(', ')}
                    </span>
                  </div>
                  {c.juzgado && (
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span className="truncate">{c.juzgado.nombre}</span>
                    </div>
                  )}
                  {c.fechaInicio && (
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>{new Date(c.fechaInicio).toLocaleDateString('es-BO', { timeZone: 'UTC' })}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal crear */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Nuevo caso"
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowModal(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" form="caso-form" isLoading={isSaving}>
              Crear caso
            </Button>
          </>
        }
      >
        <form id="caso-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
          {formError && (
            <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Título *"
              value={form.titulo}
              onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))}
              placeholder="Ej: Juicio por daños y perjuicios"
              error={fieldErrors.titulo}
              containerClassName="col-span-2"
            />
            <Input
              label="Nurej"
              value={form.numero ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, numero: e.target.value }))}
              placeholder="Ej: 12345/2024"
            />
            <Select
              label="Estado"
              value={form.estado ?? 'ACTIVO'}
              onChange={(e) => setForm((p) => ({ ...p, estado: e.target.value as CasoEstado }))}
              options={ESTADO_OPTIONS}
            />
            <Select
              label="Juzgado"
              value={form.juzgadoId ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, juzgadoId: e.target.value }))}
              options={juzgadoOptions}
            />
            <Input
              label="Fecha de inicio"
              type="date"
              value={form.fechaInicio ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, fechaInicio: e.target.value }))}
            />
            <Input
              label="Fecha de cierre"
              type="date"
              value={form.fechaCierre ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, fechaCierre: e.target.value }))}
            />
            <Textarea
              label="Descripción"
              value={form.descripcion ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
              rows={2}
              placeholder="Descripción del caso..."
              containerClassName="col-span-2"
            />

            {/* Abogados */}
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Abogados * <span className="text-xs text-gray-400 font-normal">({form.abogadoIds.length} seleccionado{form.abogadoIds.length !== 1 ? 's' : ''})</span>
              </label>
              {abogados.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 py-2">No hay abogados disponibles.</p>
              ) : (
                <div className={`border rounded-xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-700 max-h-36 overflow-y-auto ${fieldErrors.abogados ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}`}>
                  {abogados.map((a) => (
                    <label key={a.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.abogadoIds.includes(a.id)}
                        onChange={() => setForm((p) => ({ ...p, abogadoIds: toggleId(p.abogadoIds, a.id) }))}
                        className="w-4 h-4 accent-indigo-600"
                      />
                      <span className="text-sm text-gray-800 dark:text-gray-200">{a.nombre} {a.apellido}</span>
                      <span className="text-xs text-gray-400 ml-auto">{a.email}</span>
                    </label>
                  ))}
                </div>
              )}
              {fieldErrors.abogados && (
                <p className="text-xs text-red-500 flex items-center gap-1 mt-0.5">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  {fieldErrors.abogados}
                </p>
              )}
            </div>

            {/* Clientes */}
            <div className="col-span-2">
              <ClienteMultiSelect
                key={String(showModal)}
                clientes={clientes}
                selectedIds={form.clienteIds}
                onChange={(ids) => setForm((p) => ({ ...p, clienteIds: ids }))}
                error={fieldErrors.clientes}
              />
            </div>

            <Textarea
              label="Notas"
              value={form.notas ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))}
              rows={2}
              placeholder="Notas internas..."
              containerClassName="col-span-2"
            />
          </div>

          {/* Abogados de la contraparte */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Abogados de la contraparte</p>
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, abogadosContraparte: [...p.abogadosContraparte, { nombre: '', direccion: '', telefono: '' }] }))}
                className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Agregar
              </button>
            </div>
            {form.abogadosContraparte.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">Sin abogados de la contraparte.</p>
            )}
            {form.abogadosContraparte.map((ab, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                <Input label="Nombre" value={ab.nombre} onChange={(e) => setForm((p) => ({ ...p, abogadosContraparte: p.abogadosContraparte.map((x, j) => j === i ? { ...x, nombre: e.target.value } : x) }))} placeholder="Dr. García" />
                <Input label="Dirección" value={ab.direccion ?? ''} onChange={(e) => setForm((p) => ({ ...p, abogadosContraparte: p.abogadosContraparte.map((x, j) => j === i ? { ...x, direccion: e.target.value } : x) }))} placeholder="Av. Libertad 123" />
                <div className="flex items-end gap-2">
                  <Input label="Teléfono" value={ab.telefono ?? ''} onChange={(e) => setForm((p) => ({ ...p, abogadosContraparte: p.abogadosContraparte.map((x, j) => j === i ? { ...x, telefono: e.target.value } : x) }))} placeholder="+591 7..." containerClassName="flex-1" />
                  <button type="button" onClick={() => setForm((p) => ({ ...p, abogadosContraparte: p.abogadosContraparte.filter((_, j) => j !== i) }))} className="mb-0.5 p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Demandados */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Demandados</p>
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, demandados: [...p.demandados, { nombre: '', domicilio: '', carnet: '', telefono: '' }] }))}
                className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Agregar
              </button>
            </div>
            {form.demandados.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">Sin demandados registrados.</p>
            )}
            {form.demandados.map((dem, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                <Input label="Nombre" value={dem.nombre} onChange={(e) => setForm((p) => ({ ...p, demandados: p.demandados.map((x, j) => j === i ? { ...x, nombre: e.target.value } : x) }))} placeholder="Juan Pérez" />
                <Input label="Domicilio" value={dem.domicilio ?? ''} onChange={(e) => setForm((p) => ({ ...p, demandados: p.demandados.map((x, j) => j === i ? { ...x, domicilio: e.target.value } : x) }))} placeholder="Calle falsa 123" />
                <Input label="Carnet" value={dem.carnet ?? ''} onChange={(e) => setForm((p) => ({ ...p, demandados: p.demandados.map((x, j) => j === i ? { ...x, carnet: e.target.value } : x) }))} placeholder="12345678" />
                <div className="flex items-end gap-2">
                  <Input label="Teléfono" value={dem.telefono ?? ''} onChange={(e) => setForm((p) => ({ ...p, demandados: p.demandados.map((x, j) => j === i ? { ...x, telefono: e.target.value } : x) }))} placeholder="+591 7..." containerClassName="flex-1" />
                  <button type="button" onClick={() => setForm((p) => ({ ...p, demandados: p.demandados.filter((_, j) => j !== i) }))} className="mb-0.5 p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        title="Eliminar caso"
        message={`¿Eliminar "${deleteConfirm?.titulo}"? El caso dejará de mostrarse en el sistema. Esta acción puede revertirse.`}
        confirmLabel="Eliminar"
      />
    </div>
  );
}
