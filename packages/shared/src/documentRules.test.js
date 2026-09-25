/**
 * Tests unitaires — validité des documents cavalier à une date donnée.
 */
import { describe, expect, it } from 'vitest';

import { areRiderDocumentsValidAt, isDocumentExpiredAt } from './documentRules.js';

const rider = (overrides = {}) => ({
  medicalCertificateStatus: 'approved',
  licenseStatus: 'approved',
  medicalCertificateExpiresAt: '2026-10-15T00:00:00.000Z',
  licenseExpiresAt: '2026-12-31T00:00:00.000Z',
  ...overrides,
});

describe('isDocumentExpiredAt', () => {
  it('reste valide toute la journée d’expiration', () => {
    expect(isDocumentExpiredAt('2026-10-15', '2026-10-15T20:00:00Z')).toBe(false);
    expect(isDocumentExpiredAt('2026-10-15', '2026-10-16T08:00:00Z')).toBe(true);
  });

  it('considère une date absente ou invalide comme non expirée', () => {
    expect(isDocumentExpiredAt(null)).toBe(false);
    expect(isDocumentExpiredAt('n/a')).toBe(false);
  });
});

describe('areRiderDocumentsValidAt', () => {
  it('vérifie la validité à la date de la séance, pas au jour de l’inscription', () => {
    expect(areRiderDocumentsValidAt(rider(), '2026-10-01T10:00:00Z')).toBe(true);
    // Certificat expiré le 15/10 : une séance du 20/10 doit être refusée
    expect(areRiderDocumentsValidAt(rider(), '2026-10-20T10:00:00Z')).toBe(false);
  });

  it('exige que les deux documents soient validés', () => {
    expect(areRiderDocumentsValidAt(rider({ licenseStatus: 'pending' }), '2026-10-01')).toBe(false);
    expect(areRiderDocumentsValidAt(null)).toBe(false);
  });
});
