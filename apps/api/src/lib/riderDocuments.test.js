import { describe, expect, it } from 'vitest';

import { AppError } from './appError.js';
import { assertRiderDocumentsApproved, isDocumentExpired } from './riderDocuments.js';

const approved = {
  medicalCertificateStatus: 'approved',
  licenseStatus: 'approved',
};

describe('isDocumentExpired', () => {
  it('considère une date antérieure à aujourd’hui comme expirée', () => {
    expect(
      isDocumentExpired(new Date('2020-01-01T00:00:00.000Z'), new Date('2026-08-18T12:00:00.000Z'))
    ).toBe(true);
  });

  it('accepte une date d’expiration égale à aujourd’hui', () => {
    expect(
      isDocumentExpired(new Date('2026-08-18T00:00:00.000Z'), new Date('2026-08-18T23:00:00.000Z'))
    ).toBe(false);
  });

  it('ignore une date absente', () => {
    expect(isDocumentExpired(null, new Date('2026-08-18T12:00:00.000Z'))).toBe(false);
  });
});

describe('assertRiderDocumentsApproved', () => {
  it('accepte un cavalier aux deux documents approuvés', () => {
    expect(() => assertRiderDocumentsApproved(approved)).not.toThrow();
  });

  it('refuse un certificat ou une licence non approuvés', () => {
    expect(() =>
      assertRiderDocumentsApproved({
        medicalCertificateStatus: 'pending',
        licenseStatus: 'approved',
      })
    ).toThrow(AppError);
    expect(() =>
      assertRiderDocumentsApproved({
        medicalCertificateStatus: 'approved',
        licenseStatus: 'missing',
      })
    ).toThrow(AppError);
  });

  it('refuse un certificat ou une licence expirés même s’ils sont approuvés', () => {
    expect(() =>
      assertRiderDocumentsApproved(
        {
          ...approved,
          medicalCertificateExpiresAt: new Date('2026-01-01T00:00:00.000Z'),
          licenseExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
        },
        new Date('2026-08-18T12:00:00.000Z')
      )
    ).toThrow(AppError);
    expect(() =>
      assertRiderDocumentsApproved(
        {
          ...approved,
          medicalCertificateExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
          licenseExpiresAt: new Date('2025-12-31T00:00:00.000Z'),
        },
        new Date('2026-08-18T12:00:00.000Z')
      )
    ).toThrow(AppError);
  });

  it('accepte des dates d’expiration encore valides', () => {
    expect(() =>
      assertRiderDocumentsApproved(
        {
          ...approved,
          medicalCertificateExpiresAt: new Date('2026-08-18T00:00:00.000Z'),
          licenseExpiresAt: new Date('2026-12-31T00:00:00.000Z'),
        },
        new Date('2026-08-18T12:00:00.000Z')
      )
    ).not.toThrow();
  });
});
