import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../services/api';
import axios from 'axios';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Error al enviar el correo.');
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">Restablecer contraseña</h1>
            <p className="text-white/60 text-sm mt-1">Ingresa tu correo y te enviaremos un enlace</p>
          </div>

          {sent ? (
            <div className="text-center space-y-4">
              <div className="px-4 py-4 rounded-xl bg-green-500/20 border border-green-400/30 text-green-200 text-sm">
                Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.
              </div>
              <Link
                to="/login"
                className="inline-block text-sm text-indigo-300 hover:text-white transition-colors"
              >
                ← Volver al inicio de sesión
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
                  <label className="text-sm font-medium text-white/80">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                      </svg>
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@correo.com"
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
                      Enviando...
                    </>
                  ) : (
                    'Enviar enlace'
                  )}
                </button>
              </form>

              <div className="mt-5 text-center">
                <Link
                  to="/login"
                  className="text-sm text-indigo-300 hover:text-white transition-colors"
                >
                  ← Volver al inicio de sesión
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
