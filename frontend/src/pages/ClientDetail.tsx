import { useState, useEffect, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { clientsApi, usersApi } from '../services/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Textarea, Select } from '../components/ui/Input';
import { Modal, ConfirmModal } from '../components/ui/Modal';
import type { Client, User, ClientFormData } from '../types';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const emptyForm: ClientFormData = {
  nombre: '',
  apellido: '',
  dni: '',
  email: '',
  telefono: '',
  direccion: '',
  fechaNacimiento: '',
  notas: '',
  abogadoId: '',
  referencias: [],
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

function calcularEdad(fechaNacimiento: string): number {
  const nacimiento = new Date(fechaNacimiento);
  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const mesActual = hoy.getMonth() - nacimiento.getMonth();
  if (mesActual < 0 || (mesActual === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad--;
  }
  return edad;
}

export function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Edit modal
  const [abogados, setAbogados] = useState<User[]>([]);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [form, setForm] = useState<ClientFormData>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Delete confirm
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const canEdit = user?.role === 'ADMIN' || user?.role === 'ABOGADO';
  const canDelete = user?.role === 'ADMIN' || user?.role === 'ABOGADO';

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

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      usersApi.getAll()
        .then((users) => setAbogados(users.filter((u) => u.role === 'ABOGADO' && u.active)))
        .catch(() => {});
    }
  }, [user]);

  function openEdit() {
    if (!client) return;
    setForm({
      nombre: client.nombre,
      apellido: client.apellido,
      dni: client.dni,
      email: client.email,
      telefono: client.telefono ?? '',
      direccion: client.direccion ?? '',
      fechaNacimiento: client.fechaNacimiento ?? '',
      notas: client.notas ?? '',
      abogadoId: client.abogadoId ?? '',
      referencias: client.referencias ?? [],
    });
    setFormError('');
    setFieldErrors({});
    setIsEditOpen(true);
  }

  function addReferencia() {
    setForm((p) => ({ ...p, referencias: [...p.referencias, { nombre: '', relacion: '', telefono: '' }] }));
  }

  function removeReferencia(index: number) {
    setForm((p) => ({ ...p, referencias: p.referencias.filter((_, i) => i !== index) }));
  }

  function updateReferencia(index: number, field: 'nombre' | 'relacion' | 'telefono', value: string) {
    setForm((p) => ({
      ...p,
      referencias: p.referencias.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError('');

    const errs: Record<string, string> = {};
    if (!form.nombre.trim())   errs.nombre    = 'El nombre es requerido.';
    if (!form.apellido.trim()) errs.apellido  = 'El apellido es requerido.';
    if (!form.dni.trim())      errs.dni       = 'La CI es requerida.';
    if (!form.email.trim())    errs.email     = 'El email es requerido.';
    if (form.fechaNacimiento) {
      const edad = calcularEdad(form.fechaNacimiento);
      if (edad < 18) {
        errs.fechaNacimiento = 'No se pueden registrar datos de personas menores de 18 años como cliente. Ingrese los datos del padre, madre o apoderado legal.';
      }
    }
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    setFieldErrors({});

    if (!client) return;
    setIsSaving(true);
    try {
      const updated = await clientsApi.update(client.id, form);
      setClient(updated);
      setIsEditOpen(false);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setFormError(err.response?.data?.error || 'Error al guardar el cliente.');
      } else {
        setFormError('Error al guardar el cliente.');
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!client) return;
    setIsDeleting(true);
    try {
      await clientsApi.delete(client.id);
      navigate('/clients');
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
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

        <div className="flex items-center gap-2">
          {canEdit && (
            <Button variant="outline" size="sm" onClick={openEdit}
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              }
            >
              Editar
            </Button>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsDeleteOpen(true)}
              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </Button>
          )}
        </div>
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
          Creado: {new Date(client.createdAt).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
        <div className="hidden sm:block w-px h-3 bg-gray-200 dark:bg-gray-700" />
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Actualizado: {new Date(client.updatedAt).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
      </Card>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Editar Cliente"
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} isLoading={isSaving}>
              Guardar cambios
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off" noValidate>
          {formError && (
            <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm border border-red-200 dark:border-red-800">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nombre"
              value={form.nombre}
              onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
              required
              placeholder="Juan"
              error={fieldErrors.nombre}
            />
            <Input
              label="Apellido"
              value={form.apellido}
              onChange={(e) => setForm((p) => ({ ...p, apellido: e.target.value }))}
              required
              placeholder="Pérez"
              error={fieldErrors.apellido}
            />
            <Input
              label="CI"
              value={form.dni}
              onChange={(e) => setForm((p) => ({ ...p, dni: e.target.value }))}
              required
              placeholder="1234567 CB"
              error={fieldErrors.dni}
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              required
              placeholder="juan@email.com"
              error={fieldErrors.email}
            />
            <Input
              label="Teléfono"
              value={form.telefono}
              onChange={(e) => setForm((p) => ({ ...p, telefono: e.target.value }))}
              placeholder="+591 76543210"
            />
            <Input
              label="Fecha de nacimiento"
              type="date"
              value={form.fechaNacimiento}
              onChange={(e) => setForm((p) => ({ ...p, fechaNacimiento: e.target.value }))}
              min="1900-01-01"
              max={new Date().toISOString().slice(0, 10)}
              error={fieldErrors.fechaNacimiento}
            />
            <Input
              label="Dirección"
              value={form.direccion}
              onChange={(e) => setForm((p) => ({ ...p, direccion: e.target.value }))}
              placeholder="Av. Blanco Galindo Km 5, Cochabamba"
              containerClassName="sm:col-span-2"
            />
            {user?.role === 'ADMIN' && (
              <Select
                label="Abogado asignado"
                value={form.abogadoId ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, abogadoId: e.target.value }))}
                options={[
                  { value: '', label: 'Sin asignar' },
                  ...abogados.map((a) => ({
                    value: a.id,
                    label: `${a.nombre} ${a.apellido}`,
                  })),
                ]}
                containerClassName="sm:col-span-2"
              />
            )}
            <Textarea
              label="Notas"
              value={form.notas}
              onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))}
              placeholder="Información adicional sobre el cliente..."
              rows={3}
              containerClassName="sm:col-span-2"
            />
          </div>

          {/* Referencias */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Referencias</p>
              <button
                type="button"
                onClick={addReferencia}
                className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Agregar referencia
              </button>
            </div>

            {form.referencias.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">Sin referencias agregadas.</p>
            )}

            {form.referencias.map((ref, index) => (
              <div key={index} className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                <Input
                  label="Nombre"
                  value={ref.nombre}
                  onChange={(e) => updateReferencia(index, 'nombre', e.target.value)}
                  placeholder="María López"
                />
                <Input
                  label="Relación"
                  value={ref.relacion}
                  onChange={(e) => updateReferencia(index, 'relacion', e.target.value)}
                  placeholder="Cónyuge, padre, amigo..."
                />
                <div className="flex items-end gap-2">
                  <Input
                    label="Teléfono"
                    value={ref.telefono}
                    onChange={(e) => updateReferencia(index, 'telefono', e.target.value)}
                    placeholder="+591 76543210"
                    containerClassName="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeReferencia(index)}
                    className="mb-0.5 p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="Eliminar referencia"
                  >
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

      {/* Delete confirmation */}
      <ConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Eliminar cliente"
        message={`¿Estás seguro que deseas eliminar a ${client.nombre} ${client.apellido}? Esta acción puede revertirse.`}
        confirmLabel="Eliminar"
        isLoading={isDeleting}
      />
    </div>
  );
}
