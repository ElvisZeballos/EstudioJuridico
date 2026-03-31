import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { casosApi } from '../services/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import type { Caso, CasoEstado } from '../types';

const ESTADO_COLORS: Record<CasoEstado, string> = {
  ACTIVO: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
  EN_PROCESO: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  CERRADO: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
  SUSPENDIDO: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300',
};

const ESTADO_LABELS: Record<CasoEstado, string> = {
  ACTIVO: 'Activo',
  EN_PROCESO: 'En proceso',
  CERRADO: 'Cerrado',
  SUSPENDIDO: 'Suspendido',
};

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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const canEdit = user?.role === 'ADMIN' || user?.role === 'ABOGADO';

  useEffect(() => {
    if (!id) return;
    casosApi
      .getById(id)
      .then(setCaso)
      .catch((err) => {
        setError(err.response?.data?.error || 'Caso no encontrado.');
      })
      .finally(() => setIsLoading(false));
  }, [id]);

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
          <Button variant="outline" onClick={() => navigate('/casos')}>
            Volver a casos
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
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
        {canEdit && (
          <Button variant="outline" size="sm" onClick={() => navigate('/casos')}>
            Editar
          </Button>
        )}
      </div>

      {/* Main card */}
      <Card>
        {/* Title + estado */}
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
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${ESTADO_COLORS[caso.estado]}`}>
                {ESTADO_LABELS[caso.estado]}
              </span>
              {caso.numero && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                  Exp. #{caso.numero}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <DetailRow
            label="Fecha de inicio"
            value={caso.fechaInicio ? new Date(caso.fechaInicio).toLocaleDateString('es-AR') : null}
          />
          <DetailRow
            label="Fecha de cierre"
            value={caso.fechaCierre ? new Date(caso.fechaCierre).toLocaleDateString('es-AR') : null}
          />
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
                  <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                    {abogado.nombre[0]}{abogado.apellido[0]}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {abogado.nombre} {abogado.apellido}
                  </p>
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
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                    {cliente.nombre[0]}{cliente.apellido[0]}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {cliente.nombre} {cliente.apellido}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{cliente.email}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notas */}
        {caso.notas && (
          <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
            <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Notas
            </h3>
            <p className="text-sm text-gray-900 dark:text-white whitespace-pre-line bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
              {caso.notas}
            </p>
          </div>
        )}
      </Card>

      {/* Timestamps */}
      <Card padding="sm" className="flex flex-col sm:flex-row sm:items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Creado: {new Date(caso.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
        <div className="hidden sm:block w-px h-3 bg-gray-200 dark:bg-gray-700" />
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Actualizado: {new Date(caso.updatedAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
      </Card>
    </div>
  );
}
