/**
 * Schémas Zod — cours, inscriptions, présences et planning (EPIC 4).
 */
import { z } from 'zod';

import {
  ATTENDANCE_STATUS_VALUES,
  COURSE_STATUS_VALUES,
  RECURRENCE_FREQUENCY_VALUES,
  RIDER_LEVEL_VALUES,
} from '../constants.js';

const riderLevelSchema = z.enum(RIDER_LEVEL_VALUES);

export const courseIdParamSchema = z.object({
  id: z.string().min(1),
});

export const enrollmentIdParamSchema = z.object({
  id: z.string().min(1),
  enrollmentId: z.string().min(1),
});

export const overrideHorseSchema = z.object({
  horseId: z.string().min(1),
});

export const compatibilityAuditSchema = z.object({});

const courseBodySchema = z.object({
  title: z.string().trim().min(1, 'Le titre est requis').max(120),
  description: z.string().trim().max(2000).optional().or(z.literal('').transform(() => undefined)),
  instructorId: z.string().min(1),
  spaceId: z.string().min(1),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  capacity: z.coerce.number().int().positive().max(30),
  minLevel: riderLevelSchema.default('initiation'),
  maxLevel: riderLevelSchema.default('galop_7'),
  status: z.enum(COURSE_STATUS_VALUES).default('scheduled'),
  recurrenceRule: z.enum(RECURRENCE_FREQUENCY_VALUES).optional(),
  recurrenceEndDate: z.coerce.date().optional(),
});

/** @param {z.infer<typeof courseBodySchema>} data @param {import('zod').RefinementCtx} ctx */
function validateCourseBody(data, ctx) {
  if (data.endAt <= data.startAt) {
    ctx.addIssue({ code: 'custom', message: 'La fin doit être après le début', path: ['endAt'] });
  }
  const levels = RIDER_LEVEL_VALUES;
  if (levels.indexOf(data.minLevel) > levels.indexOf(data.maxLevel)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Le niveau minimum ne peut pas dépasser le niveau maximum',
      path: ['minLevel'],
    });
  }
  if (data.recurrenceRule && !data.recurrenceEndDate) {
    ctx.addIssue({
      code: 'custom',
      message: 'La date de fin de récurrence est requise',
      path: ['recurrenceEndDate'],
    });
  }
  if (data.recurrenceEndDate && data.recurrenceEndDate < data.startAt) {
    ctx.addIssue({
      code: 'custom',
      message: 'La fin de récurrence doit être après le premier cours',
      path: ['recurrenceEndDate'],
    });
  }
}

export const createCourseSchema = courseBodySchema.superRefine(validateCourseBody);

export const updateCourseSchema = courseBodySchema
  .omit({ recurrenceRule: true, recurrenceEndDate: true })
  .partial();

export const cancelCourseSchema = z.object({
  cancelSeries: z.boolean().default(false),
});

export const enrollRiderSchema = z.object({
  riderId: z.string().min(1),
});

export const updateAttendanceSchema = z.object({
  attendance: z.enum(ATTENDANCE_STATUS_VALUES),
});

export const planningQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  scope: z.enum(['mine', 'all']).default('all'),
});
