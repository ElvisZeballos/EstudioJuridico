import { useState, useEffect, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { clientsApi, usersApi } from '../services/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Textarea, Select } from '../components/ui/Input';
import { Modal, ConfirmModal } from '../components/ui/Modal';
import type { Client, User, ClientFormData } from '../types';
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
};

export function Clients() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [abogados, setAbogados] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientFormData>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formError, setFormError] = useState('');
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  const canEdit = user?.role === 'ADMIN' || user?.role === 'ABOGADO';
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    loadClients();
    if (isAdmin) loadAbogados();
  }, []);

  async function loadClients() {
    setIsLoading(true);
    try {
      const data = await clientsApi.getAll();
      setClients(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleInviteClient(e: React.FormEvent) {
    e.preventDefault();
    setInviteError('');
    setInviteSuccess('');
    if (!inviteEmail) { setInviteError('El email es requerido.'); return; }
    setIsInviting(true);
    try {
      await usersApi.invite({ email: inviteEmail, role: 'CLIENTE' });
      setInviteSuccess(`Invitación enviada a ${inviteEmail}`);
      setInviteEmail('');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setInviteError(err.response?.data?.error || 'Error al enviar la invitación.');
      } else {
        setInviteError('Error de conexión.');
      }
    } finally {
      setIsInviting(false);
    }
  }

  async function loadAbogados() {
    try {
      const users = await usersApi.getAll();
      setAbogados(users.filter((u) => u.role === 'ABOGADO' && u.active));
    } catch (err) {
      console.error(err);
    }
  }

  const filtered = clients.filter((c) => {
    const q = searchTerm.toLowerCase();
    return (
      c.nombre.toLowerCase().includes(q) ||
      c.apellido.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.dni && c.dni.toLowerCase().includes(q))
    );
  });

  function openCreate() {
    setEditingClient(null);
    setForm(emptyForm);
    setFormError('');
    setIsModalOpen(true);
  }

  function openEdit(client: Client) {
    setEditingClient(client);
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
    });
    setFormError('');
    setIsModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError('');

    if (!form.nombre || !form.apellido || !form.dni || !form.email) {
      setFormError('Nombre, apellido, DNI y email son obligatorios.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingClient) {
        const updated = await clientsApi.update(editingClient.id, form);
        setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      } else {
        const created = await clientsApi.create(form);
        setClients((prev) => [created, ...prev]);
      }
      setIsModalOpen(false);
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
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await clientsApi.delete(deleteTarget.id);
      setClients((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Clientes</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {filtered.length} cliente{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {!isAdmin && canEdit && (
            <Button
              variant="outline"
              onClick={() => { setInviteEmail(''); setInviteError(''); setInviteSuccess(''); setIsInviteOpen(true); }}
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              }
            >
              Invitar cliente
            </Button>
          )}
          {canEdit && (
            <Button
              onClick={openCreate}
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              }
            >
              Nuevo Cliente
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <Input
        placeholder="Buscar por nombre, apellido, email o DNI..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        leftIcon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        }
      />

      {/* Table / Cards */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-16">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">
                {searchTerm ? 'Sin resultados' : 'No hay clientes'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {searchTerm
                  ? 'Intenta con otros términos de búsqueda'
                  : canEdit
                  ? 'Crea tu primer cliente haciendo clic en "Nuevo Cliente"'
                  : 'Aún no tienes clientes asignados'}
              </p>
            </div>
            {canEdit && !searchTerm && (
              <Button onClick={openCreate} size="sm">Crear cliente</Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((client) => (
            <Card key={client.id} hover className="flex items-center gap-4 py-4">
              {/* Avatar */}
              <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                  {client.nombre[0]}{client.apellido[0]}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {client.nombre} {client.apellido}
                  </h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${client.active ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
                    {client.active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
                  <span>{client.email}</span>
                  {client.telefono && <span>{client.telefono}</span>}
                  {client.abogado && (
                    <span className="text-indigo-600 dark:text-indigo-400">
                      Abg. {client.abogado.nombre} {client.abogado.apellido}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <Link to={`/clients/${client.id}`}>
                  <Button variant="ghost" size="sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </Button>
                </Link>
                {canEdit && (
                  <Button variant="ghost" size="sm" onClick={() => openEdit(client)}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </Button>
                )}
                {isAdmin && (
                  <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(client)}>
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Invite Modal (ABOGADO) */}
      <Modal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        title="Invitar cliente"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsInviteOpen(false)} disabled={isInviting}>
              Cancelar
            </Button>
            <Button onClick={handleInviteClient} isLoading={isInviting}>
              Enviar invitación
            </Button>
          </>
        }
      >
        <form onSubmit={handleInviteClient} className="space-y-4">
          {inviteError && (
            <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm border border-red-200 dark:border-red-800">
              {inviteError}
            </div>
          )}
          {inviteSuccess && (
            <div className="px-4 py-3 rounded-xl bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm border border-green-200 dark:border-green-800">
              {inviteSuccess}
            </div>
          )}
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Se enviará un correo al cliente con un enlace para configurar su contraseña y acceder al sistema.
          </p>
          <Input
            label="Email del cliente"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
            placeholder="cliente@email.com"
          />
        </form>
      </Modal>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} isLoading={isSaving}>
              {editingClient ? 'Guardar cambios' : 'Crear cliente'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
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
            />
            <Input
              label="Apellido"
              value={form.apellido}
              onChange={(e) => setForm((p) => ({ ...p, apellido: e.target.value }))}
              required
              placeholder="Pérez"
            />
            <Input
              label="DNI"
              value={form.dni}
              onChange={(e) => setForm((p) => ({ ...p, dni: e.target.value }))}
              required
              placeholder="12.345.678"
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              required
              placeholder="juan@email.com"
            />
            <Input
              label="Teléfono"
              value={form.telefono}
              onChange={(e) => setForm((p) => ({ ...p, telefono: e.target.value }))}
              placeholder="+54 11 1234-5678"
            />
            <Input
              label="Fecha de nacimiento"
              type="date"
              value={form.fechaNacimiento}
              onChange={(e) => setForm((p) => ({ ...p, fechaNacimiento: e.target.value }))}
            />
            <Input
              label="Dirección"
              value={form.direccion}
              onChange={(e) => setForm((p) => ({ ...p, direccion: e.target.value }))}
              placeholder="Av. Corrientes 1234, CABA"
              containerClassName="sm:col-span-2"
            />
            {isAdmin && (
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
        </form>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar cliente"
        message={`¿Estás seguro que deseas desactivar a ${deleteTarget?.nombre} ${deleteTarget?.apellido}? Esta acción puede revertirse.`}
        confirmLabel="Desactivar"
        isLoading={isDeleting}
      />
    </div>
  );
}
