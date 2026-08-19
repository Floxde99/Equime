// @ts-check
/**
 * Expansion hebdomadaire des séries de cours — logique pure, testée unitairement.
 * Chaque créneau généré est indépendant ; le parent porte la règle de récurrence.
 */

/**
 * @param {{ startAt: Date, endAt: Date, recurrenceEndDate: Date }} input
 * @returns {Array<{ startAt: Date, endAt: Date }>}
 */
export function expandWeeklyRecurrence({ startAt, endAt, recurrenceEndDate }) {
  const durationMs = endAt.getTime() - startAt.getTime();
  const slots = [];

  /** @type {Date} */
  let cursor = new Date(startAt);
  cursor.setUTCDate(cursor.getUTCDate() + 7);

  while (cursor <= recurrenceEndDate) {
    slots.push({
      startAt: new Date(cursor),
      endAt: new Date(cursor.getTime() + durationMs),
    });
    cursor = new Date(cursor);
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }

  return slots;
}

/**
 * Vérifie le chevauchement de deux intervalles [start, end[.
 * @param {Date} aStart
 * @param {Date} aEnd
 * @param {Date} bStart
 * @param {Date} bEnd
 */
export function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}
