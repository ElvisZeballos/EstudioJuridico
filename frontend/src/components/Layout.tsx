import { useState, useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { BottomNav } from './BottomNav';

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const abiertoRef = useRef(false);
  useEffect(() => { abiertoRef.current = sidebarOpen; }, [sidebarOpen]);
  // Gesto táctil: arrastrar desde el borde izquierdo hacia el centro abre el menú (solo pantallas táctiles)
  useEffect(() => {
    if (!window.matchMedia('(pointer: coarse)').matches) return;
    const EDGE = 35;   // px desde el borde izquierdo donde puede empezar el gesto
    const MIN_DX = 60; // recorrido horizontal mínimo para abrir
    const MAX_DY = 40; // tolerancia vertical, para no confundirlo con un scroll
    let startX = 0;
    let startY = 0;
    let tracking = false;

    function onStart(e: TouchEvent) {
      const t = e.touches[0];
      const movil = window.innerWidth < 1024; // 1024 = breakpoint lg (menú fijo)
      // cerrado: el gesto debe empezar en el borde izquierdo; abierto: puede empezar en cualquier parte
      tracking = movil && (abiertoRef.current || t.clientX <= EDGE);
      startX = t.clientX;
      startY = t.clientY;
    }
    function onMove(e: TouchEvent) {
      if (!tracking) return;
      const t = e.touches[0];
      if (Math.abs(t.clientY - startY) > MAX_DY) { tracking = false; return; }
      const dx = t.clientX - startX;
      if (!abiertoRef.current && dx > MIN_DX) { tracking = false; setSidebarOpen(true); }
      else if (abiertoRef.current && dx < -MIN_DX) { tracking = false; setSidebarOpen(false); }    }
    function onEnd() { tracking = false; }

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };
  }, []);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar onMenuToggle={() => setSidebarOpen((v) => !v)} />
        <main className="flex-1 overflow-y-auto p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8 lg:pb-8">
          <div className="max-w-7xl mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
