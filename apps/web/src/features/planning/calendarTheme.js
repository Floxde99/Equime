import { COURSE_STATUS_LABELS } from '@equime/shared';

/**
 * Mapping statut cours → token sémantique (design system §5).
 * Fond à 15 % via `color-mix` ; bordure et texte en couleur pleine.
 */
export const COURSE_STATUS_TOKENS = Object.freeze({
  draft: 'muted',
  scheduled: 'info',
  ongoing: 'accent',
  completed: 'success',
  cancelled: 'muted',
});

/** Statuts affichés dans la légende (ceux renvoyés par l’API planning). */
export const PLANNING_LEGEND_STATUSES = Object.freeze(['scheduled', 'ongoing', 'completed']);

/** Fenêtre horaire par défaut (vue semaine) : 8 h–18 h. */
export const PLANNING_DEFAULT_SLOT_MIN_HOUR = 8;
export const PLANNING_DEFAULT_SLOT_MAX_HOUR = 18;

/**
 * Formate une heure entière en `HH:00:00` pour FullCalendar (`slotMinTime` / `slotMaxTime`).
 * @param {number} hour
 */
function formatSlotTime(hour) {
  const clamped = Math.max(0, Math.min(24, hour));
  return `${String(clamped).padStart(2, '0')}:00:00`;
}

/**
 * Fenêtre horaire de la grille : 8 h–18 h, élargie si un cours sort de cette plage.
 * `slotMaxTime` est exclusif : un cours qui se termine à 19 h demande `19:00:00`.
 *
 * @param {Array<{ start?: string | Date, end?: string | Date }>} [events]
 * @returns {{ slotMinTime: string, slotMaxTime: string }}
 */
export function planningSlotWindow(events = []) {
  let minHour = PLANNING_DEFAULT_SLOT_MIN_HOUR;
  let maxHour = PLANNING_DEFAULT_SLOT_MAX_HOUR;

  for (const event of events) {
    if (event?.start) {
      const start = new Date(event.start);
      if (!Number.isNaN(start.getTime())) {
        minHour = Math.min(minHour, start.getHours());
      }
    }
    if (event?.end) {
      const end = new Date(event.end);
      if (!Number.isNaN(end.getTime())) {
        const roundedUp =
          end.getMinutes() > 0 || end.getSeconds() > 0 || end.getMilliseconds() > 0
            ? end.getHours() + 1
            : end.getHours();
        maxHour = Math.max(maxHour, roundedUp);
      }
    }
  }

  return {
    slotMinTime: formatSlotTime(minHour),
    slotMaxTime: formatSlotTime(maxHour),
  };
}

/**
 * Couleurs FullCalendar dérivées des tokens CSS (pas de hex hors design system).
 * @param {string} [status]
 */
export function courseEventColors(status) {
  const token = COURSE_STATUS_TOKENS[status] ?? COURSE_STATUS_TOKENS.scheduled;
  return {
    backgroundColor: `color-mix(in srgb, var(--color-${token}) 15%, var(--color-card))`,
    borderColor: `var(--color-${token})`,
    textColor: 'var(--color-on-card)',
  };
}

/**
 * Classe BEM pour le bloc événement (bordure gauche selon le statut).
 * @param {string} [status]
 */
export function courseEventClassName(status) {
  const key = COURSE_STATUS_TOKENS[status] ? status : 'scheduled';
  return ['equime-fc-event', `equime-fc-event--${key}`];
}

/**
 * Libellé d’accessibilité : titre, horaire, statut, lieu, moniteur (pas la couleur seule).
 * @param {{ title?: string, timeText?: string, extendedProps?: { status?: string, spaceName?: string, instructorName?: string } }} event
 */
export function formatEventAriaLabel(event) {
  const status = COURSE_STATUS_LABELS[event.extendedProps?.status] ?? '';
  return [
    event.title,
    event.timeText,
    status,
    event.extendedProps?.spaceName,
    event.extendedProps?.instructorName,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Enrichit un événement API pour FullCalendar (couleurs + classe, données inchangées).
 * @param {object} event
 */
export function toCalendarEvent(event) {
  const status = event.extendedProps?.status;
  return {
    ...event,
    ...courseEventColors(status),
    classNames: courseEventClassName(status),
  };
}
