export const styles = {
  // Layout
  page: 'space-y-8',

  // Welcome banner
  banner: 'relative overflow-hidden bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-5 sm:p-8 shadow-xl',
  bannerBlobTop: 'absolute -top-10 -right-10 w-60 h-60 bg-white/10 rounded-full blur-3xl',
  bannerBlobBottom: 'absolute -bottom-10 -left-10 w-60 h-60 bg-purple-400/20 rounded-full blur-3xl',
  bannerContent: 'relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4',
  bannerGreeting: 'text-indigo-200 text-sm font-medium',
  bannerName: 'text-2xl sm:text-3xl font-bold text-white mt-1',
  bannerBadgeRow: 'flex items-center gap-2 mt-2 flex-wrap',
  bannerRoleBadge: 'px-3 py-1 rounded-full bg-white/20 text-white text-xs font-semibold backdrop-blur-sm',
  bannerDate: 'text-indigo-200 text-xs hidden sm:inline',
  bannerActions: 'flex flex-wrap gap-2 sm:gap-3',
  bannerBtnSecondary: 'inline-flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-sm font-medium transition-all backdrop-blur-sm border border-white/20',
  bannerBtnPrimary: 'inline-flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-white text-indigo-700 text-sm font-semibold hover:bg-indigo-50 transition-all shadow-lg',

  // Section titles
  sectionTitle: 'text-lg font-semibold text-gray-900 dark:text-white mb-4',

  // Stats
  statsGrid: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4',
  statSkeleton: 'h-28 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse',

  // Quick actions
  actionsGrid: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4',
  actionIcon: {
    indigo: 'p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50 transition-colors',
    green:  'p-3 rounded-xl bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 group-hover:bg-green-100 dark:group-hover:bg-green-900/50 transition-colors',
    purple: 'p-3 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/50 transition-colors',
  },
  actionTitle: 'font-semibold text-gray-900 dark:text-white',
  actionSubtitle: 'text-sm text-gray-500 dark:text-gray-400 mt-0.5',

  // Admin banner
  adminBanner: 'relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-5 sm:p-8 shadow-xl',
  adminBannerBlob: 'absolute -top-10 -right-10 w-60 h-60 bg-white/5 rounded-full blur-3xl',
  adminBannerContent: 'relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4',
  adminBannerLabel: 'text-slate-400 text-xs font-semibold uppercase tracking-widest',
  adminBannerTitle: 'text-2xl sm:text-3xl font-bold text-white mt-1',
  adminBannerMeta: 'flex items-center gap-3 mt-2 flex-wrap',
  adminBannerVersion: 'px-2.5 py-0.5 rounded bg-slate-700 text-slate-300 text-xs font-mono',
  adminBannerStatus: 'flex items-center gap-1.5 text-emerald-400 text-xs font-semibold',
  adminBannerStatusDot: 'w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block',
  adminBannerTime: 'text-slate-500 text-xs hidden sm:inline',
  adminBannerBtn: 'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-all border border-slate-600',

  // System info
  infoHeader: 'flex items-center gap-3 mb-4',
  infoIconWrapper: 'w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center',
  infoIcon: 'w-5 h-5 text-indigo-600 dark:text-indigo-400',
  infoTitle: 'font-semibold text-gray-900 dark:text-white',
  infoGrid: 'grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm',
  infoLabel: 'text-gray-500 dark:text-gray-400',
  infoValue: 'font-medium text-gray-900 dark:text-white',
  infoOnline: 'font-medium text-green-600 dark:text-green-400 flex items-center gap-1.5',
  infoOnlineDot: 'w-2 h-2 rounded-full bg-green-500 inline-block animate-pulse',
};
