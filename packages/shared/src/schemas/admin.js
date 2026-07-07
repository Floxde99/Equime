/**
 * Schémas Zod — administration (EPIC 9).
 */
import { z } from 'zod';

export const userIdParamSchema = z.object({
  id: z.string().min(1),
});

export const reviewDocumentSchema = z
  .object({
    docType: z.enum(['medical_certificate', 'license']),
    decision: z.enum(['approved', 'rejected']),
    rejectionReason: z.string().trim().max(500).optional(),
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
