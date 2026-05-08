import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { movimientosApi, casosApi } from '../services/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import type { Movimiento, MovimientoFormData, TipoMovimiento, Caso } from '../types';

const emptyForm: MovimientoFormData = {
  tipo: 'INGRESO',
  concepto: '',
  monto: '',
  fecha: new Date().toISOString().slice(0, 10),
  notas: '',
};

const inputClass =
  'w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors';

function formatMoney(n: number) {
  return new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(n);
}

type OrigenFilter = 'TODOS' | 'ABOGADO' | string;

export function Cuenta() {
  const navigate = useNavigate();
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [casos, setCasos] = useState<Caso[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Movimiento | null>(null);
  const [form, setForm] = useState<MovimientoFormData>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [filterTipo, setFilterTipo] = useState<TipoMovimiento | 'TODOS'>('TODOS');
  const [filterOrigen, setFilterOrigen] = useState<OrigenFilter>('TODOS');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function load() {
    try {
      const [movs, cs] = await Promise.all([
        movimientosApi.getAll(),
        casosApi.getAll(),
      ]);
      setMovimientos(movs);
      setCasos(cs);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setFieldErrors({});
    setShowModal(true);
  }

  function openEdit(m: Movimiento) {
    setEditing(m);
    setForm({
      tipo: m.tipo,
      concepto: m.concepto,
      monto: m.monto,
      fecha: m.fecha.slice(0, 10),
      notas: m.notas || '',
    });
    setError('');
    setFieldErrors({});
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
    setIsSaving(true);
    setError('');
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
        setError(err.response?.data?.error || 'Error al guardar');
      } else {
        setError('Error inesperado');
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

  const filtered = useMemo(() => {
    return movimientos.filter((m) => {
      if (filterTipo !== 'TODOS' && m.tipo !== filterTipo) return false;
      if (filterOrigen === 'ABOGADO' && m.casoId != null) return false;
      if (filterOrigen !== 'TODOS' && filterOrigen !== 'ABOGADO' && m.casoId !== filterOrigen) return false;
      return true;
    });
  }, [movimientos, filterTipo, filterOrigen]);

  const stats = useMemo(() => {
    const ingresos = filtered.filter(m => m.tipo === 'INGRESO');
    const egresos  = filtered.filter(m => m.tipo === 'EGRESO');
    const totalIngresos = ingresos.reduce((s, m) => s + Number(m.monto), 0);
    const totalEgresos  = egresos.reduce((s, m)  => s + Number(m.monto), 0);
    return {
      totalIngresos,
      totalEgresos,
      balance: totalIngresos - totalEgresos,
      cantIngresos: ingresos.length,
      cantEgresos: egresos.length,
      totalMovimientos: filtered.length,
    };
  }, [filtered]);

  const hasFilters = filterTipo !== 'TODOS' || filterOrigen !== 'TODOS';

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cuenta</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Registro financiero global
          </p>
        </div>
        <Button onClick={openCreate}>
          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo registro
        </Button>
      </div>

      {/* Stats — reactive al filtro activo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card padding="sm" className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/40 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Ingresos</p>
            <p className="text-lg font-bold text-green-600 dark:text-green-400">{formatMoney(stats.totalIngresos)}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{stats.cantIngresos} registros</p>
          </div>
        </Card>
        <Card padding="sm" className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Egresos</p>
            <p className="text-lg font-bold text-red-600 dark:text-red-400">{formatMoney(stats.totalEgresos)}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{stats.cantEgresos} registros</p>
          </div>
        </Card>
        <Card padding="sm" className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${stats.balance >= 0 ? 'bg-indigo-100 dark:bg-indigo-900/40' : 'bg-orange-100 dark:bg-orange-900/40'}`}>
            <svg className={`w-6 h-6 ${stats.balance >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-orange-600 dark:text-orange-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Balance</p>
            <p className={`text-lg font-bold ${stats.balance >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-orange-600 dark:text-orange-400'}`}>
              {formatMoney(stats.balance)}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{stats.totalMovimientos} movimientos</p>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Tipo */}
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

        {/* Origen */}
        <select
          value={filterOrigen}
          onChange={(e) => setFilterOrigen(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="TODOS">Todos los orígenes</option>
          <option value="ABOGADO">Gastos del abogado</option>
          {casos.map((c) => (
            <option key={c.id} value={c.id}>{c.titulo}</option>
          ))}
        </select>

        {hasFilters && (
          <button
            onClick={() => { setFilterTipo('TODOS'); setFilterOrigen('TODOS'); }}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* List */}
      <Card padding="none" className="overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 px-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">Sin movimientos</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {hasFilters ? 'No hay registros con estos filtros.' : 'Agregá el primer movimiento.'}
              </p>
            </div>
            {!hasFilters && (
              <Button onClick={openCreate} size="sm">Nuevo registro</Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.map((m) => (
              <div key={m.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                {/* Icono tipo */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  m.tipo === 'INGRESO' ? 'bg-green-100 dark:bg-green-900/40' : 'bg-red-100 dark:bg-red-900/40'
                }`}>
                  <svg className={`w-5 h-5 ${m.tipo === 'INGRESO' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {m.tipo === 'INGRESO'
                      ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                      : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                    }
                  </svg>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{m.concepto}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {m.caso ? (
                      <button
                        onClick={() => navigate(`/casos/${m.casoId}/finanzas`)}
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline truncate max-w-[180px]"
                      >
                        {m.caso.titulo}
                      </button>
                    ) : (
                      <span className="text-xs px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                        Gastos abogado
                      </span>
                    )}
                    <span className="text-xs text-gray-300 dark:text-gray-600">·</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(m.fecha).toLocaleDateString('es-BO')}
                    </span>
                  </div>
                </div>

                {/* Monto */}
                <p className={`text-sm font-bold shrink-0 ${m.tipo === 'INGRESO' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {m.tipo === 'INGRESO' ? '+' : '-'}{formatMoney(m.monto)}
                </p>

                {/* Acciones — solo para gastos abogado (casoId null) */}
                {!m.casoId && (
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
                )}
                {m.casoId && (
                  <button
                    onClick={() => navigate(`/casos/${m.casoId}/finanzas`)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors shrink-0"
                    title="Ver en el caso"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modal — solo para gastos abogado */}
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
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4" autoComplete="off" noValidate>
              {error && (
                <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
                  {error}
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
                          ? t === 'INGRESO' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
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
                  autoComplete="off"
                  value={form.concepto}
                  onChange={(e) => setForm({ ...form, concepto: e.target.value })}
                  placeholder="Ej: Honorarios, fotocopias..."
                  className={`${inputClass} ${fieldErrors.concepto ? 'border-red-400 focus:ring-red-400' : ''}`}
                />
                {fieldErrors.concepto && (
                  <p className="text-xs text-red-500 flex items-center gap-1 mt-0.5">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                    {fieldErrors.concepto}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Monto *</label>
                  <input
                    autoComplete="off"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.monto}
                    onChange={(e) => setForm({ ...form, monto: e.target.value })}
                    placeholder="0.00"
                    className={`${inputClass} ${fieldErrors.monto ? 'border-red-400 focus:ring-red-400' : ''}`}
                  />
                  {fieldErrors.monto && (
                    <p className="text-xs text-red-500 flex items-center gap-1 mt-0.5">
                      <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                      {fieldErrors.monto}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha *</label>
                  <input
                    autoComplete="off"
                    type="date"
                    value={form.fecha}
                    onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                    className={`${inputClass} ${fieldErrors.fecha ? 'border-red-400 focus:ring-red-400' : ''}`}
                  />
                  {fieldErrors.fecha && (
                    <p className="text-xs text-red-500 flex items-center gap-1 mt-0.5">
                      <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                      {fieldErrors.fecha}
                    </p>
                  )}
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
