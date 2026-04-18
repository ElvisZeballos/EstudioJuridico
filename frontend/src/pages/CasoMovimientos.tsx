import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { movimientosApi, casosApi } from '../services/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import type { Movimiento, MovimientoFormData, MovimientoStats, Caso, TipoMovimiento } from '../types';

const emptyForm: MovimientoFormData = {
  casoId: '',
  tipo: 'INGRESO',
  concepto: '',
  monto: '',
  fecha: new Date().toISOString().slice(0, 10),
  notas: '',
};

const inputClass =
  'w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors';

function formatMoney(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);
}

export function CasoMovimientos() {
  const { casoId } = useParams<{ casoId: string }>();
  const navigate = useNavigate();
  const [caso, setCaso] = useState<Caso | null>(null);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [stats, setStats] = useState<MovimientoStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Movimiento | null>(null);
  const [form, setForm] = useState<MovimientoFormData>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [filterTipo, setFilterTipo] = useState<TipoMovimiento | 'TODOS'>('TODOS');

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
        setError(err.response?.data?.error || 'Error al cargar');
      } else {
        setError('Error inesperado');
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { load(); }, [casoId]);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, casoId: casoId! });
    setFormError('');
    setShowModal(true);
  }

  function openEdit(m: Movimiento) {
    setEditing(m);
    setForm({
      casoId: m.casoId,
      tipo: m.tipo,
      concepto: m.concepto,
      monto: m.monto,
      fecha: m.fecha.slice(0, 10),
      notas: m.notas || '',
    });
    setFormError('');
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setFormError('');
    try {
      if (editing) {
        await movimientosApi.update(editing.id, form);
      } else {
        await movimientosApi.create(form);
      }
      setShowModal(false);
      await load();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setFormError(err.response?.data?.error || 'Error al guardar');
      } else {
        setFormError('Error inesperado');
      }
    } finally {
      setIsSaving(false);
    }
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {editing ? 'Editar movimiento' : 'Nuevo movimiento'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
              {formError && (
                <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
                  {formError}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo *</label>
                <div className="flex rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden">
                  {(['INGRESO', 'EGRESO'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm({ ...form, tipo: t })}
                      className={`flex-1 py-2 text-sm font-medium transition-colors ${
                        form.tipo === t
                          ? t === 'INGRESO'
                            ? 'bg-green-500 text-white'
                            : 'bg-red-500 text-white'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {t === 'INGRESO' ? '↑ Ingreso' : '↓ Egreso'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Concepto *</label>
                <input
                  required
                  value={form.concepto}
                  onChange={(e) => setForm({ ...form, concepto: e.target.value })}
                  placeholder="Ej: Honorarios, fotocopias, notificación..."
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Monto *</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.monto}
                    onChange={(e) => setForm({ ...form, monto: e.target.value })}
                    placeholder="0.00"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha *</label>
                  <input
                    required
                    type="date"
                    value={form.fecha}
                    onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Notas</label>
                <textarea
                  rows={2}
                  value={form.notas}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  placeholder="Observaciones opcionales..."
                  className={inputClass}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={isSaving}>
                  {isSaving ? (
                    <span className="flex items-center gap-2 justify-center">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Guardando...
                    </span>
                  ) : editing ? 'Guardar cambios' : 'Crear registro'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Eliminar movimiento</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Esta acción no se puede deshacer.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
              <Button variant="danger" className="flex-1" onClick={() => handleDelete(deleteConfirm)}>Eliminar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
