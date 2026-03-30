import { useState, FormEvent } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import axios from 'axios';

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900">
        <div className="bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 p-8 text-center max-w-md mx-4">
          <p className="text-red-300 mb-4">Enlace inválido o expirado.</p>
          <Link to="/login" className="text-indigo-300 hover:text-white text-sm transition-colors">
            ← Volver al inicio de sesión
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setIsLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Token inválido o expirado.');
      } else {
        setError('Error de conexión. Intente nuevamente.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-500 rounded-full opacity-20 blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500 rounded-full opacity-20 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative w-full max-w-md mx-4">
        <div className="bg-white/10 backdrop-blur-md rounded-3xl shadow-2xl border border-white/20 p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-500/50 mb-4">
              <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">Nueva contraseña</h1>
            <p className="text-white/60 text-sm mt-1">Ingresa tu nueva contraseña</p>
          </div>

          {success ? (
            <div className="text-center space-y-4">
              <div className="px-4 py-4 rounded-xl bg-green-500/20 border border-green-400/30 text-green-200 text-sm">
                Contraseña actualizada correctamente. Redirigiendo al login...
              </div>
              <Link to="/login" className="inline-block text-sm text-indigo-300 hover:text-white transition-colors">
                ← Ir al inicio de sesión
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/20 border border-red-400/30 text-red-200 text-sm flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-white/80">Nueva contraseña</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-10 pr-12 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all backdrop-blur-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-white/80">Confirmar contraseña</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all backdrop-blur-sm"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Guardando...
                    </>
                  ) : (
                    'Guardar nueva contraseña'
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
