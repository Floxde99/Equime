import { describe, expect, it } from 'vitest';

import {
  buildInstallments,
  proRataCents,
  scheduleDueDates,
  seasonAt,
  seasonLabel,
  splitAmount,
} from './seasons.js';

const SETTINGS = {
  seasonStart: '09-01',
  seasonEnd: '06-30',
  installmentDay: 5,
  quarterDueDates: ['09-05', '01-05', '04-05'],
};

describe('seasonAt', () => {
  it('borne la saison du 1er septembre au 30 juin inclus, heure de Paris', () => {
    const season = seasonAt(new Date('2026-11-15T10:00:00Z'), SETTINGS);
    expect(season.start.toISOString()).toBe('2026-08-31T22:00:00.000Z');
    expect(season.end.toISOString()).toBe('2027-06-30T22:00:00.000Z');
    expect(seasonLabel(season)).toBe('2026-2027');
  });

  it('rattache le printemps à la saison commencée l’année précédente', () => {
    expect(seasonAt(new Date('2027-03-10T10:00:00Z'), SETTINGS).startYear).toBe(2026);
  });

  it('entre deux saisons, renvoie la saison qui commence', () => {
    const season = seasonAt(new Date('2027-07-15T10:00:00Z'), SETTINGS);
    expect(season.startYear).toBe(2027);
    expect(season.start.toISOString()).toBe('2027-08-31T22:00:00.000Z');
  });

  it('bascule à minuit heure de Paris, pas à minuit UTC', () => {
    // 31 août 23 h 30 à Paris = 21 h 30 UTC : encore l'été, donc la saison qui commence le lendemain
    expect(seasonAt(new Date('2026-08-31T21:30:00Z'), SETTINGS).startYear).toBe(2026);
    // 1er juillet 00 h 30 à Paris : la saison 2026-2027 est terminée
    expect(seasonAt(new Date('2027-06-30T22:30:00Z'), SETTINGS).startYear).toBe(2027);
  });
});

describe('scheduleDueDates', () => {
  const season = seasonAt(new Date('2026-09-10T10:00:00Z'), SETTINGS);

  it('place les trois échéances trimestrielles sur la bonne année', () => {
    expect(scheduleDueDates('quarterly', season, SETTINGS).map((d) => d.toISOString())).toEqual([
      '2026-09-04T22:00:00.000Z',
      '2027-01-04T23:00:00.000Z',
      '2027-04-04T22:00:00.000Z',
    ]);
  });

  it('place dix échéances le 5 de chaque mois, de septembre à juin', () => {
    const dates = scheduleDueDates('ten_installments', season, SETTINGS);
    expect(dates).toHaveLength(10);
    expect(dates[0].toISOString()).toBe('2026-09-04T22:00:00.000Z');
    expect(dates[4].toISOString()).toBe('2027-01-04T23:00:00.000Z');
    expect(dates[9].toISOString()).toBe('2027-06-04T22:00:00.000Z');
  });
});

describe('splitAmount', () => {
  it('répartit au centime, le reste sur la première échéance', () => {
    expect(splitAmount(100_000, 3)).toEqual([33_334, 33_333, 33_333]);
    expect(splitAmount(89_005, 10).reduce((a, b) => a + b, 0)).toBe(89_005);
    expect(splitAmount(89_005, 10)[0]).toBe(8_905);
  });
});

describe('buildInstallments', () => {
  const season = seasonAt(new Date('2026-07-10T10:00:00Z'), SETTINGS);
  const dueDates = scheduleDueDates('ten_installments', season, SETTINGS);

  it('garde toutes les échéances pour une inscription avant la saison', () => {
    const plan = buildInstallments({
      totalCents: 90_000,
      dueDates,
      now: new Date('2026-07-10T10:00:00Z'),
    });
    expect(plan).toHaveLength(10);
    expect(plan.map((i) => i.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(plan.every((i) => i.amountCents === 9_000)).toBe(true);
  });

  it('regroupe les échéances passées en une échéance immédiate', () => {
    const now = new Date('2026-11-10T10:00:00Z');
    const plan = buildInstallments({ totalCents: 70_000, dueDates, now });
    // novembre (immédiate) puis décembre à juin
    expect(plan).toHaveLength(8);
    expect(plan[0].dueAt).toEqual(now);
    expect(plan[1].dueAt.toISOString()).toBe('2026-12-04T23:00:00.000Z');
    expect(plan.reduce((sum, i) => sum + i.amountCents, 0)).toBe(70_000);
  });

  it('crée une seule échéance immédiate en fin de saison', () => {
    const now = new Date('2027-06-20T10:00:00Z');
    expect(buildInstallments({ totalCents: 5_000, dueDates, now })).toEqual([
      { sequence: 1, dueAt: now, amountCents: 5_000 },
    ]);
  });
});

describe('proRataCents', () => {
  const season = seasonAt(new Date('2026-10-01T10:00:00Z'), SETTINGS);

  it('facture la saison complète avant son début', () => {
    expect(proRataCents(90_000, season, new Date('2026-08-20T10:00:00Z'))).toBe(90_000);
  });

  it('réduit le prix au prorata des semaines restantes', () => {
    // 15 janvier : 24 semaines restantes sur 44
    expect(proRataCents(90_000, season, new Date('2027-01-15T10:00:00Z'))).toBe(
      Math.round((90_000 * 24) / 44)
    );
  });
});
