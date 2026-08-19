/**
 * Horaires publics d'une séance vitrine (Excel 1.2).
 * @param {{ startAt: string | Date, endAt: string | Date }} course
 */
export function formatCourseHours(course) {
  const start = new Date(course.startAt);
  const end = new Date(course.endAt);
  const day = start.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const time = (date) =>
    date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${time(start)} – ${time(end)}`;
}

/**
 * Fréquence d'une formule — pluriel français (1 séance / 2 séances).
 * @param {number} sessionsPerWeek
 */
export function formatSessionsPerWeek(sessionsPerWeek) {
  const count = Math.trunc(Number(sessionsPerWeek) || 0);
  const noun = count > 1 ? 'séances' : 'séance';
  return `${count} ${noun} par semaine`;
}

/**
 * Normalise un libellé de fréquence pour détecter les doublons vitrine.
 * @param {string} text
 */
function normalizeSessionsCopy(text) {
  return String(text ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/séance\(s\)/g, 'séance')
    .replace(/séances/g, 'séance')
    .replace(/\.$/, '');
}

/**
 * True si `description` ne fait que répéter la fréquence déjà affichée.
 * @param {string | null | undefined} description
 * @param {number} sessionsPerWeek
 */
export function isRedundantPlanDescription(description, sessionsPerWeek) {
  const trimmed = String(description ?? '').trim();
  if (!trimmed) return true;
  return normalizeSessionsCopy(trimmed) === normalizeSessionsCopy(formatSessionsPerWeek(sessionsPerWeek));
}
