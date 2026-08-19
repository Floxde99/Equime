import { describe, expect, it } from 'vitest';

import { filterHealthLogs, filterHorsesByQuery } from './horseDirectory.js';

const horses = [{ name: 'Vénus' }, { name: 'Baron' }, { name: 'Éclair' }];

describe('filterHorsesByQuery', () => {
  it('retourne toute la liste si la recherche est vide', () => {
    expect(filterHorsesByQuery(horses, '')).toEqual(horses);
    expect(filterHorsesByQuery(horses, '   ')).toEqual(horses);
  });

  it('filtre par nom sans tenir compte des accents ni de la casse', () => {
    expect(filterHorsesByQuery(horses, 'venus').map((horse) => horse.name)).toEqual(['Vénus']);
    expect(filterHorsesByQuery(horses, 'ÉCL').map((horse) => horse.name)).toEqual(['Éclair']);
  });

  it('retourne une liste vide si aucun cheval ne correspond', () => {
    expect(filterHorsesByQuery(horses, 'poney')).toEqual([]);
  });
});

describe('filterHealthLogs', () => {
  const logs = [
    { id: '1', type: 'veterinarian' },
    { id: '2', type: 'farrier' },
    { id: '3', type: 'veterinarian' },
  ];

  it('conserve toutes les entrées pour « all »', () => {
    expect(filterHealthLogs(logs, 'all')).toHaveLength(3);
  });

  it('filtre par type', () => {
    expect(filterHealthLogs(logs, 'veterinarian').map((log) => log.id)).toEqual(['1', '3']);
  });
});
