/**
 * Tests unitaires — attribution automatique des chevaux (EPIC 5).
 */
import { describe, expect, it } from 'vitest';

import {
  candidateWarning,
  durationHoursFromRange,
  levelFit,
  OVER_LEVEL_PENALTY,
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

/** @returns {object} cheval apte, charge max 10 h */
function horse(id, name, minLevel, maxLevel, weeklyLoadHours, status = 'fit') {
  return { id, name, status, minLevel, maxLevel, weeklyLoadHours, maxWeeklyLoadHours: 10 };
}

describe('règle de niveau asymétrique (ADR 009)', () => {
  const tornade = horse('h1', 'Tornade', 'galop_3', 'galop_7', 2);

  it('classe le cavalier sous, dans ou au-dessus de la plage du cheval', () => {
    expect(levelFit('galop_1', tornade)).toBe('under');
    expect(levelFit('galop_5', tornade)).toBe('ok');
    expect(levelFit('galop_2', horse('h2', 'Caramel', 'initiation', 'galop_1', 0))).toBe('over');
  });

  it('pénalise le cavalier trop avancé plus lourdement que le bonus de compatibilité', () => {
    const pony = horse('h2', 'Caramel', 'initiation', 'galop_2', 0);
    expect(scoreRiderHorse({ rider: { level: 'galop_4' }, horse: pony })).toBe(-OVER_LEVEL_PENALTY);
    expect(scoreRiderHorse({ rider: { level: 'galop_2' }, horse: pony })).toBe(5);
  });

  it('combine les avertissements de niveau et d’affinité', () => {
    expect(candidateWarning({ levelFit: 'ok', affinity: 'neutral' })).toBeNull();
    expect(candidateWarning({ levelFit: 'under', affinity: 'avoid' })).toBe(
      'Cavalier sous le niveau minimum du cheval · Affinité à éviter'
    );
  });

  it('garde les chevaux trop exigeants dans les options d’override, signalés', () => {
    const ranked = rankCandidateHorses({
      rider: { level: 'galop_1' },
      horses: [tornade],
      affinitiesByHorseId: new Map(),
      takenHorseIds: new Set(),
    });
    expect(ranked).toMatchObject([{ levelFit: 'under', levelCompatible: false }]);
  });

  // Jeu d'essai du dossier (docs/cahier-de-tests.md) : avant la règle, Tom
  // (galop 1) recevait Tornade (galop 3–7) et Emma (galop 4) le poney Caramel.
  it('jeu d’essai : aucun cavalier placé sur un cheval au-dessus de son niveau', () => {
    const rider = (id, firstName, level) => ({ id, firstName, lastName: '', level });
    const result = simulateHorseAssignments({
      course: {
        startAt: new Date('2026-10-01T10:00:00.000Z'),
        endAt: new Date('2026-10-01T11:00:00.000Z'),
      },
      enrollments: [
        { id: 'e1', rider: rider('r1', 'Emma', 'galop_4') },
        { id: 'e2', rider: rider('r2', 'Tom', 'galop_1') },
        { id: 'e3', rider: rider('r3', 'Lea', 'galop_5') },
        { id: 'e4', rider: rider('r4', 'Hugo', 'initiation') },
      ],
      horses: [
        tornade,
        horse('h2', 'Caramel', 'initiation', 'galop_2', 1),
        horse('h3', 'Eclair', 'galop_3', 'galop_7', 9),
        horse('h4', 'Brume', 'galop_1', 'galop_5', 0, 'unavailable'),
        horse('h5', 'Saphir', 'galop_1', 'galop_4', 10),
      ],
      affinities: [
        { riderId: 'r1', horseId: 'h3', affinity: 'favorite' },
        { riderId: 'r3', horseId: 'h1', affinity: 'avoid' },
      ],
    });

    expect(result.assignments.map((a) => [a.riderName.trim(), a.horse.name, a.score])).toEqual([
      ['Emma', 'Tornade', -5],
      ['Tom', 'Caramel', 0],
      ['Lea', 'Eclair', -40],
    ]);
    expect(result.conflicts).toMatchObject([{ enrollmentId: 'e4' }]);
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
