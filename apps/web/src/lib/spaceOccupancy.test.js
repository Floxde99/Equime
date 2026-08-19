import { describe, expect, it } from 'vitest';

import { buildSpaceOccupancy, isRidingSpaceType } from './spaceOccupancy.js';

describe('buildSpaceOccupancy', () => {
  const spaces = [
    { id: 's1', name: 'Écurie A', type: 'stall', capacity: 10 },
    { id: 's2', name: 'Écurie B', type: 'stall', capacity: 6 },
    { id: 'p1', name: 'Paddock des poneys', type: 'paddock', capacity: 8 },
    { id: 'i1', name: 'Manège principal', type: 'indoor', capacity: 12 },
    { id: 'o1', name: 'Carrière de dressage', type: 'outdoor', capacity: 16 },
  ];

  it('calibre les boxes sur la somme des capacités stall, pas une grille fictive', () => {
    const occupancy = buildSpaceOccupancy(spaces, 15);

    expect(occupancy.boxes.capacity).toBe(16);
    expect(occupancy.boxes.occupied).toBe(15);
    expect(occupancy.boxes.horseCount).toBe(15);
    expect(occupancy.boxes.percent).toBe(94);
    expect(occupancy.boxes.spaces).toHaveLength(2);
  });

  it('liste paddocks et carrières/manèges avec leur capacité, sans cases numérotées', () => {
    const occupancy = buildSpaceOccupancy(spaces, 15);

    expect(occupancy.paddocks).toEqual([
      { id: 'p1', name: 'Paddock des poneys', type: 'paddock', capacity: 8 },
    ]);
    expect(occupancy.arenas.map((s) => s.name)).toEqual([
      'Manège principal',
      'Carrière de dressage',
    ]);
  });

  it('reste à 0 box occupé s’il n’y a aucune stalle, même avec des chevaux', () => {
    const occupancy = buildSpaceOccupancy(
      [{ id: 'p1', name: 'Paddock', type: 'paddock', capacity: 8 }],
      12
    );

    expect(occupancy.boxes.capacity).toBe(0);
    expect(occupancy.boxes.occupied).toBe(0);
    expect(occupancy.boxes.horseCount).toBe(12);
    expect(occupancy.boxes.percent).toBe(0);
  });

  it('plafonne les cases occupées à la capacité si la cavalerie déborde', () => {
    const occupancy = buildSpaceOccupancy(
      [{ id: 's1', name: 'Écurie', type: 'stall', capacity: 4 }],
      10
    );

    expect(occupancy.boxes.occupied).toBe(4);
    expect(occupancy.boxes.percent).toBe(250);
  });
});

describe('isRidingSpaceType', () => {
  it('exclut les boxes du planning de cours', () => {
    expect(isRidingSpaceType('indoor')).toBe(true);
    expect(isRidingSpaceType('outdoor')).toBe(true);
    expect(isRidingSpaceType('paddock')).toBe(true);
    expect(isRidingSpaceType('stall')).toBe(false);
  });
});
