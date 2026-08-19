import { describe, expect, it } from 'vitest';

import { readClubContact } from './clubContact.js';

describe('readClubContact', () => {
  it('lit adresse, téléphone et email depuis les variables Vite', () => {
    expect(
      readClubContact({
        VITE_CLUB_ADDRESS: '  12 chemin des Écuries, 31000 Toulouse ',
        VITE_CLUB_PHONE: '05 61 00 00 00',
        VITE_CLUB_EMAIL: 'contact@equime.local',
      })
    ).toEqual({
      address: '12 chemin des Écuries, 31000 Toulouse',
      phone: '05 61 00 00 00',
      email: 'contact@equime.local',
      licenseCents: null,
      cotisationCents: null,
    });
  });

  it('renvoie des chaînes vides et des tarifs nuls si les variables sont absentes', () => {
    expect(readClubContact({})).toEqual({
      address: '',
      phone: '',
      email: '',
      licenseCents: null,
      cotisationCents: null,
    });
  });

  it('lit licence FFE et cotisation club en centimes quand elles sont configurées', () => {
    expect(
      readClubContact({
        VITE_CLUB_LICENSE_CENTS: '  3500 ',
        VITE_CLUB_COTISATION_CENTS: '8000',
      })
    ).toMatchObject({
      licenseCents: 3500,
      cotisationCents: 8000,
    });
  });

  it('masque licence et cotisation si les variables sont vides', () => {
    expect(
      readClubContact({
        VITE_CLUB_LICENSE_CENTS: '',
        VITE_CLUB_COTISATION_CENTS: '  ',
      })
    ).toMatchObject({
      licenseCents: null,
      cotisationCents: null,
    });
  });

  it('refuse un montant licence ou cotisation non entier', () => {
    expect(() => readClubContact({ VITE_CLUB_LICENSE_CENTS: '49,00' })).toThrow();
    expect(() => readClubContact({ VITE_CLUB_COTISATION_CENTS: '-1' })).toThrow();
  });
});
