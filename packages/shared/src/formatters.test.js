/**
 * Tests unitaires — formatage des montants et des dates (heure de Paris).
 */
import { describe, expect, it } from 'vitest';

import {
  formatCentsForInput,
  formatDate,
  formatDateTime,
  formatEuroCents,
  formatHours,
  formatSlot,
  formatTime,
  normalizeSearch,
  parseEurosToCents,
} from './formatters.js';

// Intl insère des espaces insécables : on les normalise pour comparer.
const plain = (text) => text.replace(/[  ]/g, ' ');

describe('parseEurosToCents', () => {
  it.each([
    ['49', 4900],
    ['49,9', 4990],
    ['49,90', 4990],
    ['49.90', 4990],
    ['0', 0],
    ['1 234,50', 123450],
    ['1 234,50 €', 123450],
    [' 12 ', 1200],
    [12.5, 1250],
  ])('%s → %s centimes', (input, expected) => {
    expect(parseEurosToCents(input)).toBe(expected);
  });

  it.each(['', '  ', 'abc', '-5', '49,999', '4,9,9', '12e3', null, undefined, -3])(
    'refuse %s',
    (input) => {
      expect(parseEurosToCents(input)).toBeNull();
    }
  );
});

describe('formatCentsForInput', () => {
  it('affiche les euros ronds sans décimales et les autres avec deux', () => {
    expect(formatCentsForInput(4900)).toBe('49');
    expect(formatCentsForInput(4990)).toBe('49,90');
    expect(formatCentsForInput(5)).toBe('0,05');
    expect(formatCentsForInput(null)).toBe('');
  });

  it('fait l’aller-retour avec parseEurosToCents', () => {
    for (const cents of [0, 5, 99, 4900, 4990, 123456]) {
      expect(parseEurosToCents(formatCentsForInput(cents))).toBe(cents);
    }
  });
});

describe('formatEuroCents', () => {
  it('formate en euros français', () => {
    expect(plain(formatEuroCents(123450))).toBe('1 234,50 €');
    expect(plain(formatEuroCents(null))).toBe('0,00 €');
  });
});

describe('dates en heure de Paris', () => {
  // 14 h à Paris (heure d'été) = 12 h UTC : le serveur Docker tourne en UTC.
  const summer = '2026-09-24T12:00:00.000Z';
  // 14 h à Paris (heure d'hiver) = 13 h UTC.
  const winter = '2026-12-03T13:00:00.000Z';

  it('rend l’heure murale de Paris, été comme hiver', () => {
    expect(formatTime(summer)).toBe('14:00');
    expect(formatTime(winter)).toBe('14:00');
  });

  it('rattache 23 h 30 UTC au lendemain à Paris', () => {
    expect(formatDate('2026-09-24T23:30:00.000Z')).toBe('25/09/2026');
  });

  it('formate date et heure', () => {
    expect(formatDateTime(summer)).toBe('24/09/2026 à 14:00');
    expect(formatDateTime(null)).toBe('');
    expect(formatDate('pas une date')).toBe('');
  });

  it('formate un créneau sur une ou deux journées', () => {
    expect(plain(formatSlot(summer, '2026-09-24T13:30:00.000Z'))).toBe(
      'jeu. 24 sept. · 14:00 – 15:30'
    );
    expect(plain(formatSlot(summer, '2026-09-26T15:00:00.000Z'))).toBe(
      'jeu. 24 sept. 14:00 → sam. 26 sept. 17:00'
    );
  });
});

describe('formatHours', () => {
  it.each([
    [1.3333, '1 h 20'],
    [2, '2 h'],
    [0.75, '45 min'],
    [0, '0 min'],
    [10.5, '10 h 30'],
  ])('%s h → %s', (hours, expected) => {
    expect(formatHours(hours)).toBe(expected);
  });
});

describe('normalizeSearch', () => {
  it('ignore la casse et les accents', () => {
    expect(normalizeSearch('  Hélène ÉLOÏSE ')).toBe('helene eloise');
  });
});
