import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { clientsApi, casoNovedadesApi, googleCalendarApi } from '../services/api';
import { StatCard, Card } from '../components/ui/Card';
import { CalendarioAgenda } from '../components/CalendarioAgenda';
import type { DashboardStats, CasoNovedad } from '../types';
import { styles } from './Dashboard.styles';

// Icons
const IconClients = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const IconUsers = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const IconLaw = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
  </svg>
);

const IconTrend = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

const IconProfile = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const IconPlus = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const IconInfo = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const SKELETON_KEYS = [1, 2, 3, 4];

export function Dashboard() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [agendadas, setAgendadas] = useState<CasoNovedad[]>([]);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleMsg, setGoogleMsg] = useState<string | null>(null);

  const canSeeStats = user?.role === 'ADMIN' || user?.role === 'ABOGADO';

  useEffect(() => {
    // Handle Google OAuth callback params
    if (searchParams.get('googleConnected')) {
      setGoogleMsg('Google Calendar conectado correctamente.');
      setGoogleConnected(true);
      setSearchParams({});
    } else if (searchParams.get('googleError')) {
      setGoogleMsg('No se pudo conectar Google Calendar. Intentá de nuevo.');
      setSearchParams({});
    }
  }, []);

  useEffect(() => {
    if (!canSeeStats) { setIsLoading(false); return; }
    clientsApi.getStats().then(setStats).catch(console.error).finally(() => setIsLoading(false));
  }, [canSeeStats]);

  useEffect(() => {
    casoNovedadesApi.getAgendadas().then(setAgendadas).catch(() => {});
    googleCalendarApi.getStatus().then((s) => setGoogleConnected(s.connected)).catch(() => {});
  }, []);

  async function handleGoogleConnect() {
    const { url } = await googleCalendarApi.getConnectUrl();
    window.location.href = url;
  }


  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
  const roleLabel = { ADMIN: 'Administrador', ABOGADO: 'Abogado', CLIENTE: 'Cliente' }[user?.role ?? 'CLIENTE'];

  return (
    <div className={styles.page}>

      {/* Welcome banner */}
      <div className={styles.banner}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className={styles.bannerBlobTop} />
          <div className={styles.bannerBlobBottom} />
        </div>
        <div className={styles.bannerContent}>
          <div>
            <p className={styles.bannerGreeting}>{greeting},</p>
            <h1 className={styles.bannerName}>{user?.nombre} {user?.apellido}</h1>
            <div className={styles.bannerBadgeRow}>
              <span className={styles.bannerRoleBadge}>{roleLabel}</span>
              <span className={styles.bannerDate}>
                {now.toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
          </div>
          <div className={styles.bannerActions}>
            {canSeeStats && (
              <Link to="/clients" className={styles.bannerBtnSecondary}>
                <IconPlus /> Nuevo Cliente
              </Link>
            )}
            <Link to="/profile" className={styles.bannerBtnPrimary}>
              <IconProfile /> Mi Perfil
            </Link>
          </div>
        </div>
      </div>

      {/* Stats — solo admin/abogado */}
      {canSeeStats && (
        <div>
          <h2 className={styles.sectionTitle}>Resumen del sistema</h2>
          {isLoading ? (
            <div className={styles.statsGrid}>
              {SKELETON_KEYS.map((i) => <div key={i} className={styles.statSkeleton} />)}
            </div>
          ) : (
            <div className={styles.statsGrid}>
              <StatCard title="Total Clientes" value={stats?.totalClients ?? 0} color="indigo" subtitle="clientes activos" icon={<IconClients />} />
              <StatCard title="Usuarios"       value={stats?.totalUsers ?? 0}   color="blue"   subtitle="usuarios activos" icon={<IconUsers />} />
              <StatCard title="Abogados"       value={stats?.abogados ?? 0}     color="green"  subtitle="en el equipo"    icon={<IconLaw />} />
              <StatCard title="Nuevos (30d)"   value={stats?.recentClients ?? 0} color="amber" subtitle="últimos 30 días" icon={<IconTrend />} />
            </div>
          )}
        </div>
      )}

      {/* Google Calendar notification */}
      {googleMsg && (
        <div className="px-4 py-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm flex items-center justify-between gap-3">
          <span>{googleMsg}</span>
          <button onClick={() => setGoogleMsg(null)} className="shrink-0 text-green-500 hover:text-green-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Calendario de agenda */}
      {canSeeStats && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className={styles.sectionTitle} style={{ marginBottom: 0 }}>Agenda</h2>
            {!googleConnected && (
              <button
                onClick={handleGoogleConnect}
                className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-colors font-medium"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Conectar Google Calendar
              </button>
            )}
          </div>
          <Card>
            <CalendarioAgenda novedades={agendadas} />
          </Card>
        </div>
      )}

      {/* Acciones rápidas */}
      <div>
        <h2 className={styles.sectionTitle}>Acciones rápidas</h2>
        <div className={styles.actionsGrid}>
          <Link to="/clients">
            <Card hover className="flex items-start gap-4 group">
              <div className={styles.actionIcon.indigo}><IconClients /></div>
              <div>
                <h3 className={styles.actionTitle}>Clientes</h3>
                <p className={styles.actionSubtitle}>
                  {user?.role === 'CLIENTE' ? 'Ver mi expediente' : 'Gestionar clientes'}
                </p>
              </div>
            </Card>
          </Link>

          <Link to="/profile">
            <Card hover className="flex items-start gap-4 group">
              <div className={styles.actionIcon.green}><IconProfile /></div>
              <div>
                <h3 className={styles.actionTitle}>Mi Perfil</h3>
                <p className={styles.actionSubtitle}>Actualizar datos personales</p>
              </div>
            </Card>
          </Link>

          {user?.role === 'ADMIN' && (
            <Link to="/users">
              <Card hover className="flex items-start gap-4 group">
                <div className={styles.actionIcon.purple}><IconUsers /></div>
                <div>
                  <h3 className={styles.actionTitle}>Usuarios</h3>
                  <p className={styles.actionSubtitle}>Administrar usuarios del sistema</p>
                </div>
              </Card>
            </Link>
          )}
        </div>
      </div>

      {/* Info del sistema */}
      <Card>
        <div className={styles.infoHeader}>
          <div className={styles.infoIconWrapper}>
            <span className={styles.infoIcon}><IconInfo /></span>
          </div>
          <h3 className={styles.infoTitle}>Información del sistema</h3>
        </div>
        <div className={styles.infoGrid}>
          <div className="flex flex-col gap-1">
            <span className={styles.infoLabel}>Versión</span>
            <span className={styles.infoValue}>1.0.0</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className={styles.infoLabel}>Tu rol</span>
            <span className={styles.infoValue}>{roleLabel}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className={styles.infoLabel}>Sesión activa</span>
            <span className={styles.infoOnline}>
              <span className={styles.infoOnlineDot} /> Conectado
            </span>
          </div>
        </div>
      </Card>

    </div>
  );
}
