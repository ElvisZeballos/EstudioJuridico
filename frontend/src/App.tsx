import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { Dashboard } from './pages/Dashboard';
import { Profile } from './pages/Profile';
import { Clients } from './pages/Clients';
import { ClientDetail } from './pages/ClientDetail';
import { Users } from './pages/Users';
import { Juzgados } from './pages/Juzgados';
import { Casos } from './pages/Casos';
import { CasoDetail } from './pages/CasoDetail';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
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
                {/* Admin y Abogado only */}
                <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'ABOGADO']} />}>
                  <Route path="/clients" element={<Clients />} />
                  <Route path="/clients/:id" element={<ClientDetail />} />
                </Route>
                {/* Admin only */}
                <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
                  <Route path="/users" element={<Users />} />
                </Route>
                {/* Abogado only */}
                <Route element={<ProtectedRoute allowedRoles={['ABOGADO']} />}>
                  <Route path="/juzgados" element={<Juzgados />} />
                </Route>
                {/* Abogado y Cliente */}
                <Route element={<ProtectedRoute allowedRoles={['ABOGADO', 'CLIENTE']} />}>
                  <Route path="/casos" element={<Casos />} />
                  <Route path="/casos/:id" element={<CasoDetail />} />
                </Route>
              </Route>
            </Route>

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
