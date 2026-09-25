// @ts-check
/**
 * Paramètres du club (ligne unique) — délais d'annulation, saison, échéanciers,
 * règles documentaires. Créés avec les valeurs par défaut à la première lecture.
 */
import { prisma } from '../lib/prisma.js';

const SETTINGS_ID = 1;

const SETTINGS_SELECT = {
  cancellationDeadlineHours: true,
  makeupValidityDays: true,
  seasonStart: true,
  seasonEnd: true,
  installmentDay: true,
  quarterDueDates: true,
  proRataOnLateJoin: true,
  minorHealthQuestionnaire: true,
  updatedAt: true,
};

/**
 * @param {any} [db] client Prisma ou transactionnel
 */
export async function getClubSettings(db = prisma) {
  return db.clubSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: {},
    select: SETTINGS_SELECT,
  });
}

/**
 * @param {Partial<{ cancellationDeadlineHours: number, makeupValidityDays: number,
 *   seasonStart: string, seasonEnd: string, installmentDay: number,
 *   quarterDueDates: string[], proRataOnLateJoin: boolean, minorHealthQuestionnaire: boolean }>} input
 */
export async function updateClubSettings(input) {
  return prisma.clubSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...input },
    update: input,
    select: SETTINGS_SELECT,
  });
}
