/**
 * Schémas Zod — administration (EPIC 9).
 */
import { z } from 'zod';

import { ROLES } from '../constants.js';

import { registerSchema, updateMeSchema } from './auth.js';
import { documentExpiresAtSchema } from './riders.js';

export const userIdParamSchema = z.object({
  id: z.string().min(1),
});

const MEMBER_ROLES = /** @type {[string, string]} */ ([ROLES.INSTRUCTOR, ROLES.CLIENT]);

/**
 * Création d'un compte membre par un admin (Excel 7.1).
 * `instructor` (défaut) : pas de famille. `client` : famille vide, quota 0.
 */
export const createMemberSchema = registerSchema.extend({
  role: z.enum(MEMBER_ROLES).default(ROLES.INSTRUCTOR),
});

/** Alias historique — le body accepte désormais `role: instructor | client`. */
export const createInstructorSchema = createMemberSchema;

/** Édition fiche membre (prénom, nom, téléphone) — le rôle n'est pas modifiable. */
export const updateMemberProfileSchema = updateMeSchema;

export const reviewDocumentSchema = z
  .object({
    docType: z.enum(['medical_certificate', 'license']),
    decision: z.enum(['approved', 'rejected']),
    rejectionReason: z.string().trim().max(500).optional(),
    expiresAt: z
      .union([documentExpiresAtSchema, z.literal('').transform(() => undefined)])
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.decision === 'rejected' && !data.rejectionReason?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['rejectionReason'],
        message: 'Le motif est obligatoire en cas de refus',
      });
    }
  });

export const riderDocumentReviewParamSchema = z.object({
  riderId: z.string().min(1),
});

export const adminRiderDocumentParamSchema = z.object({
  riderId: z.string().min(1),
  docType: z.enum(['medical_certificate', 'license']),
});
