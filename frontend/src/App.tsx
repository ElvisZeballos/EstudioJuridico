import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';

const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const Profile = lazy(() => import('./pages/Profile').then((m) => ({ default: m.Profile })));
const Clients = lazy(() => import('./pages/Clients').then((m) => ({ default: m.Clients })));
const ClientDetail = lazy(() => import('./pages/ClientDetail').then((m) => ({ default: m.ClientDetail })));
const Users = lazy(() => import('./pages/Users').then((m) => ({ default: m.Users })));
const Juzgados = lazy(() => import('./pages/Juzgados').then((m) => ({ default: m.Juzgados })));
const Casos = lazy(() => import('./pages/Casos').then((m) => ({ default: m.Casos })));
const CasoDetail = lazy(() => import('./pages/CasoDetail').then((m) => ({ default: m.CasoDetail })));
const Cuenta = lazy(() => import('./pages/Cuenta').then((m) => ({ default: m.Cuenta })));
const CasoMovimientos = lazy(() =>
  import('./pages/CasoMovimientos').then((m) => ({ default: m.CasoMovimientos })),
);

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Protected routes */}
              <Route element={<ProtectedRoute />}>
                <Route element={<Layout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/profile" element={<Profile />} />
                  {/* Abogado y Auxiliar */}
                  <Route element={<ProtectedRoute allowedRoles={['ABOGADO', 'AUXILIAR']} />}>
                    <Route path="/clients" element={<Clients />} />
                    <Route path="/clients/:id" element={<ClientDetail />} />
                  </Route>
                  {/* Admin only */}
                  <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
                    <Route path="/users" element={<Users />} />
                  </Route>
                  {/* Abogado y Auxiliar */}
                  <Route element={<ProtectedRoute allowedRoles={['ABOGADO', 'AUXILIAR']} />}>
                    <Route path="/juzgados" element={<Juzgados />} />
                  </Route>
                  {/* Abogado, Cliente y Auxiliar */}
                  <Route element={<ProtectedRoute allowedRoles={['ABOGADO', 'CLIENTE', 'AUXILIAR']} />}>
                    <Route path="/casos" element={<Casos />} />
                    <Route path="/casos/:id" element={<CasoDetail />} />
                  </Route>
                  {/* Cuenta - Abogado only */}
                  <Route element={<ProtectedRoute allowedRoles={['ABOGADO']} />}>
                    <Route path="/cuenta" element={<Cuenta />} />
                    <Route path="/casos/:casoId/finanzas" element={<CasoMovimientos />} />
                  </Route>
                </Route>
              </Route>

              {/* Default redirect */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
