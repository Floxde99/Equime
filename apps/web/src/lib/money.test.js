import { describe, expect, it } from 'vitest';

import {
  formatEuroCents,
  formatEventPrice,
  formatSeasonPlanPrice,
  formatTenInstallments,
} from './money.js';

describe('formatEuroCents', () => {
  it('formate un montant en euros (fr-FR)', () => {
    expect(formatEuroCents(8900)).toMatch(/89[,.]00/);
    expect(formatEuroCents(8900)).toContain('€');
  });

  it('tolère une valeur nulle', () => {
    expect(formatEuroCents(0)).toMatch(/0[,.]00/);
  });
});

describe('formatEventPrice', () => {
  it('affiche Gratuit si le prix est 0', () => {
    expect(formatEventPrice(0)).toBe('Gratuit');
  });

  it('formate un prix positif', () => {
    expect(formatEventPrice(4900)).toMatch(/49[,.]00/);
    expect(formatEventPrice(4900)).toContain('€');
  });

  it('n’invente pas de prix si la donnée est absente', () => {
    expect(formatEventPrice(undefined)).toBe('');
    expect(formatEventPrice(null)).toBe('');
  });
});

describe('formatSeasonPlanPrice', () => {
  it('affiche le prix de la saison complète', () => {
    const label = formatSeasonPlanPrice(89000);
    expect(label).toMatch(/890[,.]00/);
    expect(label).toMatch(/la saison$/);
  });

  it('indique la mensualité d’un paiement en 10 fois', () => {
    expect(formatTenInstallments(89000)).toMatch(/^soit 10 × 89[,.]00/);
  });
});
