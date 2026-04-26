import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { clientsApi, casoNovedadesApi, googleCalendarApi, adminApi } from '../services/api';
import { StatCard, Card } from '../components/ui/Card';
import { CalendarioAgenda } from '../components/CalendarioAgenda';
import type { DashboardStats, CasoNovedad, AdminStats, User } from '../types';
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

const IconServer = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
  </svg>
);

const IconDatabase = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
  </svg>
);

const IconDisk = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
  </svg>
);

const SKELETON_KEYS = [1, 2, 3, 4];

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${ok ? 'text-emerald-400' : 'text-rose-400'}`}>
      <span className={`w-1.5 h-1.5 rounded-full inline-block animate-pulse ${ok ? 'bg-emerald-400' : 'bg-rose-400'}`} />
      {ok ? 'Operativo' : 'Error'}
    </span>
  );
}

function MiniBar({ used, total, color }: { used: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-400 shrink-0">{pct}%</span>
    </div>
  );
}

function AdminDashboard({ user, stats, loading }: { user: User; stats: AdminStats | null; loading: boolean }) {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
  const generatedAt = stats?.generatedAt
    ? new Date(stats.generatedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : null;

  const sto = stats?.storage;
  const diskUsedGB = (sto?.diskTotalGB != null && sto?.diskAvailableGB != null)
    ? Math.round(((sto.diskTotalGB - sto.diskAvailableGB) * 10)) / 10
    : null;

  return (
    <div className={styles.page}>

      {/* Banner */}
      <div className={styles.adminBanner}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className={styles.adminBannerBlob} />
        </div>
        <div className={styles.adminBannerContent}>
          <div>
            <p className={styles.adminBannerLabel}>Panel de Administración</p>
            <h1 className={styles.adminBannerTitle}>{greeting}, {user.nombre}</h1>
            <div className={styles.adminBannerMeta}>
              <span className={styles.adminBannerVersion}>v1.0.0</span>
              <StatusDot ok={!loading && (stats?.database.connected ?? false)} />
              {generatedAt && (
                <span className={styles.adminBannerTime}>Actualizado {generatedAt}</span>
              )}
            </div>
          </div>
          <Link to="/profile" className={styles.adminBannerBtn}>
            <IconProfile /> Mi Perfil
          </Link>
        </div>
      </div>

      {/* System status row */}
      <div>
        <h2 className={styles.sectionTitle}>Estado del sistema</h2>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            {/* Backend */}
            <Card className="bg-slate-800 dark:bg-slate-800 border-slate-700 dark:border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-slate-300">
                  <IconServer />
                  <span className="text-xs font-semibold uppercase tracking-wider">Backend</span>
                </div>
                <StatusDot ok />
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Activo por</span>
                  <span className="text-white font-mono font-semibold">{formatUptime(stats?.server.uptime ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Node.js</span>
                  <span className="text-white font-mono">{stats?.server.nodeVersion ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Entorno</span>
                  <span className={`font-semibold ${stats?.server.env === 'production' ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {stats?.server.env ?? '—'}
                  </span>
                </div>
              </div>
            </Card>

            {/* Database */}
            <Card className="bg-slate-800 dark:bg-slate-800 border-slate-700 dark:border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-slate-300">
                  <IconDatabase />
                  <span className="text-xs font-semibold uppercase tracking-wider">Base de datos</span>
                </div>
                <StatusDot ok={stats?.database.connected ?? false} />
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Host</span>
                  <span className="text-white font-mono text-xs truncate max-w-[120px]">{stats?.database.url ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Motor</span>
                  <span className="text-white capitalize">{stats?.database.provider ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Latencia</span>
                  <span className={`font-semibold font-mono ${(stats?.database.latencyMs ?? 0) < 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {stats?.database.connected ? `${stats.database.latencyMs}ms` : 'N/A'}
                  </span>
                </div>
              </div>
            </Card>

            {/* Storage */}
            <Card className="bg-slate-800 dark:bg-slate-800 border-slate-700 dark:border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-slate-300">
                  <IconDisk />
                  <span className="text-xs font-semibold uppercase tracking-wider">Almacenamiento</span>
                </div>
                <StatusDot ok={stats?.storage.diskAvailableGB === null || (stats?.storage.diskAvailableGB ?? 1) > 0.5} />
              </div>
              <div className="space-y-2 text-sm">
                {stats?.storage.diskTotalGB !== null ? (
                  <>
                    <MiniBar
                      used={diskUsedGB ?? 0}
                      total={stats?.storage.diskTotalGB ?? 1}
                      color={(diskUsedGB ?? 0) / (stats?.storage.diskTotalGB ?? 1) > 0.85 ? 'bg-rose-500' : 'bg-emerald-500'}
                    />
                    <div className="flex justify-between">
                      <span className="text-slate-400">Libre</span>
                      <span className="text-white font-mono font-semibold">{stats?.storage.diskAvailableGB} GB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total disco</span>
                      <span className="text-white font-mono">{stats?.storage.diskTotalGB} GB</span>
                    </div>
                  </>
                ) : (
                  <p className="text-slate-500 text-xs">Información no disponible en este entorno</p>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">Archivos</span>
                  <span className="text-white font-mono">{stats?.storage.uploadsDirMB ?? 0} MB</span>
                </div>
              </div>
            </Card>

          </div>
        )}
      </div>

      {/* Memory + counts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Memory */}
        <div>
          <h2 className={styles.sectionTitle}>Memoria del servidor</h2>
          <Card className="bg-slate-800 dark:bg-slate-800 border-slate-700 dark:border-slate-700">
            {loading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <div key={i} className="h-6 bg-slate-700 rounded animate-pulse" />)}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">Heap usado</span>
                    <span className="text-white font-mono">
                      {stats?.server.memory.heapUsedMB ?? 0} / {stats?.server.memory.heapTotalMB ?? 0} MB
                    </span>
                  </div>
                  <MiniBar
                    used={stats?.server.memory.heapUsedMB ?? 0}
                    total={stats?.server.memory.heapTotalMB ?? 1}
                    color="bg-indigo-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">RSS (memoria total del proceso)</span>
                    <span className="text-white font-mono">{stats?.server.memory.rssMB ?? 0} MB</span>
                  </div>
                  <MiniBar
                    used={stats?.server.memory.rssMB ?? 0}
                    total={Math.max(stats?.server.memory.rssMB ?? 0, stats?.server.memory.heapTotalMB ?? 1) * 1.5}
                    color="bg-blue-500"
                  />
                </div>
                <div className="pt-2 border-t border-slate-700 flex justify-between text-sm">
                  <span className="text-slate-400">Plataforma</span>
                  <span className="text-white font-mono">{stats?.server.platform ?? '—'}</span>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Counts */}
        <div>
          <h2 className={styles.sectionTitle}>Contenido del sistema</h2>
          {loading ? (
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => <div key={i} className={styles.statSkeleton} />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <StatCard title="Total usuarios"   value={stats?.counts.totalUsers ?? 0}   color="blue"   subtitle="registrados"   icon={<IconUsers />}   />
              <StatCard title="Activos"           value={stats?.counts.activeUsers ?? 0}  color="green"  subtitle="en el sistema" icon={<IconUsers />}   />
              <StatCard title="Casos activos"     value={stats?.counts.totalCasos ?? 0}   color="indigo" subtitle="en curso"      icon={<IconLaw />}     />
              <StatCard title="Clientes activos"  value={stats?.counts.totalClients ?? 0} color="amber"  subtitle="registrados"   icon={<IconClients />} />
            </div>
          )}
        </div>
      </div>

      {/* Quick access */}
      <div>
        <h2 className={styles.sectionTitle}>Acceso rápido</h2>
        <div className={styles.actionsGrid}>
          <Link to="/users">
            <Card hover className="flex items-start gap-4 group">
              <div className={styles.actionIcon.purple}><IconUsers /></div>
              <div>
                <h3 className={styles.actionTitle}>Usuarios</h3>
                <p className={styles.actionSubtitle}>Administrar usuarios del sistema</p>
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
        </div>
      </div>

    </div>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [agendadas, setAgendadas] = useState<CasoNovedad[]>([]);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleMsg, setGoogleMsg] = useState<string | null>(null);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [adminLoading, setAdminLoading] = useState(true);

  const isAdmin = user?.role === 'ADMIN';
  const canSeeStats = user?.role === 'ABOGADO';

  useEffect(() => {
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
    if (!isAdmin) { setAdminLoading(false); return; }
    adminApi.getStats().then(setAdminStats).catch(console.error).finally(() => setAdminLoading(false));
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin || !canSeeStats) { setIsLoading(false); return; }
    clientsApi.getStats().then(setStats).catch(console.error).finally(() => setIsLoading(false));
  }, [canSeeStats, isAdmin]);

  useEffect(() => {
    if (isAdmin) return;
    casoNovedadesApi.getAgendadas().then(setAgendadas).catch(() => {});
    googleCalendarApi.getStatus().then((s) => setGoogleConnected(s.connected)).catch(() => {});
  }, [isAdmin]);

  async function handleGoogleConnect() {
    const { url } = await googleCalendarApi.getConnectUrl();
    window.location.href = url;
  }

  if (isAdmin) {
    return <AdminDashboard user={user!} stats={adminStats} loading={adminLoading} />;
  }

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
  const roleLabelMap: Record<string, string> = {
    ADMIN: 'Administrador', ABOGADO: 'Abogado', CLIENTE: 'Cliente', AUXILIAR: 'Auxiliar',
  };
  const roleLabel = roleLabelMap[user?.role ?? 'CLIENTE'];

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

      {/* Stats — solo abogado */}
      {canSeeStats && (
        <div>
          <h2 className={styles.sectionTitle}>Resumen del sistema</h2>
          {isLoading ? (
            <div className={styles.statsGrid}>
              {SKELETON_KEYS.map((i) => <div key={i} className={styles.statSkeleton} />)}
            </div>
          ) : (
            <div className={styles.statsGrid}>
              <StatCard title="Total Clientes" value={stats?.totalClients ?? 0}  color="indigo" subtitle="clientes activos" icon={<IconClients />} />
              <StatCard title="Usuarios"        value={stats?.totalUsers ?? 0}    color="blue"   subtitle="usuarios activos" icon={<IconUsers />} />
              <StatCard title="Abogados"         value={stats?.abogados ?? 0}      color="green"  subtitle="en el equipo"    icon={<IconLaw />} />
              <StatCard title="Nuevos (30d)"    value={stats?.recentClients ?? 0} color="amber"  subtitle="últimos 30 días" icon={<IconTrend />} />
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

      {/* Agenda — solo abogado */}
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
