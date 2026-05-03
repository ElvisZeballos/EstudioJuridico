import { useState, useRef, ChangeEvent, FormEvent, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usersApi, whatsappApi } from '../services/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { WhatsAppModal } from '../components/WhatsAppModal';
import axios from 'axios';

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
    password: '',
    confirmPassword: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    user?.photoPath ? `http://localhost:3001${user.photoPath}` : null
  );
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [hasWhatsAppSession, setHasWhatsAppSession] = useState(false);
  const [extractionState, setExtractionState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  useEffect(() => {
    whatsappApi.getStatus().then((data) => {
      setWhatsappConnected(data.status === 'CONNECTED');
      setHasWhatsAppSession(data.hasSession ?? false);
    }).catch(() => {});
  }, []);

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

    // Preview
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError('');
    setSuccessMsg('');

    if (form.password && form.password !== form.confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    if (form.password && form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setIsLoading(true);
    try {
      const updateData: Record<string, string> = {
        nombre: form.nombre,
        apellido: form.apellido,
        email: form.email,
        telefono: form.telefono,
        dni: form.dni,
        direccion: form.direccion,
        fechaNacimiento: form.fechaNacimiento,
      };

      if (form.password) {
        updateData.password = form.password;
      }

      const updated = await usersApi.update(user.id, updateData);
      updateUser(updated);
      setForm((prev) => ({ ...prev, password: '', confirmPassword: '' }));
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

          {/* Upload button + WhatsApp */}
          <div className="shrink-0 flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handlePhotoChange}
            />
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
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 text-center">JPG, PNG, WebP. Max 5MB</p>
            <Button
              variant={whatsappConnected ? 'outline' : 'primary'}
              size="sm"
              icon={
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              }
              onClick={() => setWhatsappModalOpen(true)}
            >
              {whatsappConnected ? 'WhatsApp conectado' : 'Conectar WhatsApp'}
            </Button>
            {hasWhatsAppSession && (user?.role === 'ABOGADO' || user?.role === 'ADMIN') && (
              <Button
                variant="outline"
                size="sm"
                isLoading={extractionState === 'loading'}
                icon={
                  extractionState === 'success' ? (
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : extractionState === 'error' ? (
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  )
                }
                onClick={handleRunExtraction}
                className={
                  extractionState === 'success' ? 'border-green-400 text-green-600 dark:text-green-400' :
                  extractionState === 'error'   ? 'border-red-400 text-red-600 dark:text-red-400' : ''
                }
              >
                {extractionState === 'loading' ? 'Extrayendo…' :
                 extractionState === 'success' ? 'Extracción iniciada' :
                 extractionState === 'error'   ? 'Error al extraer' :
                 'Extraer mensajes hoy'}
              </Button>
            )}
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
      <form onSubmit={handleSubmit}>
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
            />
            <Input
              label="Apellido"
              value={form.apellido}
              onChange={handleChange('apellido')}
              required
              placeholder="Pérez"
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={handleChange('email')}
              required
              placeholder="juan@email.com"
            />
            <Input
              label="Teléfono"
              type="tel"
              value={form.telefono}
              onChange={handleChange('telefono')}
              placeholder="+54 11 1234-5678"
            />
            <Input
              label="DNI"
              value={form.dni}
              onChange={handleChange('dni')}
              placeholder="12.345.678"
            />
            <Input
              label="Fecha de nacimiento"
              type="date"
              value={form.fechaNacimiento}
              onChange={handleChange('fechaNacimiento')}
            />
            <Input
              label="Dirección"
              value={form.direccion}
              onChange={handleChange('direccion')}
              placeholder="Av. Corrientes 1234, CABA"
              containerClassName="sm:col-span-2"
            />
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Cambiar contraseña (opcional)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Nueva contraseña"
                type="password"
                value={form.password}
                onChange={handleChange('password')}
                placeholder="••••••••"
                hint="Mínimo 6 caracteres"
              />
              <Input
                label="Confirmar contraseña"
                type="password"
                value={form.confirmPassword}
                onChange={handleChange('confirmPassword')}
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button type="submit" isLoading={isLoading} size="md">
              Guardar cambios
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
