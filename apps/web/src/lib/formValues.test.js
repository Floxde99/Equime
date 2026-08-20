import { describe, expect, it } from 'vitest';

import { blankToUndefined, toDatetimeLocalValue } from './formValues.js';

describe('blankToUndefined', () => {
  it('convertit une chaîne vide en undefined', () => {
    expect(blankToUndefined('')).toBeUndefined();
  });

  it('laisse les autres valeurs inchangées', () => {
    expect(blankToUndefined('ok')).toBe('ok');
    expect(blankToUndefined(0)).toBe(0);
  });
});

describe('toDatetimeLocalValue', () => {
  it('retourne une chaîne vide si la date est absente', () => {
    expect(toDatetimeLocalValue(null)).toBe('');
    expect(toDatetimeLocalValue(undefined)).toBe('');
  });

  it('formate une date ISO en datetime-local', () => {
    const value = toDatetimeLocalValue('2026-08-20T14:05:00');
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});
