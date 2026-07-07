/**
 * Schémas Zod — événements et inscriptions.
 */
import { z } from 'zod';

import { EVENT_TYPE_VALUES } from '../constants.js';

export const eventIdParamSchema = z.object({
  id: z.string().min(1),
});

export const eventRegistrationIdParamSchema = z.object({
  id: z.string().min(1),
  registrationId: z.string().min(1),
});

const eventBodySchema = z.object({
  title: z.string().trim().min(1, 'Le titre est requis').max(120),
  description: z.string().trim().max(2000).optional().or(z.literal('').transform(() => undefined)),
  type: z.enum(EVENT_TYPE_VALUES),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  capacity: z.coerce.number().int().positive().max(200),
  priceCents: z.coerce.number().int().min(0).max(1_000_000).default(0),
  location: z.string().trim().max(120).optional().or(z.literal('').transform(() => undefined)),
});

/** @param {z.infer<typeof eventBodySchema>} data @param {import('zod').RefinementCtx} ctx */
function validateEventBody(data, ctx) {
  if (data.endAt <= data.startAt) {
    ctx.addIssue({ code: 'custom', message: 'La fin doit être après le début', path: ['endAt'] });
  }
}

export const createEventSchema = eventBodySchema.superRefine(validateEventBody);

export const updateEventSchema = eventBodySchema.partial().superRefine((data, ctx) => {
  if (data.startAt && data.endAt && data.endAt <= data.startAt) {
    ctx.addIssue({ code: 'custom', message: 'La fin doit être après le début', path: ['endAt'] });
  }
});

export const eventRegistrationSchema = z.object({
  riderId: z.string().min(1),
});
