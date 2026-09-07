import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { casosApi, usersApi, clientsApi, juzgadosApi, casoNovedadesApi, googleCalendarApi } from '../services/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal, ConfirmModal } from '../components/ui/Modal';
import { Input, Select, Textarea } from '../components/ui/Input';
import { useAuth } from '../context/AuthContext';
import { ESTADO_COLORS, ESTADO_LABELS, CASO_ESTADOS, getEstadoEfectivo } from '../constants/caso';
import { toggleId } from '../utils/format';
import { ClienteMultiSelect } from '../components/ClienteMultiSelect';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import type { Caso, CasoEstado, CasoFormData, CasoHistorialEntry, CasoNovedad, CasoNovedadFormData, DriveArchivo, User, Client, Juzgado } from '../types';


const ESTADO_OPTIONS = CASO_ESTADOS.map((e) => ({ value: e.value, label: e.label }));
const BOLIVIA_TZ = 'America/La_Paz';

/** Clave "AAAA-MM-DD" del día actual en Bolivia, sin depender del huso del navegador. */
function todayInBolivia(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: BOLIVIA_TZ });
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-gray-900 dark:text-white font-medium">{value}</span>
    </div>
  );
}

export function CasoDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [caso, setCaso] = useState<Caso | null>(null);
  const [historial, setHistorial] = useState<CasoHistorialEntry[]>([]);
  const [novedades, setNovedades] = useState<CasoNovedad[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Novedades state
  const emptyNovedad: CasoNovedadFormData = { titulo: '', contenido: '', fecha: todayInBolivia(), fechaAgendada: null };
  const [showNovedadModal, setShowNovedadModal] = useState(false);
  const [editingNovedad, setEditingNovedad] = useState<CasoNovedad | null>(null);
  const [novedadForm, setNovedadForm] = useState<CasoNovedadFormData>(emptyNovedad);
  const [agendarToggle, setAgendarToggle] = useState(false);
  const [isSavingNovedad, setIsSavingNovedad] = useState(false);
  const [novedadError, setNovedadError] = useState('');
  const [deleteNovedad, setDeleteNovedad] = useState<string | null>(null);
  const [expandedNovedad, setExpandedNovedad] = useState<string | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [previewCtx, setPreviewCtx] = useState<{ files: DriveArchivo[]; idx: number } | null>(null);

  // Edit modal state
  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState<CasoFormData>({
    titulo: '', descripcion: '', estado: 'ACTIVO', numero: '',
    fechaInicio: '', fechaCierre: '', notas: '', abogadoIds: [], clienteIds: [], juzgadoId: '',
    abogadosContraparte: [], demandados: [],
  });
  const [abogados, setAbogados] = useState<User[]>([]);
  const [clientes, setClientes] = useState<Client[]>([]);
  const [juzgados, setJuzgados] = useState<Juzgado[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [editFieldErrors, setEditFieldErrors] = useState<Record<string, string>>({});
  const [novedadFieldErrors, setNovedadFieldErrors] = useState<Record<string, string>>({});

  const canEdit = user?.role === 'ABOGADO';

  async function load() {
    if (!id) return;
    const [c, h, n] = await Promise.all([
      casosApi.getById(id),
      canEdit ? casosApi.getHistorial(id) : Promise.resolve([]),
      casoNovedadesApi.getByCaso(id),
    ]);
    setCaso(c);
    setHistorial(h);
    setNovedades(n);
  }

  useEffect(() => {
    if (!id) return;
    load()
      .catch((err) => setError(err.response?.data?.error || 'Caso no encontrado.'))
      .finally(() => setIsLoading(false));
    if (canEdit) {
      googleCalendarApi.getStatus().then((s) => setGoogleConnected(s.connected)).catch(() => {});
    }
  }, [id]);

  async function openEdit() {
    if (!caso) return;
    setFormError('');
    setEditFieldErrors({});
    setForm({
      titulo: caso.titulo,
      descripcion: caso.descripcion || '',
      estado: caso.estado,
      numero: caso.numero || '',
      fechaInicio: caso.fechaInicio ? caso.fechaInicio.slice(0, 10) : '',
      fechaCierre: caso.fechaCierre ? caso.fechaCierre.slice(0, 10) : '',
      notas: caso.notas || '',
      abogadoIds: caso.abogados.map((a) => a.abogadoId),
      clienteIds: caso.clientes.map((cl) => cl.clienteId),
      juzgadoId: caso.juzgadoId || '',
      abogadosContraparte: caso.abogadosContraparte ?? [],
      demandados: caso.demandados ?? [],
    });
    const [abs, cls, jzs] = await Promise.all([
      usersApi.getAbogados(),
      clientsApi.getAll({ all: true }),
      juzgadosApi.getAll(),
    ]);
    setAbogados(abs);
    setClientes(cls);
    setJuzgados(jzs);
    setShowEdit(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!caso) return;
    setFormError('');
    const errs: Record<string, string> = {};
    if (!form.titulo.trim()) errs.titulo = 'El título es requerido.';
    if (form.abogadoIds.length === 0) errs.abogados = 'Selecciona al menos un abogado.';
    if (form.clienteIds.length === 0) errs.clientes = 'Selecciona al menos un cliente.';
    if (Object.keys(errs).length) { setEditFieldErrors(errs); return; }
    setEditFieldErrors({});
    setIsSaving(true);
    try {
      await casosApi.update(caso.id, {
        ...form,
        juzgadoId: form.juzgadoId || undefined,
      });
      setShowEdit(false);
      setIsLoading(true);
      await load();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setFormError(err.response?.data?.error || 'Error al guardar.');
      } else {
        setFormError('Error de conexión.');
      }
    } finally {
      setIsSaving(false);
      setIsLoading(false);
    }
  }

  function openCreateNovedad() {
    setEditingNovedad(null);
    setNovedadForm(emptyNovedad);
    setAgendarToggle(false);
    setNovedadError('');
    setNovedadFieldErrors({});
    setShowNovedadModal(true);
  }
  function toLocalDatetimeInputValue(isoString: string): string {
  const date = new Date(isoString);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BOLIVIA_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

  function openEditNovedad(n: CasoNovedad) {
    setEditingNovedad(n);
    const hasAgenda = !!n.fechaAgendada;
    setAgendarToggle(hasAgenda);
    setNovedadForm({
      titulo: n.titulo,
      contenido: n.contenido,
      fecha: n.fecha.slice(0, 10),
      fechaAgendada: hasAgenda ? toLocalDatetimeInputValue(n.fechaAgendada!) : null,
    });
    setNovedadError('');
    setNovedadFieldErrors({});
    setShowNovedadModal(true);
  }

  async function handleSaveNovedad(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setNovedadError('');
    const errs: Record<string, string> = {};
    if (!novedadForm.titulo.trim()) errs.titulo = 'El título es requerido.';
    if (!novedadForm.fecha) errs.fecha = 'La fecha es requerida.';
    if (!novedadForm.contenido.trim()) errs.contenido = 'El detalle es requerido.';
    if (Object.keys(errs).length) { setNovedadFieldErrors(errs); return; }
    setNovedadFieldErrors({});
    setIsSavingNovedad(true);
    const payload: CasoNovedadFormData = {
      ...novedadForm,
      fechaAgendada: agendarToggle ? (novedadForm.fechaAgendada || null) : null,
    };
    try {
      if (editingNovedad) {
        await casoNovedadesApi.update(id, editingNovedad.id, payload);
      } else {
        await casoNovedadesApi.create(id, payload);
      }
      setShowNovedadModal(false);
      const updated = await casoNovedadesApi.getByCaso(id);
      setNovedades(updated);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setNovedadError(err.response?.data?.error || 'Error al guardar.');
      } else {
        setNovedadError('Error de conexión.');
      }
    } finally {
      setIsSavingNovedad(false);
    }
  }

  async function handleDeleteNovedad(novedadId: string) {
    if (!id) return;
    try {
      await casoNovedadesApi.delete(id, novedadId);
      setDeleteNovedad(null);
      setNovedades((prev) => prev.filter((n) => n.id !== novedadId));
    } catch {
      // silent
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (error || !caso) {
    return (
      <Card className="text-center py-16">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">Error al cargar</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{error || 'Caso no encontrado'}</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/casos')}>Volver a casos</Button>
        </div>
      </Card>
    );
  }

  const estadoEfectivo = getEstadoEfectivo(caso.estado, caso.fechaCierre);
  const casoBloqueado = estadoEfectivo === 'CONCLUIDO' || estadoEfectivo === 'ARCHIVADO';

  return (
    <div className="space-y-6">
      {/* Header — full width */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/casos')}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{caso.titulo}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Detalle del caso</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {user?.role === 'ABOGADO' && (
          <Button variant="outline" size="sm" onClick={() => navigate(`/casos/${id}/finanzas`)}>
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
            </svg>
            Finanzas
          </Button>
          )}
          {canEdit && (
            <Button size="sm" onClick={openEdit}>
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Editar
            </Button>
          )}
        </div>
      </div>

      {/* Two-column body */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 items-start">

        {/* LEFT — caso info + historial */}
        <div className="space-y-6">
          {/* Main card */}
          <Card>
            <div className="flex items-start gap-4 mb-6 pb-6 border-b border-gray-100 dark:border-gray-700">
              <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                <svg className="w-7 h-7 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{caso.titulo}</h2>
                {caso.descripcion && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{caso.descripcion}</p>
                )}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${ESTADO_COLORS[estadoEfectivo]}`}>
                    {ESTADO_LABELS[estadoEfectivo]}
                  </span>
                  {caso.numero && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                      Nurej #{caso.numero}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <DetailRow label="Fecha de inicio" value={caso.fechaInicio ? new Date(caso.fechaInicio).toLocaleDateString('es-BO', { timeZone: 'UTC' }) : null} />
              <DetailRow label="Fecha de cierre" value={caso.fechaCierre ? new Date(caso.fechaCierre).toLocaleDateString('es-BO', { timeZone: 'UTC' }) : null} />
              {caso.juzgado && (
                <DetailRow label="Juzgado" value={`${caso.juzgado.nombre}${caso.juzgado.ciudad ? ` — ${caso.juzgado.ciudad}` : ''}`} />
              )}
            </div>

            {/* Abogados */}
            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
              <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                Abogados ({caso.abogados.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {caso.abogados.map(({ abogado }) => (
                  <div key={abogado.id} className="flex items-center gap-2 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                    <div className="w-7 h-7 rounded-full bg-indigo-200 dark:bg-indigo-800 flex items-center justify-center">
                      <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">{abogado.nombre[0]}{abogado.apellido[0]}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{abogado.nombre} {abogado.apellido}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{abogado.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Clientes */}
            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
              <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                Clientes ({caso.clientes.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {caso.clientes.map(({ cliente }) => (
                  <div key={cliente.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700">
                    <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                      <span className="text-xs font-bold text-gray-600 dark:text-gray-300">{cliente.nombre[0]}{cliente.apellido[0]}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{cliente.nombre} {cliente.apellido}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{cliente.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {caso.notas && (
              <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Notas</h3>
                <p className="text-sm text-gray-900 dark:text-white whitespace-pre-line bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                  {caso.notas}
                </p>
              </div>
            )}

            {caso.abogadosContraparte?.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  Abogados de la contraparte ({caso.abogadosContraparte.length})
                </h3>
                <div className="space-y-2">
                  {caso.abogadosContraparte.map((ab) => (
                    <div key={ab.id} className="flex items-center gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30">
                      <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-red-600 dark:text-red-400">{ab.nombre[0].toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{ab.nombre}</p>
                        {ab.direccion && <p className="text-xs text-gray-500 dark:text-gray-400">{ab.direccion}</p>}
                      </div>
                      {ab.telefono && (
                        <a href={`tel:${ab.telefono}`} className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline shrink-0">
                          {ab.telefono}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {caso.demandados?.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  Demandados ({caso.demandados.length})
                </h3>
                <div className="space-y-2">
                  {caso.demandados.map((dem) => (
                    <div key={dem.id} className="flex items-center gap-3 p-3 rounded-xl bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30">
                      <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-orange-600 dark:text-orange-400">{dem.nombre[0].toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{dem.nombre}</p>
                        <div className="flex gap-3 flex-wrap">
                          {dem.domicilio && <p className="text-xs text-gray-500 dark:text-gray-400">{dem.domicilio}</p>}
                          {dem.carnet && <p className="text-xs text-gray-500 dark:text-gray-400">CI: {dem.carnet}</p>}
                        </div>
                      </div>
                      {dem.telefono && (
                        <a href={`tel:${dem.telefono}`} className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline shrink-0">
                          {dem.telefono}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Historial de cambios */}
          {canEdit && <Card>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Historial de cambios
            </h3>
            {historial.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">Sin cambios registrados aún.</p>
            ) : (
              <ol className="relative border-l border-gray-200 dark:border-gray-700 space-y-5 ml-3">
                {historial.map((entry) => (
                  <li key={entry.id} className="ml-4">
                    <div className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 bg-indigo-400 dark:bg-indigo-500" />
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">
                          {entry.campo}
                        </span>
                        <time className="text-xs text-gray-400 dark:text-gray-500">
                          {new Date(entry.createdAt).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: BOLIVIA_TZ })}
                        </time>
                        <span className="text-xs text-gray-400 dark:text-gray-500">· {entry.usuario.nombre} {entry.usuario.apellido}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm flex-wrap">
                        {entry.valorAntes !== null
                          ? <span className="line-through text-red-500 dark:text-red-400">{entry.valorAntes}</span>
                          : <span className="italic text-gray-400 dark:text-gray-500">—</span>}
                        <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                        {entry.valorDespues !== null
                          ? <span className="font-medium text-gray-900 dark:text-white">{entry.valorDespues}</span>
                          : <span className="italic text-gray-400 dark:text-gray-500">—</span>}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>}

          {/* Timestamps */}
          <Card padding="sm" className="flex flex-col sm:flex-row sm:items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Creado: {new Date(caso.createdAt).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: BOLIVIA_TZ })}
            </div>
            <div className="hidden sm:block w-px h-3 bg-gray-200 dark:bg-gray-700" />
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Actualizado: {new Date(caso.updatedAt).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: BOLIVIA_TZ })}
            </div>
          </Card>
        </div>

        {/* RIGHT — Notificaciones + Novedades */}
        <div className="lg:sticky lg:top-6 flex flex-col gap-4">

          {/* ── Notificaciones (auto-generadas desde WhatsApp) ── */}
          {(() => {
            const notificaciones = novedades.filter((n) => n.esNotificacion);
            if (notificaciones.length === 0) return null;
            return (
              <Card>
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Notificaciones
                  </h3>
                  <span className="text-xs font-normal text-gray-400 dark:text-gray-500">({notificaciones.length})</span>
                </div>
                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                  {notificaciones.map((n) => {
                    const isExpanded = expandedNovedad === n.id;
                    let archivos: DriveArchivo[] = [];
                    try { archivos = n.archivos ? JSON.parse(n.archivos) : []; } catch { archivos = []; }
                    return (
                      <div key={n.id} className="border border-amber-100 dark:border-amber-900/40 rounded-xl overflow-hidden">
                        <button
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-colors"
                          onClick={() => setExpandedNovedad(isExpanded ? null : n.id)}
                        >
                          <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{n.titulo}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-xs text-gray-400 dark:text-gray-500">
                                {new Date(n.fecha).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                              </span>
                              {archivos.length > 0 && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-xs font-medium">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                  </svg>
                                  {archivos.length} archivo{archivos.length !== 1 ? 's' : ''}
                                </span>
                              )}
                              {n.fechaAgendada && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-medium">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  {new Date(n.fechaAgendada).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', timeZone: BOLIVIA_TZ })}
                                  {' '}{new Date(n.fechaAgendada).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', timeZone: BOLIVIA_TZ })}
                                </span>
                              )}
                              {n.googleCalendarEventId && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs font-medium">
                                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
                                  </svg>
                                  Agendado
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            {canEdit && (
                              <button
                                onClick={() => setDeleteNovedad(n.id)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                            <svg
                              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="px-4 pb-4 pt-2 border-t border-amber-100 dark:border-amber-900/30 bg-amber-50/30 dark:bg-amber-900/10">
                            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                              {n.contenido.split(/\n+Archivos:/i)[0].trim()}
                            </p>
                            {archivos.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-amber-100 dark:border-amber-900/30">
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Archivos en Drive</p>
                                <div className="flex flex-col gap-1.5">
                                  {archivos.map((f) => (
                                    <button
                                      key={f.driveId}
                                      onClick={() => setPreviewCtx({ files: archivos, idx: archivos.indexOf(f) })}
                                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-700 transition-colors group w-full text-left"
                                    >
                                      {f.tipo === 'pdf' ? (
                                        <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                        </svg>
                                      ) : (
                                        <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                      )}
                                      <span className="text-xs text-gray-700 dark:text-gray-300 truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                                        {f.nombre}
                                      </span>
                                      <svg className="w-3.5 h-3.5 text-gray-400 shrink-0 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                      </svg>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })()}

          {/* ── Novedades manuales ── */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Novedades
                {novedades.filter((n) => !n.esNotificacion).length > 0 && (
                  <span className="text-xs font-normal text-gray-400 dark:text-gray-500">({novedades.filter((n) => !n.esNotificacion).length})</span>
                )}
              </h3>
              {canEdit && (
                <button
                  onClick={openCreateNovedad}
                  disabled={casoBloqueado}
                  title={casoBloqueado ? 'No se pueden agregar novedades a un caso concluido o archivado.' : undefined}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl transition-colors ${
                    casoBloqueado
                      ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Agregar
                </button>
              )}
            </div>

            {novedades.filter((n) => !n.esNotificacion).length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Sin novedades</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Registrá audiencias, edictos, diligencias y más.</p>
                </div>
                {canEdit && !casoBloqueado && (
                  <button onClick={openCreateNovedad} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                    Agregar la primera novedad
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                {novedades.filter((n) => !n.esNotificacion).map((n) => {
                  const isExpanded = expandedNovedad === n.id;
                  return (
                    <div key={n.id} className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
                      <button
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                        onClick={() => setExpandedNovedad(isExpanded ? null : n.id)}
                      >
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                          <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{n.titulo}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              {new Date(n.fecha).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                            </span>
                            <span className="text-xs text-gray-300 dark:text-gray-600">·</span>
                            <span className="text-xs text-gray-400 dark:text-gray-500 truncate">{n.autor.nombre} {n.autor.apellido}</span>
                            {n.fechaAgendada && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-medium">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                {new Date(n.fechaAgendada).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', timeZone: BOLIVIA_TZ })}
                                {' '}
                                {new Date(n.fechaAgendada).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', timeZone: BOLIVIA_TZ })}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {canEdit && (
                            <>
                              <button
                                onClick={() => openEditNovedad(n)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => setDeleteNovedad(n.id)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </>
                          )}
                          <svg
                            className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/20">
                          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                            {n.contenido}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

      </div>{/* end grid */}

      {/* Modal novedad */}
      <Modal
        isOpen={showNovedadModal}
        onClose={() => setShowNovedadModal(false)}
        title={editingNovedad ? 'Editar novedad' : 'Nueva novedad'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowNovedadModal(false)} disabled={isSavingNovedad}>
              Cancelar
            </Button>
            <Button type="submit" form="novedad-form" isLoading={isSavingNovedad}>
              {editingNovedad ? 'Guardar cambios' : 'Agregar novedad'}
            </Button>
          </>
        }
      >
        <form id="novedad-form" onSubmit={handleSaveNovedad} className="space-y-4" noValidate>
          {novedadError && (
            <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
              {novedadError}
            </div>
          )}
          <Input
            label="Título *"
            value={novedadForm.titulo}
            onChange={(e) => setNovedadForm({ ...novedadForm, titulo: e.target.value })}
            placeholder="Ej: Audiencia preliminar, Edicto publicado..."
            error={novedadFieldErrors.titulo}
          />
          <Input
            label="Fecha del hecho *"
            type="date"
            value={novedadForm.fecha}
            onChange={(e) => setNovedadForm({ ...novedadForm, fecha: e.target.value })}
            error={novedadFieldErrors.fecha}
            hint="Esta fecha determina el orden de la lista de Novedades."
          />
          <Textarea
            label="Detalle *"
            rows={5}
            value={novedadForm.contenido}
            onChange={(e) => setNovedadForm({ ...novedadForm, contenido: e.target.value })}
            placeholder="Descripción detallada de la novedad, resumen de audiencia, resultado de diligencia..."
            error={novedadFieldErrors.contenido}
          />

          {/* Agenda section */}
          <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
            <button
              type="button"
              onClick={() => {
                const next = !agendarToggle;
                setAgendarToggle(next);
                if (!next) setNovedadForm({ ...novedadForm, fechaAgendada: null });
              }}
              className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              <div className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${agendarToggle ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${agendarToggle ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
              Agendar evento
              {googleConnected && agendarToggle && (
                <span className="ml-1 flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-normal">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                  Se sincronizará con Google Calendar
                </span>
              )}
            </button>

            {agendarToggle && (
              <div className="mt-3">
                <Input
                  label="Fecha y hora del evento *"
                  type="datetime-local"
                  required
                  value={novedadForm.fechaAgendada ?? ''}
                  onChange={(e) => setNovedadForm({ ...novedadForm, fechaAgendada: e.target.value || null })}
                  hint={!googleConnected ? 'Conectá Google Calendar desde tu perfil para sincronizar automáticamente.' : undefined}
                />
              </div>
            )}
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteNovedad}
        onClose={() => setDeleteNovedad(null)}
        onConfirm={() => deleteNovedad && handleDeleteNovedad(deleteNovedad)}
        title="Eliminar novedad"
        message="¿Eliminar esta novedad? Dejará de mostrarse en el caso. Esta acción puede revertirse."
        confirmLabel="Eliminar"
      />

      {/* Edit modal */}
      <Modal
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        title="Editar caso"
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowEdit(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" form="caso-edit-form" isLoading={isSaving}>
              Guardar cambios
            </Button>
          </>
        }
      >
        <form id="caso-edit-form" onSubmit={handleSave} className="space-y-4" noValidate>
          {formError && (
            <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Título *"
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              error={editFieldErrors.titulo}
              containerClassName="col-span-2"
            />
            <Input
              label="Nurej"
              value={form.numero}
              onChange={(e) => setForm({ ...form, numero: e.target.value })}
              placeholder="Ej: 12345/2024"
            />
            <Select
              label="Estado"
              value={form.estado}
              onChange={(e) => setForm({ ...form, estado: e.target.value as CasoEstado })}
              options={ESTADO_OPTIONS}
            />
            <SearchableSelect
              label="Juzgado"
              value={form.juzgadoId ?? ''}
              onChange={(juzgadoId) => setForm({ ...form, juzgadoId })}
              options={[
                { value: '', label: 'Sin juzgado asignado' },
                ...juzgados.map((j) => ({ value: j.id, label: `${j.nombre}${j.ciudad ? ` — ${j.ciudad}` : ''}` })),
              ]}
              containerClassName="col-span-2"
            />
            <Input
              label="Fecha de inicio"
              type="date"
              value={form.fechaInicio}
              onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })}
            />
            <Input
              label="Fecha de cierre"
              type="date"
              value={form.fechaCierre}
              onChange={(e) => setForm({ ...form, fechaCierre: e.target.value })}
            />
            <Textarea
              label="Descripción"
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              rows={2}
              containerClassName="col-span-2"
            />

            {/* Abogados */}
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Abogados * <span className="text-xs text-gray-400 font-normal">({form.abogadoIds.length} seleccionado{form.abogadoIds.length !== 1 ? 's' : ''})</span>
              </label>
              <div className={`border rounded-xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-700 max-h-36 overflow-y-auto ${editFieldErrors.abogados ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}`}>
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
              {editFieldErrors.abogados && (
                <p className="text-xs text-red-500 flex items-center gap-1 mt-0.5">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  {editFieldErrors.abogados}
                </p>
              )}
            </div>

            {/* Clientes */}
            <div className="col-span-2">
              <ClienteMultiSelect
                key={String(showEdit)}
                clientes={clientes}
                selectedIds={form.clienteIds}
                onChange={(ids) => setForm({ ...form, clienteIds: ids })}
                error={editFieldErrors.clientes}
              />
            </div>

            <Textarea
              label="Notas"
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              rows={2}
              containerClassName="col-span-2"
            />
          </div>

          {/* Abogados de la contraparte */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Abogados de la contraparte</p>
              <button type="button" onClick={() => setForm((p) => ({ ...p, abogadosContraparte: [...p.abogadosContraparte, { nombre: '', direccion: '', telefono: '' }] }))} className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Agregar
              </button>
            </div>
            {form.abogadosContraparte.length === 0 && <p className="text-xs text-gray-400 dark:text-gray-500 italic">Sin abogados de la contraparte.</p>}
            {form.abogadosContraparte.map((ab, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                <Input label="Nombre" value={ab.nombre} onChange={(e) => setForm((p) => ({ ...p, abogadosContraparte: p.abogadosContraparte.map((x, j) => j === i ? { ...x, nombre: e.target.value } : x) }))} placeholder="Dr. García" />
                <Input label="Dirección" value={ab.direccion ?? ''} onChange={(e) => setForm((p) => ({ ...p, abogadosContraparte: p.abogadosContraparte.map((x, j) => j === i ? { ...x, direccion: e.target.value } : x) }))} placeholder="Av. Libertad 123" />
                <div className="flex items-end gap-2">
                  <Input label="Teléfono" value={ab.telefono ?? ''} onChange={(e) => setForm((p) => ({ ...p, abogadosContraparte: p.abogadosContraparte.map((x, j) => j === i ? { ...x, telefono: e.target.value } : x) }))} placeholder="+591 7..." containerClassName="flex-1" />
                  <button type="button" onClick={() => setForm((p) => ({ ...p, abogadosContraparte: p.abogadosContraparte.filter((_, j) => j !== i) }))} className="mb-0.5 p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Demandados */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Demandados</p>
              <button type="button" onClick={() => setForm((p) => ({ ...p, demandados: [...p.demandados, { nombre: '', domicilio: '', carnet: '', telefono: '' }] }))} className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Agregar
              </button>
            </div>
            {form.demandados.length === 0 && <p className="text-xs text-gray-400 dark:text-gray-500 italic">Sin demandados registrados.</p>}
            {form.demandados.map((dem, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                <Input label="Nombre" value={dem.nombre} onChange={(e) => setForm((p) => ({ ...p, demandados: p.demandados.map((x, j) => j === i ? { ...x, nombre: e.target.value } : x) }))} placeholder="Juan Pérez" />
                <Input label="Domicilio" value={dem.domicilio ?? ''} onChange={(e) => setForm((p) => ({ ...p, demandados: p.demandados.map((x, j) => j === i ? { ...x, domicilio: e.target.value } : x) }))} placeholder="Calle falsa 123" />
                <Input label="Carnet" value={dem.carnet ?? ''} onChange={(e) => setForm((p) => ({ ...p, demandados: p.demandados.map((x, j) => j === i ? { ...x, carnet: e.target.value } : x) }))} placeholder="12345678" />
                <div className="flex items-end gap-2">
                  <Input label="Teléfono" value={dem.telefono ?? ''} onChange={(e) => setForm((p) => ({ ...p, demandados: p.demandados.map((x, j) => j === i ? { ...x, telefono: e.target.value } : x) }))} placeholder="+591 7..." containerClassName="flex-1" />
                  <button type="button" onClick={() => setForm((p) => ({ ...p, demandados: p.demandados.filter((_, j) => j !== i) }))} className="mb-0.5 p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </form>
      </Modal>

      {previewCtx && (() => {
        const current = previewCtx.files[previewCtx.idx];
        const total = previewCtx.files.length;
        const hasPrev = previewCtx.idx > 0;
        const hasNext = previewCtx.idx < total - 1;
        const navBtn = 'shrink-0 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors';
        return (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setPreviewCtx(null)}
          >
            <div
              className="relative flex flex-col rounded-2xl shadow-2xl overflow-hidden w-full max-w-3xl bg-gray-900"
              style={{ maxHeight: '90vh' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 px-4 py-3 shrink-0 bg-gray-800 border-b border-gray-700">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {current.tipo === 'pdf' ? (
                    <div className="shrink-0 w-7 h-7 rounded-lg bg-red-900/40 flex items-center justify-center text-red-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                  ) : (
                    <div className="shrink-0 w-7 h-7 rounded-lg bg-blue-900/40 flex items-center justify-center text-blue-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <p className="text-sm font-medium truncate text-gray-100">{current.nombre}</p>
                  {total > 1 && (
                    <span className="shrink-0 text-xs text-gray-400 ml-1">{previewCtx.idx + 1} / {total}</span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {total > 1 && (
                    <>
                      <button
                        disabled={!hasPrev}
                        onClick={() => setPreviewCtx({ ...previewCtx, idx: previewCtx.idx - 1 })}
                        className={navBtn}
                        title="Anterior"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <button
                        disabled={!hasNext}
                        onClick={() => setPreviewCtx({ ...previewCtx, idx: previewCtx.idx + 1 })}
                        className={navBtn}
                        title="Siguiente"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setPreviewCtx(null)}
                    className={navBtn}
                    title="Cerrar"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <iframe
                key={current.driveId}
                src={`https://drive.google.com/file/d/${current.driveId}/preview`}
                className="w-full border-0"
                style={{ height: '75vh' }}
                title={current.nombre}
                allow="autoplay"
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
}
