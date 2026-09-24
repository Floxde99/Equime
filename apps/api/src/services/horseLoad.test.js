/**
 * Tests unitaires — charge hebdomadaire dérivée des chevaux (ADR 010).
 */
import { describe, expect, it } from 'vitest';

import { overlapHours, sumLoadByHorse } from './horseLoad.js';

// Semaine du lundi 21 septembre 2026 (Paris, UTC+2)
const week = {
  start: new Date('2026-09-20T22:00:00.000Z'),
  end: new Date('2026-09-27T22:00:00.000Z'),
};

const slot = (horseId, startAt, endAt) => ({
  horseId,
  startAt: new Date(startAt),
  endAt: new Date(endAt),
});

describe('overlapHours', () => {
  it('compte entièrement un cours dans la semaine', () => {
    expect(overlapHours(slot('h', '2026-09-23T14:00:00Z', '2026-09-23T15:30:00Z'), week)).toBe(1.5);
  });

  it('ne compte que la part d’un stage comprise dans la semaine', () => {
    // Stage du dimanche 27 (8 h UTC) au lundi 28 (18 h UTC) : 14 h côté semaine courante
    expect(overlapHours(slot('h', '2026-09-27T08:00:00Z', '2026-09-28T18:00:00Z'), week)).toBe(14);
  });

  it('ignore un créneau hors de la semaine', () => {
    expect(overlapHours(slot('h', '2026-09-28T08:00:00Z', '2026-09-28T09:00:00Z'), week)).toBe(0);
  });
});

describe('sumLoadByHorse', () => {
  it('additionne les créneaux par cheval et ignore les autres semaines', () => {
    const loads = sumLoadByHorse(
      [
        slot('indigo', '2026-09-21T08:00:00Z', '2026-09-21T09:00:00Z'),
        slot('indigo', '2026-09-24T16:00:00Z', '2026-09-24T17:30:00Z'),
        slot('jazz', '2026-09-22T10:00:00Z', '2026-09-22T11:00:00Z'),
        // Semaine précédente : ne doit plus peser (c'était le défaut de l'ancien compteur)
        slot('jazz', '2026-09-15T10:00:00Z', '2026-09-15T20:00:00Z'),
      ],
      week
    );
    expect(Object.fromEntries(loads)).toEqual({ indigo: 2.5, jazz: 1 });
  });

  it('arrondit au centième les sommes flottantes', () => {
    const tenMinutes = (i) =>
      slot(
        'h',
        new Date(Date.UTC(2026, 8, 22, 8, i * 10)).toISOString(),
        new Date(Date.UTC(2026, 8, 22, 8, i * 10 + 10)).toISOString()
      );
    const loads = sumLoadByHorse([0, 1, 2, 3, 4, 5].map(tenMinutes), week);
    expect(loads.get('h')).toBe(1);
  });

  it('renvoie une carte vide sans affectation', () => {
    expect(sumLoadByHorse([], week).size).toBe(0);
  });
});
