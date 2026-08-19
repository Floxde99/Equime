/**
 * Schémas Zod — missions de bénévolat et inscriptions.
 */
import { z } from 'zod';

export const volunteerMissionIdParamSchema = z.object({
  id: z.string().min(1),
});

const missionBodySchema = z.object({
  title: z.string().trim().min(1, 'Le titre est requis').max(120),
  description: z.string().trim().max(2000).optional().or(z.literal('').transform(() => undefined)),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().optional(),
  slots: z.coerce.number().int().positive().max(100),
});

/** @param {z.infer<typeof missionBodySchema>} data @param {import('zod').RefinementCtx} ctx */
function validateMissionBody(data, ctx) {
  if (data.endAt && data.endAt <= data.startAt) {
    ctx.addIssue({ code: 'custom', message: 'La fin doit être après le début', path: ['endAt'] });
  }
}

export const createVolunteerMissionSchema = missionBodySchema.superRefine(validateMissionBody);
export const updateVolunteerMissionSchema = missionBodySchema.partial().superRefine(validateMissionBody);
