/**
 * Schémas Zod — abonnements, réductions et factures (EPIC 6).
 */
import { z } from 'zod';

import { INVOICE_STATUS_VALUES } from '../constants.js';

export const invoiceIdParamSchema = z.object({
  id: z.string().min(1),
});

const nullableDateSchema = z
  .union([z.coerce.date(), z.literal('').transform(() => undefined)])
  .optional();

export const subscriptionPlanBodySchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis').max(80),
  description: z.string().trim().max(500).optional().or(z.literal('').transform(() => undefined)),
  priceCents: z.coerce.number().int().min(0),
  sessionsPerWeek: z.coerce.number().int().positive().max(14),
  active: z.boolean().default(true),
});

export const createSubscriptionPlanSchema = subscriptionPlanBodySchema;
export const updateSubscriptionPlanSchema = subscriptionPlanBodySchema.partial();

export const discountRuleBodySchema = z.object({
  label: z.string().trim().min(1, 'Le libellé est requis').max(120),
  description: z.string().trim().max(500).optional().or(z.literal('').transform(() => undefined)),
  percentage: z.coerce.number().int().min(0).max(1000),
  minRiders: z.coerce.number().int().positive().max(20).optional(),
  active: z.boolean().default(true),
});

export const createDiscountRuleSchema = discountRuleBodySchema;
export const updateDiscountRuleSchema = discountRuleBodySchema.partial();

export const invoiceItemInputSchema = z.object({
  label: z.string().trim().min(1, 'Le libellé est requis').max(200),
  quantity: z.coerce.number().int().positive().max(999).default(1),
  unitCents: z.coerce.number().int().min(0),
});

export const createInvoiceSchema = z.object({
  familyId: z.string().min(1),
  subscriptionPlanId: z.string().min(1).optional(),
  dueAt: nullableDateSchema,
  items: z.array(invoiceItemInputSchema).min(1).optional(),
});

export const updateInvoiceStatusSchema = z.object({
  status: z.enum(INVOICE_STATUS_VALUES),
});

/** Première souscription client (Excel 8.2) — uniquement si la famille n'a pas encore de formule. */
export const subscribeFamilyPlanSchema = z.object({
  subscriptionPlanId: z.string().min(1, 'La formule est requise'),
});

export const familyIdParamSchema = z.object({
  id: z.string().min(1),
});

/** Changement de formule par l'admin (Excel 8.2) — réinitialise le quota. */
export const adminChangeFamilySubscriptionSchema = subscribeFamilyPlanSchema;
