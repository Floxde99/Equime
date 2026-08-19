/**
 * Schémas Zod — cavalerie et carnet de santé (EPIC 3).
 */
import { z } from 'zod';

import { HEALTH_LOG_TYPE_VALUES, HORSE_STATUS_VALUES, RIDER_LEVEL_VALUES } from '../constants.js';

const riderLevelSchema = z.enum(RIDER_LEVEL_VALUES);

export const horseIdParamSchema = z.object({
  id: z.string().min(1),
});

const horseBodySchema = z.object({
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

/** @param {z.infer<typeof horseBodySchema>} data @param {import('zod').RefinementCtx} ctx */
function validateHorseLevels(data, ctx) {
  const levels = RIDER_LEVEL_VALUES;
  if (levels.indexOf(data.minLevel) > levels.indexOf(data.maxLevel)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Le niveau minimum ne peut pas dépasser le niveau maximum',
      path: ['minLevel'],
    });
  }
}

export const createHorseSchema = horseBodySchema.superRefine(validateHorseLevels);

export const updateHorseSchema = horseBodySchema.partial();

export const createHealthLogSchema = z.object({
  type: z.enum(HEALTH_LOG_TYPE_VALUES),
  notes: z.string().trim().min(1, 'Les notes sont requises').max(2000),
  occurredAt: z.coerce.date(),
});
