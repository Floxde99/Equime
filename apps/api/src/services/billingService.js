// @ts-check
/**
 * Facturation et abonnements (EPIC 6).
 */
import { NOTIFICATION_TYPES } from '@equime/shared';

import { AppError } from '../lib/appError.js';
import { prisma } from '../lib/prisma.js';

import { dispatchNotification } from './notificationService.js';
import { applyBestDiscount } from './pricing.js';

const PLAN_SELECT = {
  id: true,
  name: true,
  description: true,
  priceCents: true,
  sessionsPerWeek: true,
  active: true,
  createdAt: true,
  updatedAt: true,
};

const RULE_SELECT = {
  id: true,
  label: true,
  description: true,
  percentage: true,
  minRiders: true,
  active: true,
  createdAt: true,
  updatedAt: true,
};

const INVOICE_SELECT = {
  id: true,
  number: true,
  status: true,
  issuedAt: true,
  dueAt: true,
  totalCents: true,
  paidAt: true,
  createdAt: true,
  updatedAt: true,
  family: {
    select: {
      id: true,
      userId: true,
      user: { select: { firstName: true, lastName: true, email: true } },
    },
  },
  items: {
    select: { id: true, label: true, quantity: true, unitCents: true, totalCents: true },
    orderBy: { createdAt: 'asc' },
  },
};

export function listSubscriptionPlans() {
  return prisma.subscriptionPlan.findMany({ select: PLAN_SELECT, orderBy: { name: 'asc' } });
}

export function createSubscriptionPlan(input) {
  return prisma.subscriptionPlan.create({ data: input, select: PLAN_SELECT });
}

export async function updateSubscriptionPlan(planId, input) {
  await prisma.subscriptionPlan.findUniqueOrThrow({ where: { id: planId } });
  return prisma.subscriptionPlan.update({ where: { id: planId }, data: input, select: PLAN_SELECT });
}

export async function deleteSubscriptionPlan(planId) {
  const families = await prisma.family.count({ where: { subscriptionPlanId: planId } });
  if (families > 0) throw AppError.conflict("Impossible de supprimer une formule déjà attribuée");
  await prisma.subscriptionPlan.delete({ where: { id: planId } });
}

export function listDiscountRules() {
  return prisma.discountRule.findMany({ select: RULE_SELECT, orderBy: [{ percentage: 'desc' }, { label: 'asc' }] });
}

export function createDiscountRule(input) {
  return prisma.discountRule.create({ data: input, select: RULE_SELECT });
}

export async function updateDiscountRule(ruleId, input) {
  await prisma.discountRule.findUniqueOrThrow({ where: { id: ruleId } });
  return prisma.discountRule.update({ where: { id: ruleId }, data: input, select: RULE_SELECT });
}

export async function deleteDiscountRule(ruleId) {
  await prisma.discountRule.delete({ where: { id: ruleId } });
}

async function nextInvoiceNumber(tx) {
  const year = new Date().getUTCFullYear();
  const prefix = `FAC-${year}-`;
  const latest = await tx.invoice.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: 'desc' },
    select: { number: true },
  });
  const lastCounter = latest ? Number.parseInt(latest.number.slice(prefix.length), 10) : 0;
  return `${prefix}${String(lastCounter + 1).padStart(4, '0')}`;
}

async function buildInvoiceItems(tx, familyId, subscriptionPlanId, manualItems) {
  if (manualItems?.length) {
    return manualItems.map((item) => ({
      label: item.label,
      quantity: item.quantity,
      unitCents: item.unitCents,
      totalCents: item.quantity * item.unitCents,
    }));
  }

  const family = await tx.family.findUnique({
    where: { id: familyId },
    include: {
      riders: { select: { id: true } },
      subscriptionPlan: { select: PLAN_SELECT },
    },
  });
  if (!family) throw AppError.notFound('Famille introuvable');

  const plan =
    subscriptionPlanId
      ? await tx.subscriptionPlan.findUnique({ where: { id: subscriptionPlanId }, select: PLAN_SELECT })
      : family.subscriptionPlan;
  if (!plan) {
    throw AppError.badRequest("Aucune formule d'abonnement n'est associée à cette famille");
  }

  const rules = await tx.discountRule.findMany({ select: RULE_SELECT });
  const pricing = applyBestDiscount({
    basePriceCents: plan.priceCents,
    riderCount: family.riders.length,
    rules,
  });

  const items = [
    {
      label: `Abonnement ${plan.name}`,
      quantity: 1,
      unitCents: plan.priceCents,
      totalCents: plan.priceCents,
    },
  ];

  if (pricing.discountCents > 0 && pricing.appliedRule) {
    items.push({
      label: `Réduction ${pricing.appliedRule.label} (${pricing.appliedRule.percentage}%)`,
      quantity: 1,
      unitCents: -pricing.discountCents,
      totalCents: -pricing.discountCents,
    });
  }

  return items;
}

/**
 * @param {{ familyId: string, subscriptionPlanId?: string, dueAt?: Date, items?: Array<{ label: string, quantity: number, unitCents: number }> }} input
 */
export async function createInvoice(input) {
  return prisma.$transaction(async (tx) => {
    const items = await buildInvoiceItems(tx, input.familyId, input.subscriptionPlanId, input.items);
    const totalCents = Math.max(
      0,
      items.reduce((sum, item) => sum + item.totalCents, 0)
    );

    return tx.invoice.create({
      data: {
        familyId: input.familyId,
        number: await nextInvoiceNumber(tx),
        dueAt: input.dueAt ?? null,
        totalCents,
        items: { create: items },
      },
      select: INVOICE_SELECT,
    });
  });
}

export function listAdminInvoices() {
  return prisma.invoice.findMany({ select: INVOICE_SELECT, orderBy: [{ createdAt: 'desc' }] });
}

export async function listFamilyInvoices(userId) {
  const family = await prisma.family.findUnique({ where: { userId } });
  if (!family) return [];
  return prisma.invoice.findMany({
    where: { familyId: family.id },
    select: INVOICE_SELECT,
    orderBy: [{ createdAt: 'desc' }],
  });
}

async function getInvoiceForClient(userId, invoiceId) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, family: { userId } },
    select: INVOICE_SELECT,
  });
  if (!invoice) throw AppError.notFound('Facture introuvable');
  return invoice;
}

export async function sendInvoice(invoiceId) {
  const invoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: 'sent',
      issuedAt: new Date(),
    },
    select: INVOICE_SELECT,
  });

  await dispatchNotification({
    userId: invoice.family.userId,
    type: NOTIFICATION_TYPES.INVOICE_CREATED,
    title: 'Nouvelle facture disponible',
    body: `La facture ${invoice.number} est maintenant envoyée.`,
    linkUrl: '/app/factures',
    email: {
      subject: `Equime — Facture ${invoice.number} disponible`,
      text: [
        `Bonjour ${invoice.family.user.firstName},`,
        '',
        `La facture ${invoice.number} est maintenant disponible dans votre espace Equime.`,
        `Montant : ${(invoice.totalCents / 100).toFixed(2)} €.`,
      ].join('\n'),
      html: [
        `<p>Bonjour ${invoice.family.user.firstName},</p>`,
        `<p>La facture <strong>${invoice.number}</strong> est maintenant disponible dans votre espace Equime.</p>`,
        `<p>Montant : ${(invoice.totalCents / 100).toFixed(2)} €</p>`,
      ].join('\n'),
    },
  });
  return invoice;
}

export async function remindInvoice(invoiceId) {
  const invoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: 'overdue',
    },
    select: INVOICE_SELECT,
  });

  await dispatchNotification({
    userId: invoice.family.userId,
    type: NOTIFICATION_TYPES.INVOICE_REMINDER,
    title: 'Relance de facture',
    body: `La facture ${invoice.number} est toujours impayée.`,
    linkUrl: '/app/factures',
    email: {
      subject: `Equime — Relance facture ${invoice.number}`,
      text: [
        `Bonjour ${invoice.family.user.firstName},`,
        '',
        `La facture ${invoice.number} reste impayée.`,
        'Merci de régulariser la situation depuis votre espace client.',
      ].join('\n'),
      html: [
        `<p>Bonjour ${invoice.family.user.firstName},</p>`,
        `<p>La facture <strong>${invoice.number}</strong> reste impayée.</p>`,
        "<p>Merci de régulariser la situation depuis votre espace client.</p>",
      ].join('\n'),
    },
  });
  return invoice;
}

export async function payInvoice(userId, invoiceId) {
  await getInvoiceForClient(userId, invoiceId);
  const invoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: 'paid',
      paidAt: new Date(),
    },
    select: INVOICE_SELECT,
  });

  await dispatchNotification({
    userId,
    type: NOTIFICATION_TYPES.PAYMENT_CONFIRMED,
    title: 'Paiement confirmé',
    body: `Le paiement de la facture ${invoice.number} a bien été enregistré.`,
    linkUrl: '/app/factures',
    email: {
      subject: `Equime — Paiement confirmé ${invoice.number}`,
      text: [
        'Bonjour,',
        '',
        `Le paiement de la facture ${invoice.number} a bien été enregistré.`,
      ].join('\n'),
      html: [
        '<p>Bonjour,</p>',
        `<p>Le paiement de la facture <strong>${invoice.number}</strong> a bien été enregistré.</p>`,
      ].join('\n'),
    },
  });
  return invoice;
}
