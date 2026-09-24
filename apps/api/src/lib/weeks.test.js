/**
 * Tests unitaires — bornes de semaine ISO dans le fuseau du club.
 */
import { describe, expect, it } from 'vitest';

import { isoWeekRange } from './weeks.js';

const iso = (range) => ({ start: range.start.toISOString(), end: range.end.toISOString() });

describe('isoWeekRange', () => {
  it('borne la semaine du lundi minuit au lundi suivant minuit, heure de Paris', () => {
    // Mercredi 23 septembre 2026, 15 h UTC — heure d'été (UTC+2)
    expect(iso(isoWeekRange(new Date('2026-09-23T15:00:00.000Z')))).toEqual({
      start: '2026-09-20T22:00:00.000Z',
      end: '2026-09-27T22:00:00.000Z',
    });
  });

  it('rattache le dimanche 23 h 30 (Paris) à la semaine qui se termine', () => {
    // Dimanche 27 septembre 2026, 23 h 30 à Paris = 21 h 30 UTC
    const range = isoWeekRange(new Date('2026-09-27T21:30:00.000Z'));
    expect(range.start.toISOString()).toBe('2026-09-20T22:00:00.000Z');
  });

  it('bascule sur la nouvelle semaine le lundi 0 h 30 (Paris), encore dimanche en UTC', () => {
    // Lundi 28 septembre 2026, 0 h 30 à Paris = dimanche 22 h 30 UTC
    const range = isoWeekRange(new Date('2026-09-27T22:30:00.000Z'));
    expect(range.start.toISOString()).toBe('2026-09-27T22:00:00.000Z');
  });

  it('gère la semaine du passage à l’heure d’hiver (169 h)', () => {
    // Passage à l'heure d'hiver le dimanche 25 octobre 2026
    const range = isoWeekRange(new Date('2026-10-22T10:00:00.000Z'));
    expect(iso(range)).toEqual({
      start: '2026-10-18T22:00:00.000Z',
      end: '2026-10-25T23:00:00.000Z',
    });
    expect((range.end.getTime() - range.start.getTime()) / 3_600_000).toBe(169);
  });

  it('gère la semaine du passage à l’heure d’été (167 h)', () => {
    // Passage à l'heure d'été le dimanche 28 mars 2027
    const range = isoWeekRange(new Date('2027-03-24T10:00:00.000Z'));
    expect(iso(range)).toEqual({
      start: '2027-03-21T23:00:00.000Z',
      end: '2027-03-28T22:00:00.000Z',
    });
    expect((range.end.getTime() - range.start.getTime()) / 3_600_000).toBe(167);
  });

  it('traverse un changement d’année (semaine ISO à cheval sur deux années)', () => {
    // Jeudi 31 décembre 2026 → semaine du lundi 28 décembre au lundi 4 janvier
    expect(iso(isoWeekRange(new Date('2026-12-31T12:00:00.000Z')))).toEqual({
      start: '2026-12-27T23:00:00.000Z',
      end: '2027-01-03T23:00:00.000Z',
    });
  });

  it('accepte un autre fuseau', () => {
    expect(iso(isoWeekRange(new Date('2026-09-23T15:00:00.000Z'), 'UTC'))).toEqual({
      start: '2026-09-21T00:00:00.000Z',
      end: '2026-09-28T00:00:00.000Z',
    });
  });
});
