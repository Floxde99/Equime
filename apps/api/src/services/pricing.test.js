/**
 * Tests unitaires — tarification et réductions (EPIC 6).
 */
import { describe, expect, it } from 'vitest';

import { applyBestDiscount, computeInvoiceTotalCents } from './pricing.js';

describe('applyBestDiscount', () => {
  it('applique la réduction famille nombreuse pour 2 cavaliers', () => {
    const result = applyBestDiscount({
      basePriceCents: 8900,
      riderCount: 2,
      rules: [
        { id: 'rule_10', label: 'Famille nombreuse', percentage: 10, minRiders: 2, active: true },
      ],
    });

    expect(result.finalPriceCents).toBe(8010);
    expect(result.appliedRule?.id).toBe('rule_10');
  });

  it('ne retient que la meilleure réduction applicable et jamais un montant négatif', () => {
    const result = applyBestDiscount({
      basePriceCents: 1000,
      riderCount: 3,
      rules: [
        { id: 'rule_10', label: 'Famille nombreuse', percentage: 10, minRiders: 2, active: true },
        { id: 'rule_15', label: 'Tribu', percentage: 15, minRiders: 3, active: true },
        { id: 'rule_200', label: 'Promo impossible', percentage: 200, minRiders: 3, active: true },
      ],
    });

    expect(result.finalPriceCents).toBe(0);
    expect(result.appliedRule?.id).toBe('rule_200');
  });
});

describe('computeInvoiceTotalCents', () => {
  it('somme des lignes détaillées en centimes', () => {
    const total = computeInvoiceTotalCents([
      { label: 'Abonnement', quantity: 1, unitCents: 8010 },
      { label: 'Stage', quantity: 2, unitCents: 1500 },
    ]);

    expect(total).toBe(11010);
  });
});
