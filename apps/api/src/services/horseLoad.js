// @ts-check
/**
 * Charge hebdomadaire des chevaux — valeur dérivée, jamais stockée (ADR 010).
 *
 * La charge d'un cheval sur une semaine ISO (fuseau du club) est la somme des
 * heures de ses affectations actives qui tombent dans cette semaine :
 * - séances de cours non annulées, hors cavalier excusé (le cheval ne travaille pas) ;
 * - stages non annulés, pour la seule part du stage comprise dans la semaine.
 *
 * Remplace l'ancien compteur `Horse.weeklyLoadHours`, qui n'était jamais remis à
 * zéro et dérivait à chaque annulation non décomptée.
 */
import { prisma } from '../lib/prisma.js';
import { isoWeekRange } from '../lib/weeks.js';

const HOUR_MS = 60 * 60 * 1000;

/**
 * Heures d'un créneau comprises dans un intervalle [start, end[.
 * @param {{ startAt: Date, endAt: Date }} slot
 * @param {{ start: Date, end: Date }} range
 */
export function overlapHours(slot, range) {
  const from = Math.max(slot.startAt.getTime(), range.start.getTime());
  const to = Math.min(slot.endAt.getTime(), range.end.getTime());
  return Math.max(0, (to - from) / HOUR_MS);
}

/**
 * Agrège la charge par cheval (logique pure).
 * @param {Array<{ horseId: string, startAt: Date, endAt: Date }>} slots
 * @param {{ start: Date, end: Date }} range
 * @returns {Map<string, number>}
 */
export function sumLoadByHorse(slots, range) {
  /** @type {Map<string, number>} */
  const loads = new Map();
  for (const slot of slots) {
    const hours = overlapHours(slot, range);
    if (hours > 0) loads.set(slot.horseId, (loads.get(slot.horseId) ?? 0) + hours);
  }
  // Arrondi au centième : évite les 2.9999999 issus des additions flottantes.
  for (const [horseId, hours] of loads) loads.set(horseId, Math.round(hours * 100) / 100);
  return loads;
}

/**
 * Charge de chaque cheval sur la semaine ISO contenant `referenceDate`.
 * @param {{ referenceDate?: Date, horseIds?: string[], db?: any }} [options]
 *   `db` accepte le client Prisma ou un client transactionnel.
 * @returns {Promise<Map<string, number>>}
 */
export async function getWeeklyLoads({ referenceDate = new Date(), horseIds, db = prisma } = {}) {
  const range = isoWeekRange(referenceDate);
  const horseFilter = horseIds ? { in: horseIds } : { not: null };
  const overlapsWeek = { startAt: { lt: range.end }, endAt: { gt: range.start } };

  const [enrollments, registrations] = await Promise.all([
    db.courseEnrollment.findMany({
      where: {
        horseId: horseFilter,
        attendance: { not: 'excused' },
        course: { ...overlapsWeek, status: { not: 'cancelled' } },
      },
      select: { horseId: true, course: { select: { startAt: true, endAt: true } } },
    }),
    db.eventRegistration.findMany({
      where: {
        horseId: horseFilter,
        status: { not: 'cancelled' },
        event: overlapsWeek,
      },
      select: { horseId: true, event: { select: { startAt: true, endAt: true } } },
    }),
  ]);

  return sumLoadByHorse(
    [
      ...enrollments.map((e) => ({ horseId: e.horseId, ...e.course })),
      ...registrations.map((r) => ({ horseId: r.horseId, ...r.event })),
    ],
    range
  );
}

/**
 * Complète des chevaux avec `weeklyLoadHours` (contrat d'API inchangé pour le front).
 * @template {{ id: string }} T
 * @param {T[]} horses
 * @param {{ referenceDate?: Date, db?: any }} [options]
 * @returns {Promise<Array<T & { weeklyLoadHours: number }>>}
 */
export async function withWeeklyLoad(horses, { referenceDate, db } = {}) {
  if (horses.length === 0) return [];
  const loads = await getWeeklyLoads({
    referenceDate,
    horseIds: horses.map((horse) => horse.id),
    db,
  });
  return horses.map((horse) => ({ ...horse, weeklyLoadHours: loads.get(horse.id) ?? 0 }));
}
