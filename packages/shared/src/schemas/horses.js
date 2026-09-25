/**
 * Schémas Zod — cavalerie et carnet de santé (EPIC 3).
 */
import { z } from 'zod';

import { HEALTH_LOG_TYPE_VALUES, HORSE_STATUS_VALUES, RIDER_LEVEL_VALUES } from '../constants.js';

const riderLevelSchema = z.enum(RIDER_LEVEL_VALUES);

export const horseIdParamSchema = z.object({
  id: z.string().min(1),
});

/** Champs d'une fiche cheval, sans règle croisée (à composer côté formulaires). */
export const horseFieldsSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis').max(80),
  breed: z
    .string()
    .trim()
    .max(80)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  birthYear: z.coerce.number().int().min(1980).max(2100).optional(),
  status: z.enum(HORSE_STATUS_VALUES).default('fit'),
  minLevel: riderLevelSchema.default('initiation'),
  maxLevel: riderLevelSchema.default('galop_7'),
  maxWeeklyLoadHours: z.coerce.number().positive().max(40).default(12),
  alertThresholdHours: z.coerce.number().positive().max(40).default(10),
});

/**
 * Niveaux et seuils cohérents. En modification partielle, seuls les couples
 * fournis ensemble sont comparés.
 * @param {Partial<z.infer<typeof horseFieldsSchema>>} data
 * @param {import('zod').RefinementCtx} ctx
 */
export function refineHorseLevels(data, ctx) {
  const levels = RIDER_LEVEL_VALUES;
  if (
    data.minLevel &&
    data.maxLevel &&
    levels.indexOf(data.minLevel) > levels.indexOf(data.maxLevel)
  ) {
    ctx.addIssue({
      code: 'custom',
      message: 'Le niveau minimum ne peut pas dépasser le niveau maximum',
      path: ['minLevel'],
    });
  }
  if (
    data.alertThresholdHours != null &&
    data.maxWeeklyLoadHours != null &&
    data.alertThresholdHours > data.maxWeeklyLoadHours
  ) {
    ctx.addIssue({
      code: 'custom',
      message: 'Le seuil d’alerte ne peut pas dépasser la charge maximale',
      path: ['alertThresholdHours'],
    });
  }
}

export const createHorseSchema = horseFieldsSchema.superRefine(refineHorseLevels);

export const updateHorseSchema = horseFieldsSchema.partial().superRefine(refineHorseLevels);

export const createHealthLogSchema = z.object({
  type: z.enum(HEALTH_LOG_TYPE_VALUES),
  notes: z.string().trim().min(1, 'Les notes sont requises').max(2000),
  occurredAt: z.coerce.date(),
});
