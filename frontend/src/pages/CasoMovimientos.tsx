import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { movimientosApi, casosApi } from '../services/api';
import { Card } from '../components/ui/Card';
import { ConfirmModal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { MovimientoForm } from '../components/MovimientoForm';
import { useFormState } from '../hooks/useFormState';
import { formatMoney } from '../utils/format';
import type { Movimiento, MovimientoFormData, MovimientoStats, Caso, TipoMovimiento } from '../types';
import axios from 'axios';

const emptyForm: MovimientoFormData = {
  casoId: '',
  tipo: 'INGRESO',
  concepto: '',
  monto: '',
  fecha: new Date().toISOString().slice(0, 10),
  notas: '',
};

export function CasoMovimientos() {
  const { casoId } = useParams<{ casoId: string }>();
  const navigate = useNavigate();
  const [caso, setCaso] = useState<Caso | null>(null);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [stats, setStats] = useState<MovimientoStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Movimiento | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [filterTipo, setFilterTipo] = useState<TipoMovimiento | 'TODOS'>('TODOS');

  const { form, setForm, isSaving, formError, fieldErrors, setFieldErrors, reset, submit } =
    useFormState<MovimientoFormData>(emptyForm);

  async function load() {
    if (!casoId) return;
    try {
      const [c, movs, st] = await Promise.all([
        casosApi.getById(casoId),
        movimientosApi.getByCaso(casoId),
        movimientosApi.getStatsByCaso(casoId),
      ]);
      setCaso(c);
      setMovimientos(movs);
      setStats(st);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setLoadError(err.response?.data?.error || 'Error al cargar');
      } else {
        setLoadError('Error inesperado');
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { load(); }, [casoId]);

  function openCreate() {
    setEditing(null);
    reset({ ...emptyForm, casoId: casoId! });
    setShowModal(true);
  }

  function openEdit(m: Movimiento) {
    setEditing(m);
    reset({
      casoId: m.casoId ?? undefined,
      tipo: m.tipo,
      concepto: m.concepto,
      monto: m.monto,
      fecha: m.fecha.slice(0, 10),
      notas: m.notas || '',
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.concepto.trim()) errs.concepto = 'El concepto es requerido.';
    if (!String(form.monto).trim() || Number(form.monto) <= 0) errs.monto = 'Ingresa un monto válido.';
    if (!form.fecha) errs.fecha = 'La fecha es requerida.';
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    setFieldErrors({});

    await submit(async () => {
      if (editing) {
        await movimientosApi.update(editing.id, form);
      } else {
        await movimientosApi.create(form);
      }
      setShowModal(false);
      await load();
    });
  }

  async function handleDelete(id: string) {
    try {
      await movimientosApi.delete(id);
      setDeleteConfirm(null);
      await load();
    } catch {
      // silent
    }
  }

  const filtered = movimientos.filter((m) => filterTipo === 'TODOS' || m.tipo === filterTipo);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (loadError || !caso) {
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
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{loadError || 'Caso no encontrado'}</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/casos')}>Volver a casos</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/casos/${casoId}`)}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Finanzas del caso</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">{caso.titulo}</p>
          </div>
        </div>
        <Button onClick={openCreate} size="sm">
          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo registro
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <Card padding="sm" className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Ingresos</p>
            <p className="text-base font-bold text-green-600 dark:text-green-400">{formatMoney(stats.totalIngresos)}</p>
          </Card>
          <Card padding="sm" className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Egresos</p>
            <p className="text-base font-bold text-red-600 dark:text-red-400">{formatMoney(stats.totalEgresos)}</p>
          </Card>
          <Card padding="sm" className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Balance</p>
            <p className={`text-base font-bold ${stats.balance >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-orange-600 dark:text-orange-400'}`}>
              {formatMoney(stats.balance)}
            </p>
          </Card>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3">
        <div className="flex rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {(['TODOS', 'INGRESO', 'EGRESO'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterTipo(t)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                filterTipo === t
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {t === 'TODOS' ? 'Todos' : t === 'INGRESO' ? 'Ingresos' : 'Egresos'}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500">{filtered.length} registros</span>
      </div>

      {/* List */}
      <Card padding="none" className="overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 px-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">Sin movimientos</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Registrá el primer ingreso o egreso de este caso.</p>
            </div>
            <Button size="sm" onClick={openCreate}>Nuevo registro</Button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.map((m) => (
              <div key={m.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  m.tipo === 'INGRESO' ? 'bg-green-100 dark:bg-green-900/40' : 'bg-red-100 dark:bg-red-900/40'
                }`}>
                  <svg className={`w-4 h-4 ${m.tipo === 'INGRESO' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {m.tipo === 'INGRESO'
                      ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                      : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                    }
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{m.concepto}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(m.fecha).toLocaleDateString('es-AR')}
                    </span>
                    {m.notas && (
                      <>
                        <span className="text-xs text-gray-300 dark:text-gray-600">·</span>
                        <span className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[200px]">{m.notas}</span>
                      </>
                    )}
                  </div>
                </div>
                <p className={`text-sm font-bold shrink-0 ${m.tipo === 'INGRESO' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {m.tipo === 'INGRESO' ? '+' : '-'}{formatMoney(m.monto)}
                </p>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(m)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(m.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <MovimientoForm
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleSubmit}
        form={form}
        setForm={setForm}
        isSaving={isSaving}
        formError={formError}
        fieldErrors={fieldErrors}
        isEditing={!!editing}
      />

      <ConfirmModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        title="Eliminar movimiento"
        message="¿Eliminar este movimiento? Dejará de mostrarse en las finanzas del caso. Esta acción puede revertirse."
        confirmLabel="Eliminar"
      />
    </div>
  );
}
