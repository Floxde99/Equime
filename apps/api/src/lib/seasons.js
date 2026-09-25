// @ts-check
/**
 * Saison sportive, prorata et échéanciers des forfaits (ADR 011).
 * Toutes les bornes sont des minuits heure de Paris. Logique pure, testée unitairement.
 */
import { CLUB_TIME_ZONE, zonedMidnight, zonedParts } from './weeks.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/**
 * @typedef {{ seasonStart: string, seasonEnd: string, installmentDay: number,
 *   quarterDueDates: string[] }} SeasonSettings
 * @typedef {{ start: Date, end: Date, startYear: number }} Season
 */

/**
 * @param {string} value « MM-JJ »
 * @returns {{ month: number, day: number }}
 */
export function parseMonthDay(value) {
  const [month, day] = value.split('-').map(Number);
  return { month, day };
}

/**
 * @param {{ month: number, day: number }} a
 * @param {{ month: number, day: number }} b
 */
function isBefore(a, b) {
  return a.month < b.month || (a.month === b.month && a.day < b.day);
}

/**
 * @param {number} startYear
 * @param {SeasonSettings} settings
 * @param {string} timeZone
 * @returns {Season}
 */
function seasonStartingIn(startYear, settings, timeZone) {
  const start = parseMonthDay(settings.seasonStart);
  const end = parseMonthDay(settings.seasonEnd);
  const endYear = isBefore(end, start) ? startYear + 1 : startYear;
  return {
    start: zonedMidnight(startYear, start.month, start.day, timeZone),
    // Lendemain du dernier jour à minuit : borne exclue (Date.UTC gère le 31 juin → 1er juillet).
    end: zonedMidnight(endYear, end.month, end.day + 1, timeZone),
    startYear,
  };
}

/**
 * Saison en cours à `date`. Entre deux saisons (juillet, août), la saison qui
 * commence : c'est celle pour laquelle on s'inscrit.
 * @param {Date} date
 * @param {SeasonSettings} settings
 * @param {string} [timeZone]
 * @returns {Season}
 */
export function seasonAt(date, settings, timeZone = CLUB_TIME_ZONE) {
  const today = zonedParts(date, timeZone);
  const start = parseMonthDay(settings.seasonStart);
  const startYear = isBefore(today, start) ? today.year - 1 : today.year;
  const season = seasonStartingIn(startYear, settings, timeZone);
  return date >= season.end ? seasonStartingIn(startYear + 1, settings, timeZone) : season;
}

/**
 * Libellé « 2026-2027 » (ou « 2026 » si la saison tient dans l'année civile).
 * @param {Season} season
 * @param {string} [timeZone]
 */
export function seasonLabel(season, timeZone = CLUB_TIME_ZONE) {
  const lastDay = zonedParts(new Date(season.end.getTime() - 1), timeZone);
  return lastDay.year === season.startYear
    ? String(season.startYear)
    : `${season.startYear}-${lastDay.year}`;
}

/**
 * Prix au prorata des semaines restantes quand le cavalier arrive en cours de saison.
 * @param {number} priceCents prix de la saison complète
 * @param {Season} season
 * @param {Date} startsAt
 */
export function proRataCents(priceCents, season, startsAt) {
  if (startsAt <= season.start) return priceCents;
  const totalWeeks = Math.ceil((season.end.getTime() - season.start.getTime()) / WEEK_MS);
  const remainingWeeks = Math.max(
    0,
    Math.ceil((season.end.getTime() - startsAt.getTime()) / WEEK_MS)
  );
  return Math.round((priceCents * Math.min(remainingWeeks, totalWeeks)) / totalWeeks);
}

/**
 * Dates d'échéance d'un échéancier sur une saison, dans l'ordre chronologique.
 * - `quarterly` : les trois dates trimestrielles du club ;
 * - `ten_installments` : le jour d'échéance des dix premiers mois de la saison.
 * @param {'quarterly' | 'ten_installments'} schedule
 * @param {Season} season
 * @param {SeasonSettings} settings
 * @param {string} [timeZone]
 * @returns {Date[]}
 */
export function scheduleDueDates(schedule, season, settings, timeZone = CLUB_TIME_ZONE) {
  const start = parseMonthDay(settings.seasonStart);
  if (schedule === 'quarterly') {
    return settings.quarterDueDates
      .map(parseMonthDay)
      .map(({ month, day }) => {
        const year = isBefore({ month, day }, start) ? season.startYear + 1 : season.startYear;
        return zonedMidnight(year, month, day, timeZone);
      })
      .sort((a, b) => a.getTime() - b.getTime());
  }
  return Array.from({ length: 10 }, (_, index) => {
    const monthIndex = start.month - 1 + index;
    return zonedMidnight(
      season.startYear + Math.floor(monthIndex / 12),
      (monthIndex % 12) + 1,
      settings.installmentDay,
      timeZone
    );
  });
}

/**
 * Répartit un montant sur n échéances, au centime ; le reste de la division va
 * sur la première.
 * @param {number} totalCents
 * @param {number} count
 * @returns {number[]}
 */
export function splitAmount(totalCents, count) {
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, index) => (index === 0 ? base + remainder : base));
}

/**
 * Échéancier d'une facture. Les échéances déjà passées à la souscription sont
 * regroupées en une échéance immédiate (arrivée en cours de saison).
 * @param {{ totalCents: number, dueDates: Date[], now: Date }} input
 * @returns {Array<{ sequence: number, dueAt: Date, amountCents: number }>}
 */
export function buildInstallments({ totalCents, dueDates, now }) {
  const upcoming = dueDates.filter((date) => date > now);
  const dates = upcoming.length === dueDates.length ? upcoming : [now, ...upcoming];
  return splitAmount(totalCents, dates.length).map((amountCents, index) => ({
    sequence: index + 1,
    dueAt: dates[index],
    amountCents,
  }));
}
