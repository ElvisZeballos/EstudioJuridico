import { useState, useEffect, useMemo, FormEvent } from 'react';
import { usersApi } from '../services/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Modal, ConfirmModal } from '../components/ui/Modal';
import type { User, UserFormData, Role } from '../types';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { ROLE_BADGE_CLASS, ROLE_OPTIONS, API_BASE_URL } from '../constants/roles';

const emptyForm: UserFormData & { confirmPassword: string } = {
  nombre: '',
  apellido: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: 'CLIENTE',
  dni: '',
  telefono: '',
  direccion: '',
  fechaNacimiento: '',
};

const emptyInviteForm = { email: '', role: 'CLIENTE' as Role };

export function Users() {
  const { user: currentUser } = useAuth();
  const isReadOnly = currentUser?.role === 'AUXILIAR';
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [editingUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [inviteForm, setInviteForm] = useState(emptyInviteForm);
  const [isSaving, setIsSaving] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [resetSent, setResetSent] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setIsLoading(true);
    try {
      const data = await usersApi.getAll();
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  const filtered = useMemo(
    () =>
      users.filter((u) => {
        const q = searchTerm.toLowerCase();
        return (
          u.nombre.toLowerCase().includes(q) ||
          u.apellido.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q)
        );
      }),
    [users, searchTerm],
  );

  function openInvite() {
    setInviteForm(emptyInviteForm);
    setInviteError('');
    setInviteSuccess('');
    setIsInviteOpen(true);
  }

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    setInviteError('');
    setInviteSuccess('');
    if (!inviteForm.email) { setInviteError('El email es requerido.'); return; }
    setIsInviting(true);
    try {
      await usersApi.invite({ email: inviteForm.email, role: inviteForm.role });
      setInviteSuccess(`Invitación enviada a ${inviteForm.email}`);
      setInviteForm(emptyInviteForm);
      loadUsers();
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


  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError('');

    const errs: Record<string, string> = {};
    if (!form.nombre.trim())   errs.nombre   = 'El nombre es requerido.';
    if (!form.apellido.trim()) errs.apellido = 'El apellido es requerido.';
    if (!form.email.trim())    errs.email    = 'El email es requerido.';
    if (!editingUser && !form.password) errs.password = 'La contraseña es obligatoria.';
    if (form.password && form.password !== form.confirmPassword) errs.confirmPassword = 'Las contraseñas no coinciden.';
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    setFieldErrors({});

    setIsSaving(true);
    try {
      const { confirmPassword: _, ...data } = form;
      if (editingUser) {
        const updated = await usersApi.update(editingUser.id, data);
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      } else {
        const created = await usersApi.create(data);
        setUsers((prev) => [created, ...prev]);
      }
      setIsModalOpen(false);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setFormError(err.response?.data?.error || 'Error al guardar el usuario.');
      } else {
        setFormError('Error al guardar el usuario.');
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSendReset(userId: string) {
  try {
    await usersApi.sendPasswordReset(userId);
    setResetSent(userId);
    setTimeout(() => setResetSent(null), 3000);
  } catch (err) {
    if (axios.isAxiosError(err)) {
      alert(err.response?.data?.error || 'No se pudo enviar el correo de restablecimiento.');
    } else {
      alert('Error de conexión al enviar el correo de restablecimiento.');
    }
  }
}

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await usersApi.delete(deleteTarget.id);
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Usuarios</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {filtered.length} usuario{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        {!isReadOnly && (
          <Button
            onClick={openInvite}
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            }
          >
            Invitar Usuario
          </Button>
        )}
      </div>

      {/* Search */}
      <Input
        placeholder="Buscar por nombre, email o rol..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        leftIcon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        }
      />

      {/* User list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-16">
          <p className="text-gray-500 dark:text-gray-400">No se encontraron usuarios.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((u) => (
            <Card key={u.id} hover className="flex items-center gap-4 py-4">
              {/* Avatar */}
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                {u.photoPath ? (
                  <img
                    src={`${API_BASE_URL}${u.photoPath}`}
                    alt={u.nombre}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                    {u.nombre[0]}{u.apellido[0]}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {u.nombre} {u.apellido}
                    {u.id === currentUser?.id && (
                      <span className="ml-1 text-xs text-gray-400">(Tú)</span>
                    )}
                  </h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_BADGE_CLASS[u.role]}`}>
                    {u.role}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    u.active
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                    : u.deactivatedAt
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'
                    }`}>
                    {u.active ? 'Activo' : u.deactivatedAt ? 'Eliminado' : 'Invitado'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{u.email}</p>
              </div>

              {/* Actions */}
              {!isReadOnly && u.id !== currentUser?.id && (
                <div className="flex items-center gap-2 shrink-0">
                  {resetSent === u.id ? (
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium px-2">Enviado ✓</span>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => handleSendReset(u.id)} title="Enviar correo de restablecimiento">
                      <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(u)}>
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Invite Modal */}
      <Modal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        title="Invitar usuario"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsInviteOpen(false)} disabled={isInviting}>
              Cancelar
            </Button>
            <Button onClick={handleInvite} isLoading={isInviting}>
              Enviar invitación
            </Button>
          </>
        }
      >
        <form onSubmit={handleInvite} className="space-y-4" autoComplete="off">
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
            Se enviará un correo con un enlace para que el usuario configure su contraseña y active su cuenta.
          </p>
          <Input
            label="Email"
            type="email"
            value={inviteForm.email}
            onChange={(e) => setInviteForm((p) => ({ ...p, email: e.target.value }))}
            required
            placeholder="usuario@email.com"
          />
          <Select
            label="Rol"
            value={inviteForm.role}
            onChange={(e) => setInviteForm((p) => ({ ...p, role: e.target.value as Role }))}
            options={ROLE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} isLoading={isSaving}>
              {editingUser ? 'Guardar cambios' : 'Crear usuario'}
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
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              required
              placeholder="juan@email.com"
              error={fieldErrors.email}
            />
            <Select
              label="Rol"
              value={form.role ?? 'CLIENTE'}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as Role }))}
              options={ROLE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
            <Input
              label={editingUser ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña'}
              type="password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              required={!editingUser}
              placeholder="••••••••"
              error={fieldErrors.password}
            />
            <Input
              label="Confirmar contraseña"
              type="password"
              value={form.confirmPassword}
              onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))}
              placeholder="••••••••"
              error={fieldErrors.confirmPassword}
            />
            <Input
              label="CI"
              value={form.dni}
              onChange={(e) => setForm((p) => ({ ...p, dni: e.target.value }))}
              placeholder="1234567 CB"
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
            />
            <Input
              label="Dirección"
              value={form.direccion}
              onChange={(e) => setForm((p) => ({ ...p, direccion: e.target.value }))}
              placeholder="Av. Blanco Galindo Km 5, Cochabamba"
            />
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar usuario"
        message={`¿Estás seguro que deseas eliminar a ${deleteTarget?.nombre} ${deleteTarget?.apellido}?`}
        confirmLabel="Eliminar"
        isLoading={isDeleting}
      />
    </div>
  );
}
