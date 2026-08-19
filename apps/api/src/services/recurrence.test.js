/**
 * Tests unitaires — expansion de récurrence hebdomadaire (US-4.1).
 */
import { describe, expect, it } from 'vitest';

import { expandWeeklyRecurrence, intervalsOverlap } from '../services/recurrence.js';

describe('expandWeeklyRecurrence', () => {
  it("génère une séance par semaine jusqu'à la date de fin", () => {
    const startAt = new Date('2026-01-06T10:00:00.000Z');
    const endAt = new Date('2026-01-06T11:00:00.000Z');
    const recurrenceEndDate = new Date('2026-01-27T10:00:00.000Z');

    const slots = expandWeeklyRecurrence({ startAt, endAt, recurrenceEndDate });

    expect(slots).toHaveLength(3);
    expect(slots[0].startAt.toISOString()).toBe('2026-01-13T10:00:00.000Z');
    expect(slots[2].startAt.toISOString()).toBe('2026-01-27T10:00:00.000Z');
    expect(slots[0].endAt.getTime() - slots[0].startAt.getTime()).toBe(60 * 60 * 1000);
  });

  it('ne génère rien si la fin de récurrence est la semaine du parent', () => {
    const startAt = new Date('2026-01-06T10:00:00.000Z');
    const endAt = new Date('2026-01-06T11:00:00.000Z');
    const recurrenceEndDate = new Date('2026-01-06T10:00:00.000Z');

    expect(expandWeeklyRecurrence({ startAt, endAt, recurrenceEndDate })).toHaveLength(0);
  });
});

describe('intervalsOverlap', () => {
  it('détecte un chevauchement partiel', () => {
    const aStart = new Date('2026-01-01T10:00:00Z');
    const aEnd = new Date('2026-01-01T11:00:00Z');
    const bStart = new Date('2026-01-01T10:30:00Z');
    const bEnd = new Date('2026-01-01T12:00:00Z');
    expect(intervalsOverlap(aStart, aEnd, bStart, bEnd)).toBe(true);
  });

  it('ignore les créneaux adjacents', () => {
    const aStart = new Date('2026-01-01T10:00:00Z');
    const aEnd = new Date('2026-01-01T11:00:00Z');
    const bStart = new Date('2026-01-01T11:00:00Z');
    const bEnd = new Date('2026-01-01T12:00:00Z');
    expect(intervalsOverlap(aStart, aEnd, bStart, bEnd)).toBe(false);
  });
});
