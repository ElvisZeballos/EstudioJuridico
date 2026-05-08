import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { clientsApi, casoNovedadesApi, googleCalendarApi, adminApi, casosApi } from '../services/api';
import { StatCard, Card } from '../components/ui/Card';
import type { DashboardStats, CasoNovedad, AdminStats, User, Caso } from '../types';
import { styles } from './Dashboard.styles';

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
const IconProfile = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
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
const IconBriefcase = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);
const IconCalendar = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);
const IconChevronRight = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);
const IconArrowRight = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
  </svg>
);
const IconBell = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);
const IconX = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const ESTADO_CONFIG: Record<string, { label: string; classes: string; dotClass: string }> = {
  ACTIVO:    { label: 'Activo',    dotClass: 'bg-emerald-500', classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  PENDIENTE: { label: 'Pendiente', dotClass: 'bg-amber-500',   classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  CONCLUIDO: { label: 'Concluido', dotClass: 'bg-blue-400',    classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  ARCHIVADO: { label: 'Archivado', dotClass: 'bg-gray-400',    classes: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
};

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
              {generatedAt && <span className={styles.adminBannerTime}>Actualizado {generatedAt}</span>}
            </div>
          </div>
          <Link to="/profile" className={styles.adminBannerBtn}>
            <IconProfile /> Mi Perfil
          </Link>
        </div>
      </div>

      <div>
        <h2 className={styles.sectionTitle}>Estado del sistema</h2>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                  <MiniBar used={stats?.server.memory.heapUsedMB ?? 0} total={stats?.server.memory.heapTotalMB ?? 1} color="bg-indigo-500" />
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
        <div>
          <h2 className={styles.sectionTitle}>Contenido del sistema</h2>
          {loading ? (
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => <div key={i} className={styles.statSkeleton} />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <StatCard title="Total usuarios"  value={stats?.counts.totalUsers ?? 0}   color="blue"   subtitle="registrados"   icon={<IconUsers />} />
              <StatCard title="Activos"          value={stats?.counts.activeUsers ?? 0}  color="green"  subtitle="en el sistema" icon={<IconUsers />} />
              <StatCard title="Casos activos"    value={stats?.counts.totalCasos ?? 0}   color="indigo" subtitle="en curso"      icon={<IconBriefcase />} />
              <StatCard title="Clientes activos" value={stats?.counts.totalClients ?? 0} color="amber"  subtitle="registrados"   icon={<IconClients />} />
            </div>
          )}
        </div>
      </div>

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
  const [statsLoading, setStatsLoading] = useState(true);
  const [agendadas, setAgendadas] = useState<CasoNovedad[]>([]);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleMsg, setGoogleMsg] = useState<string | null>(null);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [adminLoading, setAdminLoading] = useState(true);
  const [casos, setCasos] = useState<Caso[]>([]);
  const [casosLoading, setCasosLoading] = useState(true);
  const [notificaciones, setNotificaciones] = useState<CasoNovedad[]>([]);
  const [previewNovedad, setPreviewNovedad] = useState<CasoNovedad | null>(null);
  const [previewArchivo, setPreviewArchivo] = useState<{ nombre: string; driveId: string; driveUrl: string; tipo: 'pdf' | 'imagen' } | null>(null);

  const isAdmin = user?.role === 'ADMIN';
  const isAbogado = user?.role === 'ABOGADO' || user?.role === 'AUXILIAR';

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
    if (isAdmin) { setStatsLoading(false); return; }
    clientsApi.getStats().then(setStats).catch(console.error).finally(() => setStatsLoading(false));
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) return;
    casoNovedadesApi.getAgendadas().then(setAgendadas).catch(() => {});
    googleCalendarApi.getStatus().then((s) => setGoogleConnected(s.connected)).catch(() => {});
    casoNovedadesApi.getNotificaciones().then(setNotificaciones).catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) { setCasosLoading(false); return; }
    casosApi.getAll().then(setCasos).catch(() => {}).finally(() => setCasosLoading(false));
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

  const casosActivos = casos.filter(c => c.estado === 'ACTIVO');
  const casosPendientes = casos.filter(c => c.estado === 'PENDIENTE');
  const casosConcluidos = casos.filter(c => c.estado === 'CONCLUIDO');
  const casosVisibles = [...casosActivos, ...casosPendientes].slice(0, 8);

  const proximosEventos = agendadas
    .filter(n => n.fechaAgendada && new Date(n.fechaAgendada) >= now)
    .sort((a, b) => new Date(a.fechaAgendada!).getTime() - new Date(b.fechaAgendada!).getTime())
    .slice(0, 6);

  return (
    <div className="space-y-6">

      {/* Banner */}
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
            {isAbogado && !googleConnected && (
              <button onClick={handleGoogleConnect} className={styles.bannerBtnSecondary}>
                <IconCalendar /> Conectar Calendar
              </button>
            )}
            <Link to="/profile" className={styles.bannerBtnPrimary}>
              <IconProfile /> Mi Perfil
            </Link>
          </div>
        </div>
      </div>

      {/* Google Calendar toast */}
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

      {/* Stat cards */}
      {isAbogado && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Casos Activos"
            value={casosLoading ? 0 : casosActivos.length}
            color="green"
            subtitle={casosLoading ? 'Cargando...' : 'en curso'}
            icon={<IconBriefcase />}
          />
          <StatCard
            title="Casos Pendientes"
            value={casosLoading ? 0 : casosPendientes.length}
            color="amber"
            subtitle={casosLoading ? 'Cargando...' : 'por atender'}
            icon={<IconBriefcase />}
          />
          <StatCard
            title="Total Clientes"
            value={statsLoading ? 0 : (stats?.totalClients ?? 0)}
            color="indigo"
            subtitle={statsLoading ? 'Cargando...' : 'registrados'}
            icon={<IconClients />}
          />
          <StatCard
            title="Próximos Eventos"
            value={proximosEventos.length}
            color="blue"
            subtitle="agendados"
            icon={<IconCalendar />}
          />
        </div>
      )}

      {/* Main content */}
      {isAbogado ? (
        <>
        {/* Notifications panel */}
        {notificaciones.length > 0 && (
          <Card>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                <IconBell />
              </div>
              <h2 className="font-semibold text-gray-900 dark:text-white flex-1">Notificaciones</h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
                {notificaciones.length}
              </span>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {notificaciones.slice(0, 8).map(n => (
                <button
                  key={n.id}
                  onClick={() => setPreviewNovedad(n)}
                  className="w-full flex items-start gap-3 py-3 hover:bg-amber-50 dark:hover:bg-amber-900/10 -mx-3 px-3 rounded-xl transition-colors text-left group"
                >
                  <span className="mt-1.5 w-2 h-2 rounded-full shrink-0 bg-amber-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
                      {n.titulo}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {n.caso && <span className="truncate">{n.caso.titulo}</span>}
                      <span className="shrink-0">·</span>
                      <span className="shrink-0">
                        {new Date(n.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 mt-1 text-xs text-amber-500 dark:text-amber-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    Ver →
                  </span>
                </button>
              ))}
            </div>
          </Card>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Cases panel (2/3) */}
          <div className="lg:col-span-2">
            <Card>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                    <IconBriefcase />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900 dark:text-white">Mis Casos</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {casosLoading ? 'Cargando...' : `${casosActivos.length + casosPendientes.length} activos y pendientes`}
                    </p>
                  </div>
                </div>
                <Link
                  to="/casos"
                  className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 font-medium"
                >
                  Ver todos <IconArrowRight />
                </Link>
              </div>

              {casosLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-14 bg-gray-100 dark:bg-gray-700/50 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : casosVisibles.length === 0 ? (
                <div className="text-center py-10">
                  <div className="flex justify-center mb-3 text-gray-300 dark:text-gray-600">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">No hay casos activos o pendientes</p>
                  <Link to="/casos" className="text-indigo-600 dark:text-indigo-400 text-sm hover:underline mt-1 inline-block font-medium">
                    Ir a casos →
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
                  {casosVisibles.map(caso => {
                    const estado = ESTADO_CONFIG[caso.estado];
                    const clienteNames = caso.clientes
                      .map(c => `${c.cliente.nombre} ${c.cliente.apellido}`)
                      .join(', ');
                    return (
                      <Link
                        key={caso.id}
                        to={`/casos/${caso.id}`}
                        className="flex items-start gap-3 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/30 -mx-3 px-3 rounded-xl transition-colors group"
                      >
                        <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${estado.dotClass}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {caso.titulo}
                            </p>
                            <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${estado.classes}`}>
                              {estado.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                            {clienteNames && <span className="truncate">{clienteNames}</span>}
                            {caso.juzgado && <span className="shrink-0">· {caso.juzgado.nombre}</span>}
                            {caso.numero && <span className="shrink-0">· Exp. {caso.numero}</span>}
                          </div>
                        </div>
                        <span className="text-gray-300 dark:text-gray-600 group-hover:text-indigo-400 transition-colors shrink-0 mt-1">
                          <IconChevronRight />
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}

              {!casosLoading && casosConcluidos.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <Link
                    to="/casos"
                    className="text-xs text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    + {casosConcluidos.length} casos concluidos
                  </Link>
                </div>
              )}
            </Card>
          </div>

          {/* Sidebar (1/3) */}
          <div className="space-y-5">

            {/* Upcoming events */}
            <Card>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                  <IconCalendar />
                </div>
                <h2 className="font-semibold text-gray-900 dark:text-white">Próxima Agenda</h2>
              </div>

              {!googleConnected ? (
                <div className="text-center py-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Conecta Google Calendar para ver tus eventos próximos
                  </p>
                  <button
                    onClick={handleGoogleConnect}
                    className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    Conectar Google Calendar
                  </button>
                </div>
              ) : proximosEventos.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
                  No hay eventos próximos agendados
                </p>
              ) : (
                <div className="space-y-3">
                  {proximosEventos.map(ev => {
                    const fecha = new Date(ev.fechaAgendada!);
                    const isHoy = fecha.toDateString() === now.toDateString();
                    const manana = new Date(now);
                    manana.setDate(manana.getDate() + 1);
                    const esManana = fecha.toDateString() === manana.toDateString();
                    return (
                      <div key={ev.id} className="flex gap-3">
                        <div className={`shrink-0 w-10 h-10 rounded-xl flex flex-col items-center justify-center ${isHoy ? 'bg-rose-100 dark:bg-rose-900/30' : 'bg-indigo-50 dark:bg-indigo-900/30'}`}>
                          <span className={`text-sm font-bold leading-none ${isHoy ? 'text-rose-600 dark:text-rose-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                            {fecha.getDate()}
                          </span>
                          <span className={`text-[9px] uppercase font-medium mt-0.5 ${isHoy ? 'text-rose-400' : 'text-indigo-400 dark:text-indigo-500'}`}>
                            {isHoy ? 'Hoy' : esManana ? 'Mañ' : fecha.toLocaleDateString('es-AR', { month: 'short' })}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate leading-tight">{ev.titulo}</p>
                            <span className="shrink-0 text-sm font-semibold font-mono text-indigo-600 dark:text-indigo-400">
                              {fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          {ev.caso ? (
                            <Link
                              to={`/casos/${ev.casoId}`}
                              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline truncate block mt-0.5"
                            >
                              {ev.caso.titulo}
                            </Link>
                          ) : (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{ev.contenido.slice(0, 50)}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Quick actions */}
            <Card>
              <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Acciones rápidas</h2>
              <div className="space-y-1">
                {([
                  { to: '/casos',   icon: <IconBriefcase />, label: 'Ver Casos',    sub: 'Gestionar expedientes', iconClass: styles.actionIcon.indigo },
                  { to: '/clients', icon: <IconClients />,   label: 'Ver Clientes', sub: 'Gestionar clientes',    iconClass: styles.actionIcon.green },
                  { to: '/profile', icon: <IconProfile />,   label: 'Mi Perfil',    sub: 'Actualizar datos',      iconClass: styles.actionIcon.purple },
                ] as const).map(item => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors group"
                  >
                    <div className={item.iconClass}>{item.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{item.sub}</p>
                    </div>
                    <span className="text-gray-300 dark:text-gray-600 group-hover:text-indigo-400 transition-colors">
                      <IconChevronRight />
                    </span>
                  </Link>
                ))}
              </div>
            </Card>

          </div>
        </div>

        </>
      ) : (
        /* Simple layout for CLIENTE */
        <div className={styles.actionsGrid}>
          <Link to="/clients">
            <Card hover className="flex items-start gap-4 group">
              <div className={styles.actionIcon.indigo}><IconClients /></div>
              <div>
                <h3 className={styles.actionTitle}>Mi Expediente</h3>
                <p className={styles.actionSubtitle}>Ver mi información legal</p>
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
      )}

      {/* Preview modal */}
      {previewNovedad && (() => {
        const archivos: { nombre: string; driveId: string; driveUrl: string; tipo: 'pdf' | 'imagen' }[] = (() => {
          try { return previewNovedad.archivos ? JSON.parse(previewNovedad.archivos) : []; }
          catch { return []; }
        })();
        const imagenes = archivos.filter(a => a.tipo === 'imagen');
        const pdfs = archivos.filter(a => a.tipo === 'pdf');
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setPreviewNovedad(null)}
          >
            <div
              className="relative w-full max-w-xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100 dark:border-gray-700 shrink-0">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 shrink-0">
                    <IconBell />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white leading-tight">{previewNovedad.titulo}</h3>
                    {previewNovedad.caso && (
                      <Link
                        to={`/casos/${previewNovedad.casoId}`}
                        onClick={() => setPreviewNovedad(null)}
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline mt-0.5 block"
                      >
                        {previewNovedad.caso.titulo}
                      </Link>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setPreviewNovedad(null)}
                  className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <IconX />
                </button>
              </div>
              {/* Meta */}
              <div className="flex items-center gap-4 px-5 py-2 bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 dark:text-gray-400 shrink-0">
                <span>
                  {new Date(previewNovedad.fecha).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                <span>·</span>
                <span>{previewNovedad.autor.nombre} {previewNovedad.autor.apellido}</span>
              </div>
              {/* Scrollable body */}
              <div className="overflow-y-auto flex-1">
                {/* Contenido */}
                <div className="p-5">
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {previewNovedad.contenido.split(/\n+Archivos:/i)[0].trim()}
                  </p>
                </div>
                {/* Images */}
                {imagenes.length > 0 && (
                  <div className="px-5 pb-4">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                      Imágenes adjuntas
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {imagenes.map(img => (
                        <button
                          key={img.driveId}
                          onClick={() => setPreviewArchivo(img)}
                          className="group relative block rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-indigo-400 transition-colors text-left"
                        >
                          <img
                            src={`https://drive.google.com/thumbnail?id=${img.driveId}&sz=w400`}
                            alt={img.nombre}
                            className="w-full h-36 object-cover group-hover:scale-105 transition-transform duration-200"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                            <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 bg-black/60 px-2.5 py-1 rounded-lg transition-opacity">
                              Ver imagen
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 px-2 py-1 truncate bg-gray-50 dark:bg-gray-700/50">
                            {img.nombre}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {/* PDFs */}
                {pdfs.length > 0 && (
                  <div className="px-5 pb-4">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                      Documentos adjuntos
                    </p>
                    <div className="space-y-2">
                      {pdfs.map(pdf => (
                        <button
                          key={pdf.driveId}
                          onClick={() => setPreviewArchivo(pdf)}
                          className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors group text-left"
                        >
                          <div className="shrink-0 w-9 h-9 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <span className="text-sm text-gray-800 dark:text-gray-200 truncate flex-1 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">
                            {pdf.nombre}
                          </span>
                          <svg className="w-4 h-4 text-gray-400 group-hover:text-indigo-500 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {/* Footer */}
              <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100 dark:border-gray-700 shrink-0">
                {previewNovedad.caso && (
                  <Link
                    to={`/casos/${previewNovedad.casoId}`}
                    onClick={() => setPreviewNovedad(null)}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
                  >
                    Ver caso →
                  </Link>
                )}
                <button
                  onClick={() => setPreviewNovedad(null)}
                  className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* File viewer modal */}
      {previewArchivo && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setPreviewArchivo(null)}
        >
          <div
            className={`relative flex flex-col rounded-2xl shadow-2xl overflow-hidden w-full max-w-3xl ${previewArchivo.tipo === 'pdf' ? 'bg-white dark:bg-gray-900' : 'bg-transparent'}`}
            style={{ maxHeight: '90vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`flex items-center justify-between gap-3 px-4 py-3 shrink-0 ${previewArchivo.tipo === 'imagen' ? 'bg-black/60 backdrop-blur-md' : 'bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700'}`}>
              <div className="flex items-center gap-2 min-w-0">
                {previewArchivo.tipo === 'pdf' ? (
                  <div className="shrink-0 w-7 h-7 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                ) : (
                  <div className="shrink-0 w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-white">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                <p className={`text-sm font-medium truncate ${previewArchivo.tipo === 'imagen' ? 'text-white' : 'text-gray-800 dark:text-gray-100'}`}>
                  {previewArchivo.nombre}
                </p>
              </div>
              <button
                onClick={() => setPreviewArchivo(null)}
                className={`shrink-0 p-1.5 rounded-lg transition-colors ${previewArchivo.tipo === 'imagen' ? 'text-white/70 hover:text-white hover:bg-white/20' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
              >
                <IconX />
              </button>
            </div>
            {/* Content */}
            {previewArchivo.tipo === 'imagen' ? (
              <div className="flex items-center justify-center p-3" style={{ maxHeight: 'calc(90vh - 52px)' }}>
                <img
                  src={`https://drive.google.com/uc?export=view&id=${previewArchivo.driveId}`}
                  alt={previewArchivo.nombre}
                  className="max-w-full rounded-xl object-contain shadow-2xl"
                  style={{ maxHeight: 'calc(90vh - 72px)' }}
                />
              </div>
            ) : (
              <iframe
                src={`https://drive.google.com/file/d/${previewArchivo.driveId}/preview`}
                className="w-full border-0"
                style={{ height: '75vh' }}
                title={previewArchivo.nombre}
                allow="autoplay"
              />
            )}
          </div>
        </div>
      )}

    </div>
  );
}
