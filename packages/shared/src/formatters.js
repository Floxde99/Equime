/**
 * Formatage et saisie — montants en euros et dates dans le fuseau du club.
 *
 * Source unique pour le front (écrans) et le back (e-mails, PDF). Les montants
 * circulent toujours en centimes entiers ; seuls l'affichage et la saisie
 * utilisent les euros. Les dates sont toujours rendues en heure de Paris, quel
 * que soit le fuseau du serveur (UTC en Docker) ou du navigateur.
 */

/** Fuseau du centre équestre (mono-club ; passera en configuration club en v1.3). */
export const CLUB_TIME_ZONE = 'Europe/Paris';

const LOCALE = 'fr-FR';

const euroFormatter = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'EUR' });

/**
 * « 49,90 € » à partir de centimes.
 * @param {number | null | undefined} cents
 */
export function formatEuroCents(cents) {
  return euroFormatter.format((Number(cents) || 0) / 100);
}

/**
 * Convertit une saisie en euros (« 49 », « 49,9 », « 49.90 », « 1 234,50 € »)
 * en centimes entiers. Renvoie `null` si la saisie est vide ou invalide
 * (négatif, plus de deux décimales, caractères parasites).
 * @param {string | number | null | undefined} input
 * @returns {number | null}
 */
export function parseEurosToCents(input) {
  if (input == null) return null;
  if (typeof input === 'number') {
    return Number.isFinite(input) && input >= 0 ? Math.round(input * 100) : null;
  }
  const cleaned = String(input)
    .replace(/[\s  ]/g, '')
    .replace(/€$/, '')
    .replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [units, decimals = ''] = cleaned.split('.');
  return Number(units) * 100 + Number(decimals.padEnd(2, '0'));
}

/**
 * Valeur d'un champ de saisie en euros : « 49 » ou « 49,90 » (sans symbole).
 * @param {number | null | undefined} cents
 */
export function formatCentsForInput(cents) {
  if (cents == null || cents === '') return '';
  const value = Number(cents);
  if (!Number.isFinite(value)) return '';
  const units = Math.trunc(value / 100);
  const rest = Math.abs(value % 100);
  return rest === 0 ? String(units) : `${units},${String(rest).padStart(2, '0')}`;
}

/** @type {Map<string, Intl.DateTimeFormat>} */
const dateFormatters = new Map();

/**
 * @param {Intl.DateTimeFormatOptions} options
 */
function dateFormatter(options) {
  const key = JSON.stringify(options);
  let formatter = dateFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(LOCALE, { timeZone: CLUB_TIME_ZONE, ...options });
    dateFormatters.set(key, formatter);
  }
  return formatter;
}

/** @param {Date | string | number | null | undefined} value */
function toDate(value) {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * « 24/09/2026 ».
 * @param {Date | string | number | null | undefined} value
 */
export function formatDate(value) {
  const date = toDate(value);
  return date
    ? dateFormatter({ day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
    : '';
}

/**
 * « jeudi 24 septembre 2026 ».
 * @param {Date | string | number | null | undefined} value
 */
export function formatDateLong(value) {
  const date = toDate(value);
  return date
    ? dateFormatter({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(
        date
      )
    : '';
}

/**
 * « jeu. 24 sept. » — libellé court pour les listes.
 * @param {Date | string | number | null | undefined} value
 */
export function formatDayShort(value) {
  const date = toDate(value);
  return date
    ? dateFormatter({ weekday: 'short', day: 'numeric', month: 'short' }).format(date)
    : '';
}

/**
 * « 14:00 ».
 * @param {Date | string | number | null | undefined} value
 */
export function formatTime(value) {
  const date = toDate(value);
  return date ? dateFormatter({ hour: '2-digit', minute: '2-digit' }).format(date) : '';
}

/**
 * « 24/09/2026 à 14:00 ».
 * @param {Date | string | number | null | undefined} value
 */
export function formatDateTime(value) {
  const date = toDate(value);
  return date ? `${formatDate(date)} à ${formatTime(date)}` : '';
}

/**
 * « jeu. 24 sept. · 14:00 – 15:30 » (ou deux dates si le créneau change de jour).
 * @param {Date | string | number} start
 * @param {Date | string | number} end
 */
export function formatSlot(start, end) {
  const from = toDate(start);
  const to = toDate(end);
  if (!from) return '';
  if (!to) return `${formatDayShort(from)} · ${formatTime(from)}`;
  if (formatDate(from) === formatDate(to)) {
    return `${formatDayShort(from)} · ${formatTime(from)} – ${formatTime(to)}`;
  }
  return `${formatDayShort(from)} ${formatTime(from)} → ${formatDayShort(to)} ${formatTime(to)}`;
}

/**
 * Durée lisible : 1.333 → « 1 h 20 », 2 → « 2 h », 0.75 → « 45 min ».
 * @param {number | null | undefined} hours
 */
export function formatHours(hours) {
  const totalMinutes = Math.round((Number(hours) || 0) * 60);
  const h = Math.trunc(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${String(m).padStart(2, '0')}`;
}

/**
 * Normalise un texte pour une recherche insensible à la casse et aux accents.
 * @param {string | null | undefined} text
 */
export function normalizeSearch(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}
