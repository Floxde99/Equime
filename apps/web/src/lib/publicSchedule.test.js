import { describe, expect, it } from 'vitest';

import {
  formatCourseHours,
  formatSessionsPerWeek,
  isRedundantPlanDescription,
} from './publicSchedule.js';

describe('formatCourseHours', () => {
  it('affiche le jour et la plage horaire en français', () => {
    const label = formatCourseHours({
      startAt: '2026-09-01T08:00:00.000Z',
      endAt: '2026-09-01T09:00:00.000Z',
    });
    expect(label).toMatch(/·/);
    expect(label).toMatch(/–/);
  });
});

describe('formatSessionsPerWeek', () => {
  it('accorde séance au singulier et au pluriel', () => {
    expect(formatSessionsPerWeek(1)).toBe('1 séance par semaine');
    expect(formatSessionsPerWeek(2)).toBe('2 séances par semaine');
    expect(formatSessionsPerWeek(3)).toBe('3 séances par semaine');
  });
});

describe('isRedundantPlanDescription', () => {
  it('masque une description qui recopie la fréquence', () => {
    expect(isRedundantPlanDescription('1 séance par semaine', 1)).toBe(true);
    expect(isRedundantPlanDescription('1 séance(s) par semaine', 1)).toBe(true);
    expect(isRedundantPlanDescription('2 séances par semaine', 2)).toBe(true);
  });

  it('conserve une description métier distincte', () => {
    expect(isRedundantPlanDescription('Cours d’initiation, matériel fourni', 1)).toBe(false);
  });

  it('traite une description vide comme redondante', () => {
    expect(isRedundantPlanDescription('', 1)).toBe(true);
    expect(isRedundantPlanDescription(null, 1)).toBe(true);
  });
});
