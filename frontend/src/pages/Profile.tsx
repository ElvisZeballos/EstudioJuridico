import { useState, useRef, ChangeEvent, FormEvent, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usersApi, whatsappApi, googleCalendarApi } from '../services/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { WhatsAppModal } from '../components/WhatsAppModal';
import axios from 'axios';
import type { User } from '../types';
import { PHONE_COUNTRIES, DEFAULT_PHONE_COUNTRY, OTHER_COUNTRY_VALUE, splitPhone, joinPhone, sanitizePhoneLocal, sanitizeCustomCode, isValidPhoneLocal } from '../utils/phoneCountries';
import { PhoneCountrySelect } from '../components/ui/PhoneCountrySelect';

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

export function Profile() {
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    nombre: user?.nombre ?? '',
    apellido: user?.apellido ?? '',
    email: user?.email ?? '',
    telefono: user?.telefono ?? '',
    dni: user?.dni ?? '',
    direccion: user?.direccion ?? '',
    fechaNacimiento: user?.fechaNacimiento ?? '',
  });

  const initialPhone = splitPhone(user?.telefono);
  const [phonePrefix, setPhonePrefix] = useState<string>(initialPhone.isOther ? OTHER_COUNTRY_VALUE : initialPhone.code);
  const [customCode, setCustomCode] = useState(initialPhone.isOther ? initialPhone.code : '');
  const [phoneLocal, setPhoneLocal] = useState(initialPhone.local);

  const [pwModal, setPwModal] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwFieldErrors, setPwFieldErrors] = useState<Record<string, string>>({});

  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    user?.photoPath ? `http://localhost:3001${user.photoPath}` : null
  );
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [hasWhatsAppSession, setHasWhatsAppSession] = useState(false);
  const [extractionState, setExtractionState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [googleConnected, setGoogleConnected] = useState(false);
  const [isDisconnectingGoogle, setIsDisconnectingGoogle] = useState(false);

  // Auxiliares state (ABOGADO only)
  const [myAuxiliares, setMyAuxiliares] = useState<User[]>([]);
  const [allAuxiliares, setAllAuxiliares] = useState<User[]>([]);
  const [auxLoading] = useState(false);
  const [auxError, setAuxError] = useState('');
  const [auxSuccess, setAuxSuccess] = useState('');
  const [auxActionId, setAuxActionId] = useState<string | null>(null);

  useEffect(() => {
    whatsappApi.getStatus().then((data) => {
      setWhatsappConnected(data.status === 'CONNECTED');
      setHasWhatsAppSession(data.hasSession ?? false);
    }).catch(() => {});
    googleCalendarApi.getStatus().then((data) => setGoogleConnected(data.connected)).catch(() => {});
  }, []);

  useEffect(() => {
    if (user?.role !== 'ABOGADO') return;
    usersApi.getAuxiliares().then(setAllAuxiliares).catch(() => {});
    usersApi.getMyAuxiliares().then(setMyAuxiliares).catch(() => {}); // silencioso hasta que exista la tabla
  }, [user?.role]);

  const handleAddAuxiliar = async (auxiliarId: string) => {
    setAuxActionId(auxiliarId);
    setAuxError('');
    setAuxSuccess('');
    try {
      await usersApi.addAuxiliar(auxiliarId);
      const [mine, all] = await Promise.all([usersApi.getMyAuxiliares(), usersApi.getAuxiliares()]);
      setMyAuxiliares(mine);
      setAllAuxiliares(all);
      setAuxSuccess('Auxiliar asignado correctamente.');
      setTimeout(() => setAuxSuccess(''), 3000);
    } catch (err) {
      setAuxError(axios.isAxiosError(err) ? (err.response?.data?.error || 'Error al asignar auxiliar.') : 'Error al asignar auxiliar.');
    } finally {
      setAuxActionId(null);
    }
  };

  const handleRemoveAuxiliar = async (auxiliarId: string) => {
    setAuxActionId(auxiliarId);
    setAuxError('');
    setAuxSuccess('');
    try {
      await usersApi.removeAuxiliar(auxiliarId);
      setMyAuxiliares((prev) => prev.filter((a) => a.id !== auxiliarId));
      setAuxSuccess('Auxiliar removido.');
      setTimeout(() => setAuxSuccess(''), 3000);
    } catch (err) {
      setAuxError(axios.isAxiosError(err) ? (err.response?.data?.error || 'Error al remover auxiliar.') : 'Error al remover auxiliar.');
    } finally {
      setAuxActionId(null);
    }
  };

  const availableAuxiliares = allAuxiliares.filter((a) => !myAuxiliares.some((m) => m.id === a.id));

  const handleConnectGoogle = async () => {
    try {
      const { url } = await googleCalendarApi.getConnectUrl();
      window.location.href = url;
    } catch {
      setError('No se pudo obtener el enlace de Google.');
    }
  };

  const handleDisconnectGoogle = async () => {
    setIsDisconnectingGoogle(true);
    try {
      await googleCalendarApi.disconnect();
      setGoogleConnected(false);
      setSuccessMsg('Cuenta de Google desvinculada.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch {
      setError('Error al desvincular Google.');
    } finally {
      setIsDisconnectingGoogle(false);
    }
  };

  const handleRunExtraction = async () => {
    setExtractionState('loading');
    try {
      await whatsappApi.runExtraction();
      setExtractionState('success');
      setTimeout(() => setExtractionState('idle'), 5000);
    } catch {
      setExtractionState('error');
      setTimeout(() => setExtractionState('idle'), 5000);
    }
  };

  const handleChange = (field: string) => (e: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handlePhotoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);

    setIsUploadingPhoto(true);
    setError('');
    try {
      const updated = await usersApi.uploadPhoto(user.id, file);
      updateUser(updated);
      setSuccessMsg('Foto actualizada correctamente.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Error al subir la foto.');
      } else {
        setError('Error al subir la foto.');
      }
      setPhotoPreview(user.photoPath ? `http://localhost:3001${user.photoPath}` : null);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = async () => {
    if (!user) return;
    setIsDeletingPhoto(true);
    setError('');
    try {
      const updated = await usersApi.deletePhoto(user.id);
      updateUser(updated);
      setPhotoPreview(null);
      setSuccessMsg('Foto eliminada correctamente.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Error al eliminar la foto.');
      } else {
        setError('Error al eliminar la foto.');
      }
    } finally {
      setIsDeletingPhoto(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError('');
    setSuccessMsg('');

    const errs: Record<string, string> = {};
    if (!form.nombre.trim())   errs.nombre   = 'El nombre es requerido.';
    if (!form.apellido.trim()) errs.apellido = 'El apellido es requerido.';
    if (!form.email.trim())    errs.email    = 'El email es requerido.';
    if (form.fechaNacimiento && user?.role === 'ABOGADO') {
      const edad = calcularEdad(form.fechaNacimiento);
      if (edad < 18) {
        errs.fechaNacimiento = 'No se pueden registrar datos de un abogado menor de 18 años.';
      }
    }
    if (!isValidPhoneLocal(phoneLocal)) {
      errs.telefono = 'Número de teléfono inválido: solo se permiten dígitos y guiones.';
    }
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    setFieldErrors({});

    setIsLoading(true);
    try {
      const finalCode = phonePrefix === OTHER_COUNTRY_VALUE ? customCode.trim() : phonePrefix;
      const updated = await usersApi.update(user.id, {
        nombre: form.nombre,
        apellido: form.apellido,
        email: form.email,
        telefono: joinPhone(finalCode, phoneLocal),
        dni: form.dni,
        direccion: form.direccion,
        fechaNacimiento: form.fechaNacimiento,
      });;
      updateUser(updated);
      setSuccessMsg('Perfil actualizado correctamente.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Error al actualizar el perfil.');
      } else {
        setError('Error al actualizar el perfil.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const roleColors: Record<string, string> = {
    ADMIN:    'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    ABOGADO:  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    CLIENTE:  'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    AUXILIAR: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  };

  const roleLabels: Record<string, string> = { ADMIN: 'Administrador', ABOGADO: 'Abogado', CLIENTE: 'Cliente', AUXILIAR: 'Auxiliar' };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!pwForm.currentPassword)                                errs.currentPassword = 'Ingresá tu contraseña actual.';
    if (!pwForm.newPassword)                                    errs.newPassword     = 'Ingresá la nueva contraseña.';
    else if (pwForm.newPassword.length < 6)                     errs.newPassword     = 'Mínimo 6 caracteres.';
    if (pwForm.newPassword !== pwForm.confirmPassword)          errs.confirmPassword = 'Las contraseñas no coinciden.';
    if (Object.keys(errs).length) { setPwFieldErrors(errs); return; }
    setPwFieldErrors({});
    setPwLoading(true);
    setPwError('');
    try {
      await usersApi.changePassword(user!.id, { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      setPwModal(false);
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setSuccessMsg('Contraseña actualizada correctamente.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setPwError(err.response?.data?.error || 'Error al cambiar la contraseña.');
      } else {
        setPwError('Error al cambiar la contraseña.');
      }
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mi Perfil</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
          Gestiona tu información personal y de acceso
        </p>
      </div>

      {/* Alert messages */}
      {successMsg && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 text-sm">
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {successMsg}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      {/* Photo card */}
      <Card>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Photo */}
          <div className="relative shrink-0">
            <div className="w-24 h-24 rounded-2xl overflow-hidden bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shadow-lg">
              {photoPreview ? (
                <img src={photoPreview} alt="Foto de perfil" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                  {user?.nombre?.[0]}{user?.apellido?.[0]}
                </span>
              )}
            </div>
            {isUploadingPhoto && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Info + upload */}
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {user?.nombre} {user?.apellido}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{user?.email}</p>
            <div className="flex items-center gap-2 mt-2 justify-center sm:justify-start">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${roleColors[user?.role ?? 'CLIENTE']}`}>
                {roleLabels[user?.role ?? 'CLIENTE']}
              </span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${user?.active ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'}`}>
                {user?.active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>

          {/* Upload button + integration icon cards */}
          <div className="shrink-0 flex flex-col gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handlePhotoChange}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                }
                onClick={() => fileInputRef.current?.click()}
                isLoading={isUploadingPhoto}
              >
                Cambiar foto
              </Button>
              {photoPreview && (
                <Button
                  variant="outline"
                  size="sm"
                  isLoading={isDeletingPhoto}
                  onClick={handleDeletePhoto}
                  className="border-red-300 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  }
                />
              )}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center">JPG, PNG, WebP. Max 5MB</p>

            {/* Integration icon cards */}
            <div className="flex gap-2 justify-center">
              {/* WhatsApp card — ABOGADO only */}
              {user?.role === 'ABOGADO' && <button
                onClick={() => setWhatsappModalOpen(true)}
                className={`group relative w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden transition-all shadow-sm border ${
                  whatsappConnected
                    ? 'bg-green-500 border-green-400'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-green-400'
                }`}
              >
                <svg className={`w-7 h-7 transition-opacity group-hover:opacity-0 ${whatsappConnected ? 'text-white' : 'text-green-500'}`} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-white text-[10px] font-semibold text-center leading-tight px-1">
                    {whatsappConnected ? 'Conectado' : 'Conectar'}
                  </span>
                </div>
              </button>}

              {/* Google card — ABOGADO only */}
              {user?.role === 'ABOGADO' && <button
                onClick={googleConnected ? handleDisconnectGoogle : handleConnectGoogle}
                disabled={isDisconnectingGoogle}
                className={`group relative w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden transition-all shadow-sm border ${
                  googleConnected
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 hover:border-red-400'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-400'
                }`}
              >
                {isDisconnectingGoogle ? (
                  <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-7 h-7 transition-opacity group-hover:opacity-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )}
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-white text-[10px] font-semibold text-center leading-tight px-1">
                    {googleConnected ? 'Desvincular' : 'Conectar'}
                  </span>
                </div>
              </button>}

              {/* Extract messages card */}
              {hasWhatsAppSession && (user?.role === 'ABOGADO' || user?.role === 'ADMIN') && (
                <button
                  onClick={handleRunExtraction}
                  disabled={extractionState === 'loading'}
                  className={`group relative w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden transition-all shadow-sm border ${
                    extractionState === 'success'
                      ? 'bg-green-50 dark:bg-green-900/30 border-green-400'
                      : extractionState === 'error'
                      ? 'bg-red-50 dark:bg-red-900/30 border-red-400'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-indigo-400'
                  }`}
                >
                  {extractionState === 'loading' ? (
                    <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  ) : extractionState === 'success' ? (
                    <svg className="w-7 h-7 text-green-500 transition-opacity group-hover:opacity-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : extractionState === 'error' ? (
                    <svg className="w-7 h-7 text-red-500 transition-opacity group-hover:opacity-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="w-7 h-7 text-indigo-500 dark:text-indigo-400 transition-opacity group-hover:opacity-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  )}
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-white text-[10px] font-semibold text-center leading-tight px-1">
                      {extractionState === 'success' ? 'Iniciada' :
                       extractionState === 'error'   ? 'Error' :
                       'Extraer hoy'}
                    </span>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      </Card>

      <WhatsAppModal
        isOpen={whatsappModalOpen}
        onClose={() => {
          setWhatsappModalOpen(false);
          whatsappApi.getStatus().then((data) => setWhatsappConnected(data.status === 'CONNECTED')).catch(() => {});
        }}
      />

      {/* Edit form */}
      <form onSubmit={handleSubmit} autoComplete="off" noValidate>
        <Card>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Información personal
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nombre"
              value={form.nombre}
              onChange={handleChange('nombre')}
              required
              placeholder="Juan"
              error={fieldErrors.nombre}
            />
            <Input
              label="Apellido"
              value={form.apellido}
              onChange={handleChange('apellido')}
              required
              placeholder="Pérez"
              error={fieldErrors.apellido}
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={handleChange('email')}
              required
              placeholder="juan@email.com"
              error={fieldErrors.email}
            />
            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2">
              <PhoneCountrySelect value={phonePrefix} onChange={setPhonePrefix} />
              {phonePrefix === OTHER_COUNTRY_VALUE ? (
                <div className="grid grid-cols-[90px_1fr] gap-2">
                  <Input
                    label="Código"
                    value={customCode}
                    onChange={(e) => setCustomCode(sanitizeCustomCode(e.target.value))}
                    placeholder="+213"
                  />
                  <Input
                    label="Teléfono"
                    value={phoneLocal}
                    onChange={(e) => setPhoneLocal(sanitizePhoneLocal(e.target.value))}
                    placeholder="76543210"
                    error={fieldErrors.telefono}
                  />
                </div>
              ) : (
                <Input
                  label="Teléfono"
                  value={phoneLocal}
                  onChange={(e) => setPhoneLocal(sanitizePhoneLocal(e.target.value))}
                  placeholder="76543210"
                  error={fieldErrors.telefono}
                />
              )}
            </div>
            <Input
              label="CI"
              value={form.dni}
              onChange={handleChange('dni')}
              placeholder="1234567 CB"
            />
            <Input
              label="Fecha de nacimiento"
              type="date"
              value={form.fechaNacimiento}
              onChange={handleChange('fechaNacimiento')}
              min="1900-01-01"
              max={new Date().toISOString().slice(0, 10)}
              error={fieldErrors.fechaNacimiento}
            />
            <Input
              label="Dirección"
              value={form.direccion}
              onChange={handleChange('direccion')}
              placeholder="Av. Blanco Galindo Km 5, Cochabamba"
              containerClassName="sm:col-span-2"
            />
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={() => { setPwModal(true); setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); setPwFieldErrors({}); setPwError(''); }}
              className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Cambiar contraseña
            </button>
            <Button type="submit" isLoading={isLoading} size="md">
              Guardar cambios
            </Button>
          </div>
        </Card>
      </form>

      {/* Auxiliares card — ABOGADO only */}
      {user?.role === 'ABOGADO' && (
        <Card>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Mis auxiliares
          </h3>

          {auxSuccess && (
            <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 text-sm">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {auxSuccess}
            </div>
          )}
          {auxError && (
            <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              {auxError}
            </div>
          )}

          {/* Current auxiliares */}
          {myAuxiliares.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">No tenés auxiliares asignados.</p>
          ) : (
            <ul className="space-y-2 mb-4">
              {myAuxiliares.map((aux) => (
                <li key={aux.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center shrink-0">
                      {aux.photoPath ? (
                        <img src={`http://localhost:3001${aux.photoPath}`} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <span className="text-xs font-bold text-orange-600 dark:text-orange-400">{aux.nombre[0]}{aux.apellido[0]}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{aux.nombre} {aux.apellido}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{aux.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveAuxiliar(aux.id)}
                    disabled={auxActionId === aux.id}
                    className="ml-3 p-1.5 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                    title="Remover auxiliar"
                  >
                    {auxActionId === aux.id ? (
                      <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Add auxiliar */}
          {availableAuxiliares.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Agregar auxiliar</p>
              <ul className="space-y-2">
                {availableAuxiliares.map((aux) => (
                  <li key={aux.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-dashed border-gray-200 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-500 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                        {aux.photoPath ? (
                          <img src={`http://localhost:3001${aux.photoPath}`} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold text-gray-400">{aux.nombre[0]}{aux.apellido[0]}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{aux.nombre} {aux.apellido}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{aux.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddAuxiliar(aux.id)}
                      disabled={auxActionId === aux.id || auxLoading}
                      className="ml-3 p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors disabled:opacity-50"
                      title="Asignar auxiliar"
                    >
                      {auxActionId === aux.id ? (
                        <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {availableAuxiliares.length === 0 && myAuxiliares.length > 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500">No hay otros auxiliares disponibles.</p>
          )}
        </Card>
      )}

      {/* Password modal */}
      {pwModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setPwModal(false)}>
          <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Cambiar contraseña</h3>
              </div>
              <button onClick={() => setPwModal(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handlePasswordChange} noValidate>
              <div className="px-6 py-5 space-y-4">
                {pwError && (
                  <div className="px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
                    {pwError}
                  </div>
                )}
                {(['currentPassword', 'newPassword', 'confirmPassword'] as const).map((field) => {
                  const labels = { currentPassword: 'Contraseña actual', newPassword: 'Nueva contraseña', confirmPassword: 'Confirmar nueva contraseña' };
                  return (
                    <div key={field}>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        {labels[field]}
                      </label>
                      <input
                        type="password"
                        value={pwForm[field]}
                        onChange={e => setPwForm(prev => ({ ...prev, [field]: e.target.value }))}
                        placeholder="••••••••"
                        className={`w-full px-3 py-2.5 rounded-xl border bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 transition-colors ${pwFieldErrors[field] ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 dark:border-gray-600 focus:ring-indigo-500'}`}
                      />
                      {pwFieldErrors[field] && (
                        <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                          <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                          {pwFieldErrors[field]}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-gray-700">
                <button type="button" onClick={() => setPwModal(false)} className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium transition-colors">
                  Cancelar
                </button>
                <Button type="submit" isLoading={pwLoading} size="sm">
                  Actualizar contraseña
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
