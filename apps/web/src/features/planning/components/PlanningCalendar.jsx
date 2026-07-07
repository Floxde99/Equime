import frLocale from '@fullcalendar/core/locales/fr';
import dayGridPlugin from '@fullcalendar/daygrid';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';

/** Couleurs de statut cours (design system §2). */
const STATUS_COLORS = {
  scheduled: '#2351a4',
  ongoing: '#4a8fd4',
  completed: '#3d9a6b',
  cancelled: '#c94c4c',
};

/**
 * Calendrier planning partagé (US-4.2).
 * @param {{ events: Array<object>, scope: 'mine' | 'all', onScopeChange: (s: 'mine' | 'all') => void,
 *   onDatesChange?: (range: { from: string, to: string }) => void, showScopeToggle?: boolean }} props
 */
export function PlanningCalendar({
  events,
  scope,
  onScopeChange,
  onDatesChange,
  showScopeToggle = true,
}) {
  const coloredEvents = events.map((event) => ({
    ...event,
    backgroundColor: STATUS_COLORS[event.extendedProps?.status] ?? STATUS_COLORS.scheduled,
    borderColor: 'transparent',
  }));

  return (
    <div className="space-y-4">
      {showScopeToggle ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtre du planning">
          {[
            { id: 'mine', label: 'Mon planning' },
            { id: 'all', label: 'Structure' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onScopeChange(opt.id)}
              className={
                scope === opt.id
                  ? 'rounded-lg bg-accent px-3 py-1.5 font-sans text-sm text-text'
                  : 'rounded-lg border border-border px-3 py-1.5 font-sans text-sm text-muted hover:bg-surface-raised'
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-surface p-3 [&_.fc]:font-sans [&_.fc-toolbar-title]:font-display [&_.fc-toolbar-title]:text-text [&_.fc-col-header-cell]:text-muted [&_.fc-daygrid-day-number]:text-muted">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin]}
          locale={frLocale}
          initialView="timeGridWeek"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek',
          }}
          height="auto"
          events={coloredEvents}
          datesSet={({ start, end }) => {
            onDatesChange?.({ from: start.toISOString(), to: end.toISOString() });
          }}
        />
      </div>
    </div>
  );
}
