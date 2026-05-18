import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { clientsApi } from '../services/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import type { Client } from '../types';
import { useAuth } from '../context/AuthContext';

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-gray-900 dark:text-white font-medium">{value}</span>
    </div>
  );
}

export function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const canEdit = user?.role === 'ADMIN' || user?.role === 'ABOGADO';

  useEffect(() => {
    if (!id) return;
    clientsApi
      .getById(id)
      .then(setClient)
      .catch((err) => {
        setError(err.response?.data?.error || 'Cliente no encontrado.');
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

  if (error || !client) {
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
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{error || 'Cliente no encontrado'}</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/clients')}>
            Volver a clientes
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Back + header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/clients')}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {client.nombre} {client.apellido}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Detalle del cliente</p>
          </div>
        </div>
        {canEdit && (
          <Link to={`/clients`} state={{ editId: client.id }}>
            <Button variant="outline" size="sm">
              Editar
            </Button>
          </Link>
        )}
      </div>

      {/* Main info card */}
      <Card>
        {/* Avatar + name */}
        <div className="flex items-center gap-5 mb-6 pb-6 border-b border-gray-100 dark:border-gray-700">
          <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
            <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {client.nombre[0]}{client.apellido[0]}
            </span>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {client.nombre} {client.apellido}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{client.email}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${client.active ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
                {client.active ? 'Activo' : 'Inactivo'}
              </span>
              {client.abogado && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                  Abg. {client.abogado.nombre} {client.abogado.apellido}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <DetailRow label="CI" value={client.dni} />
          <DetailRow label="Email" value={client.email} />
          <DetailRow label="Teléfono" value={client.telefono} />
          <DetailRow label="Fecha de nacimiento" value={client.fechaNacimiento} />
          <DetailRow label="Dirección" value={client.direccion} />
          <DetailRow
            label="Abogado asignado"
            value={client.abogado ? `${client.abogado.nombre} ${client.abogado.apellido}` : undefined}
          />
        </div>

        {client.notas && (
          <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
            <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Notas
            </h3>
            <p className="text-sm text-gray-900 dark:text-white whitespace-pre-line bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
              {client.notas}
            </p>
          </div>
        )}

        {client.referencias && client.referencias.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
            <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Referencias
            </h3>
            <div className="space-y-3">
              {client.referencias.map((ref, i) => (
                <div key={ref.id ?? i} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                  <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      {ref.nombre[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{ref.nombre}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{ref.relacion}</p>
                  </div>
                  <a
                    href={`tel:${ref.telefono}`}
                    className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
                  >
                    {ref.telefono}
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Timestamps */}
      <Card padding="sm" className="flex flex-col sm:flex-row sm:items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Creado: {new Date(client.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
        <div className="hidden sm:block w-px h-3 bg-gray-200 dark:bg-gray-700" />
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Actualizado: {new Date(client.updatedAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
      </Card>
    </div>
  );
}
