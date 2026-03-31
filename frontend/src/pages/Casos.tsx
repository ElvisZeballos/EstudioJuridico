import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { casosApi, usersApi, clientsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { Caso, CasoEstado, CasoFormData, User, Client } from '../types';
import axios from 'axios';

const ESTADOS: { value: CasoEstado; label: string; color: string }[] = [
  { value: 'ACTIVO', label: 'Activo', color: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' },
  { value: 'EN_PROCESO', label: 'En proceso', color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' },
  { value: 'CERRADO', label: 'Cerrado', color: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400' },
  { value: 'SUSPENDIDO', label: 'Suspendido', color: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300' },
];

function estadoInfo(estado: CasoEstado) {
  return ESTADOS.find((e) => e.value === estado) ?? ESTADOS[0];
}

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
};

export function Casos() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [casos, setCasos] = useState<Caso[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Caso | null>(null);
  const [form, setForm] = useState<CasoFormData>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<Caso | null>(null);
  const [abogados, setAbogados] = useState<User[]>([]);
  const [clientes, setClientes] = useState<Client[]>([]);

  const canWrite = user?.role === 'ADMIN' || user?.role === 'ABOGADO';
  const canDelete = user?.role === 'ADMIN';

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
    setEditing(null);
    setForm(emptyForm);
    setError('');
    await loadFormData();
    setShowModal(true);
  }

  async function openEdit(c: Caso) {
    setEditing(c);
    setForm({
      titulo: c.titulo,
      descripcion: c.descripcion || '',
      estado: c.estado,
      numero: c.numero || '',
      fechaInicio: c.fechaInicio ? c.fechaInicio.slice(0, 10) : '',
      fechaCierre: c.fechaCierre ? c.fechaCierre.slice(0, 10) : '',
      notas: c.notas || '',
      abogadoIds: c.abogados.map((a) => a.abogadoId),
      clienteIds: c.clientes.map((cl) => cl.clienteId),
    });
    setError('');
    await loadFormData();
    setShowModal(true);
  }

  async function loadFormData() {
    const [abogadosList, clients] = await Promise.all([
      usersApi.getAbogados(),
      clientsApi.getAll(),
    ]);
    setAbogados(abogadosList);
    setClientes(clients);
  }

  function toggleId(ids: string[], id: string): string[] {
    return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (form.abogadoIds.length === 0) { setError('Selecciona al menos un abogado.'); return; }
    if (form.clienteIds.length === 0) { setError('Selecciona al menos un cliente.'); return; }
    setIsSaving(true);
    try {
      const payload: CasoFormData = {
        ...form,
        fechaInicio: form.fechaInicio || undefined,
        fechaCierre: form.fechaCierre || undefined,
      };
      if (editing) {
        await casosApi.update(editing.id, payload);
      } else {
        await casosApi.create(payload);
      }
      setShowModal(false);
      load();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Error al guardar.');
      } else {
        setError('Error de conexión.');
      }
    } finally {
      setIsSaving(false);
    }
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

  const inputClass =
    'px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Casos</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {casos.length} caso{casos.length !== 1 ? 's' : ''} registrado{casos.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canWrite && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo caso
          </button>
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
          {casos.map((c) => {
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
                  {(canWrite || canDelete) && (
                    <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {canWrite && (
                        <button
                          onClick={() => openEdit(c)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                          title="Editar"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => setDeleteConfirm(c)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                          title="Eliminar"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
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
                  {c.fechaInicio && (
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>{new Date(c.fechaInicio).toLocaleDateString('es-AR')}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal crear/editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-gray-700 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editing ? 'Editar caso' : 'Nuevo caso'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              {error && (
                <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Título *</label>
                  <input
                    value={form.titulo}
                    onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                    required
                    placeholder="Ej: Juicio por daños y perjuicios"
                    className={inputClass}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">N° de expediente</label>
                  <input
                    value={form.numero}
                    onChange={(e) => setForm({ ...form, numero: e.target.value })}
                    placeholder="Ej: 12345/2024"
                    className={inputClass}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Estado</label>
                  <select
                    value={form.estado}
                    onChange={(e) => setForm({ ...form, estado: e.target.value as CasoEstado })}
                    className={inputClass}
                  >
                    {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Fecha de inicio</label>
                  <input
                    type="date"
                    value={form.fechaInicio}
                    onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Fecha de cierre</label>
                  <input
                    type="date"
                    value={form.fechaCierre}
                    onChange={(e) => setForm({ ...form, fechaCierre: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <div className="col-span-2 flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Descripción</label>
                  <textarea
                    value={form.descripcion}
                    onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                    rows={2}
                    placeholder="Descripción del caso..."
                    className={`${inputClass} resize-none`}
                  />
                </div>

                {/* Abogados */}
                <div className="col-span-2 flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Abogados * <span className="text-xs text-gray-400 font-normal">({form.abogadoIds.length} seleccionado{form.abogadoIds.length !== 1 ? 's' : ''})</span>
                  </label>
                  {abogados.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500 py-2">No hay abogados disponibles.</p>
                  ) : (
                    <div className="border border-gray-300 dark:border-gray-600 rounded-xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-700 max-h-36 overflow-y-auto">
                      {abogados.map((a) => (
                        <label key={a.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={form.abogadoIds.includes(a.id)}
                            onChange={() => setForm({ ...form, abogadoIds: toggleId(form.abogadoIds, a.id) })}
                            className="w-4 h-4 accent-indigo-600"
                          />
                          <span className="text-sm text-gray-800 dark:text-gray-200">{a.nombre} {a.apellido}</span>
                          <span className="text-xs text-gray-400 ml-auto">{a.email}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Clientes */}
                <div className="col-span-2 flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Clientes * <span className="text-xs text-gray-400 font-normal">({form.clienteIds.length} seleccionado{form.clienteIds.length !== 1 ? 's' : ''})</span>
                  </label>
                  {clientes.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500 py-2">No hay clientes disponibles.</p>
                  ) : (
                    <div className="border border-gray-300 dark:border-gray-600 rounded-xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-700 max-h-36 overflow-y-auto">
                      {clientes.map((cl) => (
                        <label key={cl.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={form.clienteIds.includes(cl.id)}
                            onChange={() => setForm({ ...form, clienteIds: toggleId(form.clienteIds, cl.id) })}
                            className="w-4 h-4 accent-indigo-600"
                          />
                          <span className="text-sm text-gray-800 dark:text-gray-200">{cl.nombre} {cl.apellido}</span>
                          <span className="text-xs text-gray-400 ml-auto">{cl.email}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="col-span-2 flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Notas</label>
                  <textarea
                    value={form.notas}
                    onChange={(e) => setForm({ ...form, notas: e.target.value })}
                    rows={2}
                    placeholder="Notas internas..."
                    className={`${inputClass} resize-none`}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Guardando...
                    </>
                  ) : editing ? 'Guardar cambios' : 'Crear caso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal confirmar eliminación */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-200 dark:border-gray-700 p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Eliminar caso</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              ¿Eliminar <strong>{deleteConfirm.titulo}</strong>? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
