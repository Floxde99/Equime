// @ts-check
/**
 * Semaine ISO (lundi 00:00 → lundi suivant 00:00) dans le fuseau du club.
 * Le serveur tourne en UTC (Docker) : sans ce calcul, la semaine basculerait
 * le dimanche à 22 h ou 23 h heure de Paris. Logique pure, testée unitairement.
 */

import { CLUB_TIME_ZONE } from '@equime/shared';

export { CLUB_TIME_ZONE };

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_INDEX = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

/** @type {Map<string, Intl.DateTimeFormat>} */
const formatters = new Map();

/** @param {string} timeZone */
function formatterFor(timeZone) {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      weekday: 'short',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/**
 * Composantes de date/heure murale d'un instant dans un fuseau.
 * @param {Date} date
 * @param {string} timeZone
 */
export function zonedParts(date, timeZone) {
  /** @type {Record<string, string>} */
  const parts = {};
  for (const { type, value } of formatterFor(timeZone).formatToParts(date)) parts[type] = value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAY_INDEX[/** @type {keyof typeof WEEKDAY_INDEX} */ (parts.weekday)],
  };
}

/**
 * Décalage (ms) du fuseau par rapport à UTC à un instant donné (+1 h / +2 h pour Paris).
 * @param {number} instant
 * @param {string} timeZone
 */
function offsetAt(instant, timeZone) {
  const p = zonedParts(new Date(instant), timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/**
 * Instant UTC correspondant à minuit (heure murale) d'une date calendaire du fuseau.
 * @param {number} year
 * @param {number} month 1-12
 * @param {number} day
 * @param {string} timeZone
 */
export function zonedMidnight(year, month, day, timeZone) {
  const wallClock = Date.UTC(year, month - 1, day);
  const guess = wallClock - offsetAt(wallClock, timeZone);
  // Second passage : corrige le cas où le changement d'heure tombe entre les deux instants.
  return new Date(wallClock - offsetAt(guess, timeZone));
}

/**
 * Bornes de la semaine ISO contenant `date`, intervalle semi-ouvert [start, end[.
 * Une semaine de changement d'heure dure 167 h ou 169 h : `end` est toujours
 * le lundi suivant à minuit, pas `start` + 7 × 24 h.
 * @param {Date} date
 * @param {string} [timeZone]
 * @returns {{ start: Date, end: Date }}
 */
export function isoWeekRange(date, timeZone = CLUB_TIME_ZONE) {
  const p = zonedParts(date, timeZone);
  const monday = new Date(Date.UTC(p.year, p.month - 1, p.day) - p.weekday * DAY_MS);
  const nextMonday = new Date(monday.getTime() + 7 * DAY_MS);
  return {
    start: zonedMidnight(
      monday.getUTCFullYear(),
      monday.getUTCMonth() + 1,
      monday.getUTCDate(),
      timeZone
    ),
    end: zonedMidnight(
      nextMonday.getUTCFullYear(),
      nextMonday.getUTCMonth() + 1,
      nextMonday.getUTCDate(),
      timeZone
    ),
  };
}
