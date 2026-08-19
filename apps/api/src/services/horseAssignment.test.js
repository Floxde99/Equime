/**
 * Tests unitaires — attribution automatique des chevaux (EPIC 5).
 */
import { describe, expect, it } from 'vitest';

import {
  durationHoursFromRange,
  rankCandidateHorses,
  scoreRiderHorse,
  simulateHorseAssignments,
} from './horseAssignment.js';

const course = {
  id: 'course_1',
  title: 'Galop 2',
  startAt: new Date('2026-09-01T14:00:00.000Z'),
  endAt: new Date('2026-09-01T15:00:00.000Z'),
};

const rider = { id: 'rider_1', firstName: 'Emma', lastName: 'Martin', level: 'galop_2' };

describe('scoreRiderHorse', () => {
  it('cumule favori, compatibilité de niveau et pénalité de charge', () => {
    const score = scoreRiderHorse({
      rider,
      horse: {
        id: 'horse_1',
        name: 'Indigo',
        status: 'fit',
        minLevel: 'galop_1',
        maxLevel: 'galop_3',
        weeklyLoadHours: 1,
        maxWeeklyLoadHours: 12,
      },
      affinity: 'favorite',
    });

    expect(score).toBe(10);
  });

  it("applique la pénalité d'affinité avoid", () => {
    const score = scoreRiderHorse({
      rider,
      horse: {
        id: 'horse_1',
        name: 'Quartz',
        status: 'fit',
        minLevel: 'initiation',
        maxLevel: 'galop_7',
        weeklyLoadHours: 0,
        maxWeeklyLoadHours: 12,
      },
      affinity: 'avoid',
    });

    expect(score).toBe(-10);
  });
});

describe('rankCandidateHorses', () => {
  it('écarte les chevaux non éligibles car surchargés', () => {
    const ranked = rankCandidateHorses({
      rider,
      horses: [
        {
          id: 'horse_over',
          name: 'Atlas',
          status: 'fit',
          minLevel: 'initiation',
          maxLevel: 'galop_7',
          weeklyLoadHours: 12,
          maxWeeklyLoadHours: 12,
        },
      ],
      affinitiesByHorseId: new Map(),
      takenHorseIds: new Set(),
    });

    expect(ranked).toHaveLength(0);
  });

  it('départage une égalité de score de façon déterministe', () => {
    const ranked = rankCandidateHorses({
      rider,
      horses: [
        {
          id: 'horse_b',
          name: 'Bella',
          status: 'fit',
          minLevel: 'initiation',
          maxLevel: 'galop_7',
          weeklyLoadHours: 0,
          maxWeeklyLoadHours: 12,
        },
        {
          id: 'horse_a',
          name: 'Astre',
          status: 'fit',
          minLevel: 'initiation',
          maxLevel: 'galop_7',
          weeklyLoadHours: 0,
          maxWeeklyLoadHours: 12,
        },
      ],
      affinitiesByHorseId: new Map(),
      takenHorseIds: new Set(),
    });

    expect(ranked.map((entry) => entry.horse.name)).toEqual(['Astre', 'Bella']);
  });
});

describe('simulateHorseAssignments', () => {
  it('attribue le meilleur cheval disponible sans doublon dans la séance', () => {
    const result = simulateHorseAssignments({
      course,
      enrollments: [
        { id: 'enr_1', rider: { ...rider } },
        {
          id: 'enr_2',
          rider: { id: 'rider_2', firstName: 'Lina', lastName: 'Petit', level: 'galop_2' },
        },
      ],
      horses: [
        {
          id: 'horse_favorite',
          name: 'Indigo',
          status: 'fit',
          minLevel: 'initiation',
          maxLevel: 'galop_7',
          weeklyLoadHours: 1,
          maxWeeklyLoadHours: 12,
        },
        {
          id: 'horse_backup',
          name: 'Jazz',
          status: 'fit',
          minLevel: 'initiation',
          maxLevel: 'galop_7',
          weeklyLoadHours: 0,
          maxWeeklyLoadHours: 12,
        },
      ],
      affinities: [
        { riderId: 'rider_1', horseId: 'horse_favorite', affinity: 'favorite' },
        { riderId: 'rider_2', horseId: 'horse_favorite', affinity: 'favorite' },
      ],
    });

    expect(result.assignments).toHaveLength(2);
    expect(result.assignments[0].horse.name).toBe('Indigo');
    expect(result.assignments[1].horse.name).toBe('Jazz');
    expect(result.conflicts).toHaveLength(0);
  });

  it('retourne un conflit quand aucun cheval éligible ne reste', () => {
    const result = simulateHorseAssignments({
      course,
      enrollments: [{ id: 'enr_1', rider: { ...rider } }],
      horses: [
        {
          id: 'horse_1',
          name: 'Repos',
          status: 'rest',
          minLevel: 'initiation',
          maxLevel: 'galop_7',
          weeklyLoadHours: 0,
          maxWeeklyLoadHours: 12,
        },
      ],
      affinities: [],
    });

    expect(result.assignments).toHaveLength(0);
    expect(result.conflicts).toEqual([
      expect.objectContaining({
        enrollmentId: 'enr_1',
        reason: 'Aucun cheval eligible disponible',
      }),
    ]);
  });
});

describe('durationHoursFromRange', () => {
  it('calcule la durée d’un stage comme un cours', () => {
    expect(
      durationHoursFromRange(
        new Date('2026-10-10T09:00:00.000Z'),
        new Date('2026-10-10T17:00:00.000Z')
      )
    ).toBe(8);
  });
});
