import { COURSE_STATUS_LABELS } from '@equime/shared';
import frLocale from '@fullcalendar/core/locales/fr';
import dayGridPlugin from '@fullcalendar/daygrid';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import {
  formatEventAriaLabel,
  PLANNING_LEGEND_STATUSES,
  planningSlotWindow,
  toCalendarEvent,
} from '@/features/planning/calendarTheme.js';

const SCOPE_OPTIONS = [
  { id: 'mine', label: 'Mon planning' },
  { id: 'all', label: 'Structure' },
];

const TIME_FORMAT = { hour: '2-digit', minute: '2-digit', hour12: false };

const DAY_HEADER_FORMAT = { weekday: 'short', day: 'numeric', month: 'numeric' };

const PLUGINS = [dayGridPlugin, timeGridPlugin];

const HEADER_TOOLBAR = {
  left: 'prev,next today',
  center: 'title',
  right: 'dayGridMonth,timeGridWeek,timeGridDay',
};

const BUTTON_TEXT = {
  today: "Aujourd'hui",
  month: 'Mois',
  week: 'Semaine',
  day: 'Jour',
};

/**
 * Calendrier planning partagé (US-4.2).
 * Vue semaine 8 h–18 h (élargie si besoin), couleurs de statut tokens, libellés français.
 *
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
  const coloredEvents = useMemo(() => events.map(toCalendarEvent), [events]);
  const slotWindow = useMemo(() => planningSlotWindow(events), [events]);
  const onDatesChangeRef = useRef(onDatesChange);
  // Assignation dans un effet, pas au render (cf. dialog.jsx).
  useEffect(() => {
    onDatesChangeRef.current = onDatesChange;
  }, [onDatesChange]);
  const lastRangeRef = useRef({ from: '', to: '' });

  const handleDatesSet = useCallback(({ start, end }) => {
    const from = start.toISOString();
    const to = end.toISOString();
    if (lastRangeRef.current.from === from && lastRangeRef.current.to === to) return;
    lastRangeRef.current = { from, to };
    onDatesChangeRef.current?.({ from, to });
  }, []);

  return (
    <div className="space-y-4">
      {showScopeToggle ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtre du planning">
          {SCOPE_OPTIONS.map((opt) => {
            const selected = scope === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onScopeChange(opt.id)}
                className={
                  selected
                    ? 'inline-flex min-h-11 items-center rounded-lg bg-accent/15 px-3 font-sans text-sm font-semibold text-on-card ring-1 ring-accent'
                    : 'inline-flex min-h-11 items-center rounded-lg border border-border-on-card bg-card px-3 font-sans text-sm text-muted-on-card hover:bg-paper'
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="equime-fc-wrap overflow-x-auto rounded-xl border border-border-on-card bg-card p-3 md:p-4">
        <FullCalendar
          plugins={PLUGINS}
          locale={frLocale}
          firstDay={1}
          initialView="timeGridWeek"
          headerToolbar={HEADER_TOOLBAR}
          buttonText={BUTTON_TEXT}
          height="auto"
          contentHeight="auto"
          stickyHeaderDates
          nowIndicator
          allDaySlot={false}
          slotMinTime={slotWindow.slotMinTime}
          slotMaxTime={slotWindow.slotMaxTime}
          slotDuration="00:30:00"
          slotLabelInterval="01:00:00"
          slotEventOverlap={false}
          displayEventEnd
          eventTimeFormat={TIME_FORMAT}
          slotLabelFormat={TIME_FORMAT}
          dayHeaderFormat={DAY_HEADER_FORMAT}
          events={coloredEvents}
          eventContent={renderEventContent}
          eventDidMount={annotateEventEl}
          datesSet={handleDatesSet}
        />
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Légende des statuts de cours">
        {PLANNING_LEGEND_STATUSES.map((status) => (
          <li key={status} className="flex items-center gap-2 font-sans text-sm text-muted">
            <span
              className={`size-3 shrink-0 rounded-full equime-fc-swatch--${status}`}
              aria-hidden="true"
            />
            {COURSE_STATUS_LABELS[status]}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Bloc événement : titre + horaire + lieu. Le statut se lit par la couleur et la légende.
 * @param {import('@fullcalendar/core').EventContentArg} arg
 */
function renderEventContent(arg) {
  const spaceName = arg.event.extendedProps?.spaceName;
  const isMonth = arg.view.type === 'dayGridMonth';

  return (
    <div className="equime-fc-event__inner">
      <p className="equime-fc-event__title">{arg.event.title}</p>
      {arg.timeText ? <p className="equime-fc-event__time">{arg.timeText}</p> : null}
      {!isMonth && spaceName ? <p className="equime-fc-event__space">{spaceName}</p> : null}
    </div>
  );
}

/**
 * @param {import('@fullcalendar/core').EventMountArg} info
 */
function annotateEventEl(info) {
  const label = formatEventAriaLabel({
    title: info.event.title,
    timeText: info.timeText,
    extendedProps: info.event.extendedProps,
  });
  info.el.setAttribute('title', label);
  info.el.setAttribute('aria-label', label);
}
