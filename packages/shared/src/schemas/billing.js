/**
 * Schémas Zod — abonnements, réductions et factures (EPIC 6).
 */
import { z } from 'zod';

import {
  INVOICE_STATUS_VALUES,
  PAYMENT_METHOD_VALUES,
  PAYMENT_SCHEDULE_VALUES,
} from '../constants.js';

/** Plafond d'un montant saisi (10 000 €) : quantité × prix reste sous la limite d'un entier Postgres. */
export const MAX_AMOUNT_CENTS = 1_000_000;

export const invoiceIdParamSchema = z.object({
  id: z.string().min(1),
});

const nullableDateSchema = z
  .union([z.coerce.date(), z.literal('').transform(() => undefined)])
  .optional();

export const subscriptionPlanBodySchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis').max(80),
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  priceCents: z.coerce
    .number()
    .int()
    .min(0, 'Le prix ne peut pas être négatif')
    .max(MAX_AMOUNT_CENTS, 'Montant trop élevé (10 000 € maximum)'),
  sessionsPerWeek: z.coerce.number().int().positive().max(14),
  active: z.boolean().default(true),
});

export const createSubscriptionPlanSchema = subscriptionPlanBodySchema;
export const updateSubscriptionPlanSchema = subscriptionPlanBodySchema.partial();

export const discountRuleBodySchema = z.object({
  label: z.string().trim().min(1, 'Le libellé est requis').max(120),
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  percentage: z.coerce
    .number()
    .int()
    .min(1, 'Au moins 1 %')
    .max(100, 'Une réduction ne peut pas dépasser 100 %'),
  minRiders: z.coerce.number().int().positive().max(20).optional(),
  active: z.boolean().default(true),
});

export const createDiscountRuleSchema = discountRuleBodySchema;
export const updateDiscountRuleSchema = discountRuleBodySchema.partial();

export const invoiceItemInputSchema = z.object({
  label: z.string().trim().min(1, 'Le libellé est requis').max(200),
  quantity: z.coerce.number().int().positive().max(999).default(1),
  unitCents: z.coerce
    .number()
    .int()
    .min(0, 'Le prix ne peut pas être négatif')
    .max(MAX_AMOUNT_CENTS, 'Montant trop élevé (10 000 € maximum)'),
});

/** Facture libre (les forfaits de saison sont facturés à la souscription, ADR 011). */
export const createInvoiceSchema = z.object({
  familyId: z.string().min(1),
  dueAt: nullableDateSchema,
  items: z.array(invoiceItemInputSchema).min(1, 'Ajoutez au moins une ligne'),
});

export const updateInvoiceStatusSchema = z.object({
  status: z.enum(INVOICE_STATUS_VALUES),
});

export const familyIdParamSchema = z.object({
  id: z.string().min(1),
});

/** Souscription d'un forfait de saison pour un cavalier (ADR 011). */
export const subscribeRiderSchema = z.object({
  planId: z.string().min(1, 'Choisissez un forfait'),
  paymentSchedule: z.enum(PAYMENT_SCHEDULE_VALUES, 'Choisissez un échéancier'),
});

/** Aperçu avant souscription : prix, réduction et échéances datées. */
export const subscriptionPreviewQuerySchema = subscribeRiderSchema;

export const subscriptionIdParamSchema = z.object({
  id: z.string().min(1),
});

/** Règlement saisi au club (espèces, chèque, ANCV…) — ADR 011. */
export const recordPaymentSchema = z.object({
  method: z.enum(PAYMENT_METHOD_VALUES, 'Choisissez un mode de règlement'),
  amountCents: z.coerce
    .number()
    .int()
    .positive('Le montant doit être positif')
    .max(MAX_AMOUNT_CENTS, 'Montant trop élevé (10 000 € maximum)'),
  paidAt: z.coerce
    .date()
    .refine((date) => date.getTime() <= Date.now() + 60_000, 'La date ne peut pas être future')
    .optional(),
  reference: z
    .string()
    .trim()
    .max(80)
    .optional()
    .or(z.literal('').transform(() => undefined)),
});
