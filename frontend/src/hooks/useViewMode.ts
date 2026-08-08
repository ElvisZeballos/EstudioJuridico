import { useState } from 'react';

export type ViewMode = 'grid' | 'list';

export function useViewMode(key: string, enabled: boolean = true) {
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    if (!enabled) return 'grid';
    const saved = localStorage.getItem(`viewMode:${key}`);
    return saved === 'list' ? 'list' : 'grid';
  });

  function setViewMode(mode: ViewMode) {
    setViewModeState(mode);
    localStorage.setItem(`viewMode:${key}`, mode);
  }

  return { viewMode: enabled ? viewMode : 'grid', setViewMode };
}