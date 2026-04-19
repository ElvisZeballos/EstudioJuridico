import { useState } from 'react';
import type { CasoNovedad } from '../types';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS_SEMANA = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

interface Props {
  novedades: CasoNovedad[];
}

export function CalendarioAgenda({ novedades }: Props) {
  const hoy = new Date();
  const [viewDate, setViewDate] = useState(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  function prevMonth() { setViewDate(new Date(year, month - 1, 1)); setSelectedDay(null); }
  function nextMonth() { setViewDate(new Date(year, month + 1, 1)); setSelectedDay(null); }

  // Build day cells
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  // Group novedades by day string YYYY-MM-DD
  const byDay: Record<string, CasoNovedad[]> = {};
  for (const n of novedades) {
    if (!n.fechaAgendada) continue;
    const d = new Date(n.fechaAgendada);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    (byDay[key] ??= []).push(n);
  }

  function dayKey(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const todayKey = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

  const selectedEvents = selectedDay ? (byDay[selectedDay] ?? []) : [];

  // Upcoming events (next 30 days from today)
  const upcoming = novedades
    .filter((n) => n.fechaAgendada && new Date(n.fechaAgendada) >= hoy)
    .sort((a, b) => new Date(a.fechaAgendada!).getTime() - new Date(b.fechaAgendada!).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Calendar header */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-gray-900 dark:text-white">
          {MESES[month]} {year}
        </span>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 text-center">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="text-xs font-medium text-gray-400 dark:text-gray-500 py-1">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;
          const key = dayKey(day);
          const isToday = key === todayKey;
          const isSelected = key === selectedDay;
          const events = byDay[key] ?? [];
          const hasEvents = events.length > 0;

          return (
            <button
              key={key}
              onClick={() => setSelectedDay(isSelected ? null : key)}
              className={`
                relative mx-auto w-8 h-8 rounded-full text-xs font-medium flex items-center justify-center transition-colors
                ${isSelected ? 'bg-indigo-600 text-white' : isToday ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}
              `}
            >
              {day}
              {hasEvents && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                  {events.slice(0, 3).map((_, idx) => (
                    <span key={idx} className="w-1 h-1 rounded-full bg-indigo-500 dark:bg-indigo-400" />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day events */}
      {selectedDay && (
        <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {new Date(selectedDay + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          {selectedEvents.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500">Sin eventos agendados</p>
          ) : (
            selectedEvents.map((n) => <EventRow key={n.id} novedad={n} />)
          )}
        </div>
      )}

      {/* Upcoming */}
      {!selectedDay && upcoming.length > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Próximos eventos</p>
          {upcoming.map((n) => <EventRow key={n.id} novedad={n} />)}
        </div>
      )}

      {!selectedDay && upcoming.length === 0 && (
        <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
          <p className="text-xs text-gray-400 dark:text-gray-500">No hay eventos próximos agendados.</p>
        </div>
      )}
    </div>
  );
}

function EventRow({ novedad }: { novedad: CasoNovedad }) {
  const fecha = new Date(novedad.fechaAgendada!);
  return (
    <div className="flex items-start gap-2.5 p-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/40">
      <div className="shrink-0 text-center mt-0.5">
        <div className="text-xs font-bold text-indigo-700 dark:text-indigo-300 leading-none">
          {fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{novedad.titulo}</p>
        {novedad.caso && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{novedad.caso.titulo}</p>
        )}
        {novedad.googleCalendarEventId && (
          <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-0.5 mt-0.5">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            En Google Calendar
          </span>
        )}
      </div>
    </div>
  );
}
