/**
 * Schémas Zod — paramètres du club et recherche de familles (US-10.8).
 */
import { z } from 'zod';

/** Date sans année au format MM-JJ (ex. « 09-01 »), mois et jour cohérents. */
export const monthDaySchema = z
  .string()
  .regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'Format attendu : MM-JJ (ex. 09-01)')
  .refine((value) => {
    const [month, day] = value.split('-').map(Number);
    // 2024 est bissextile : le 29 février reste accepté
    return new Date(Date.UTC(2024, month - 1, day)).getUTCMonth() === month - 1;
  }, 'Cette date n’existe pas');

export const clubSettingsSchema = z.object({
  cancellationDeadlineHours: z.coerce
    .number()
    .int()
    .min(0, 'Minimum 0 heure')
    .max(168, 'Maximum 168 heures (7 jours)'),
  makeupValidityDays: z.coerce
    .number()
    .int()
    .min(7, 'Minimum 7 jours')
    .max(365, 'Maximum 365 jours'),
  seasonStart: monthDaySchema,
  seasonEnd: monthDaySchema,
  installmentDay: z.coerce
    .number()
    .int()
    .min(1, 'Entre le 1 et le 28')
    .max(28, 'Entre le 1 et le 28 (existe tous les mois)'),
  quarterDueDates: z.array(monthDaySchema).length(3, 'Trois échéances trimestrielles'),
  proRataOnLateJoin: z.boolean(),
  minorHealthQuestionnaire: z.boolean(),
});

export const updateClubSettingsSchema = clubSettingsSchema.partial();

/** Recherche de familles par le secrétariat (nom du parent, e-mail ou prénom d'un cavalier). */
export const familySearchQuerySchema = z.object({
  q: z.string().trim().min(2, 'Tapez au moins 2 caractères').max(80, 'Recherche trop longue'),
});
