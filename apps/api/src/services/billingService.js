// @ts-check
/**
 * Facturation et abonnements (EPIC 6).
 */
import { NOTIFICATION_TYPES } from '@equime/shared';

import { env } from '../config/env.js';
import { AppError } from '../lib/appError.js';
import { buildInvoicePdf, invoicePdfFilename } from '../lib/invoicePdf.js';
import { escapeHtml } from '../lib/mailer.js';
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
  return prisma.subscriptionPlan.update({
    where: { id: planId },
    data: input,
    select: PLAN_SELECT,
  });
}

export async function deleteSubscriptionPlan(planId) {
  const families = await prisma.family.count({ where: { subscriptionPlanId: planId } });
  if (families > 0) throw AppError.conflict('Impossible de supprimer une formule déjà attribuée');
  await prisma.subscriptionPlan.delete({ where: { id: planId } });
}

export function listDiscountRules() {
  return prisma.discountRule.findMany({
    select: RULE_SELECT,
    orderBy: [{ percentage: 'desc' }, { label: 'asc' }],
  });
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

  const plan = subscriptionPlanId
    ? await tx.subscriptionPlan.findUnique({
        where: { id: subscriptionPlanId },
        select: PLAN_SELECT,
      })
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
    const items = await buildInvoiceItems(
      tx,
      input.familyId,
      input.subscriptionPlanId,
      input.items
    );
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

/**
 * Liste admin : tous les statuts, y compris les brouillons (non envoyés).
 * @returns {Promise<object[]>}
 */
export function listAdminInvoices() {
  return prisma.invoice.findMany({ select: INVOICE_SELECT, orderBy: [{ createdAt: 'desc' }] });
}

/**
 * Bornes du mois calendaire local (évite les doublons de facture d'abonnement).
 * @param {Date} [now]
 * @returns {{ periodStart: Date, periodEnd: Date }}
 */
function calendarMonthRange(now = new Date()) {
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { periodStart, periodEnd };
}

/**
 * Génère une facture d'abonnement (brouillon) pour chaque famille ayant une
 * formule, si aucune facture n'existe déjà sur le mois calendaire en cours
 * (Excel 12.1 — génération batch, sans cron).
 *
 * @returns {Promise<{ invoices: object[], createdCount: number, skippedCount: number }>}
 */
export async function generateSubscriptionInvoices() {
  const { periodStart, periodEnd } = calendarMonthRange();
  const families = await prisma.family.findMany({
    where: { subscriptionPlanId: { not: null } },
    select: { id: true },
  });

  /** @type {object[]} */
  const invoices = [];
  let skippedCount = 0;

  for (const family of families) {
    const existing = await prisma.invoice.count({
      where: {
        familyId: family.id,
        createdAt: { gte: periodStart, lt: periodEnd },
      },
    });
    if (existing > 0) {
      skippedCount += 1;
      continue;
    }
    invoices.push(await createInvoice({ familyId: family.id }));
  }

  return { invoices, createdCount: invoices.length, skippedCount };
}

/** Statuts visibles côté client — les brouillons restent internes à l'admin. */
const CLIENT_INVOICE_STATUSES = ['sent', 'paid', 'overdue'];

export async function listFamilyInvoices(userId) {
  const family = await prisma.family.findUnique({ where: { userId } });
  if (!family) return [];
  return prisma.invoice.findMany({
    where: { familyId: family.id, status: { in: CLIENT_INVOICE_STATUSES } },
    select: INVOICE_SELECT,
    orderBy: [{ createdAt: 'desc' }],
  });
}

async function getInvoiceOrThrow(invoiceId) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: INVOICE_SELECT,
  });
  if (!invoice) throw AppError.notFound('Facture introuvable');
  return invoice;
}

/**
 * Détail admin d'une facture (lignes, totaux, famille, dates).
 * @param {string} invoiceId
 */
export function getAdminInvoice(invoiceId) {
  return getInvoiceOrThrow(invoiceId);
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
  const current = await getInvoiceOrThrow(invoiceId);
  if (current.status !== 'draft') {
    throw AppError.badRequest('Seule une facture brouillon peut être envoyée');
  }

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
        `<p>Bonjour ${escapeHtml(invoice.family.user.firstName)},</p>`,
        `<p>La facture <strong>${escapeHtml(invoice.number)}</strong> est maintenant disponible dans votre espace Equime.</p>`,
        `<p>Montant : ${(invoice.totalCents / 100).toFixed(2)} €</p>`,
      ].join('\n'),
    },
  });
  return invoice;
}

export async function remindInvoice(invoiceId) {
  const current = await getInvoiceOrThrow(invoiceId);
  if (current.status !== 'sent' && current.status !== 'overdue') {
    throw AppError.badRequest('Seule une facture envoyée ou en retard peut être relancée');
  }

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
        `<p>Bonjour ${escapeHtml(invoice.family.user.firstName)},</p>`,
        `<p>La facture <strong>${escapeHtml(invoice.number)}</strong> reste impayée.</p>`,
        '<p>Merci de régulariser la situation depuis votre espace client.</p>',
      ].join('\n'),
    },
  });
  return invoice;
}

function clubIssuer() {
  return {
    name: env.CLUB_NAME,
    address: env.CLUB_ADDRESS,
    phone: env.CLUB_PHONE,
    email: env.CLUB_EMAIL,
  };
}

/**
 * PDF admin : tous les statuts, y compris brouillon.
 * @param {string} invoiceId
 * @returns {Promise<{ buffer: Buffer, filename: string }>}
 */
export async function getAdminInvoicePdf(invoiceId) {
  const invoice = await getInvoiceOrThrow(invoiceId);
  const buffer = await buildInvoicePdf(invoice, clubIssuer());
  return { buffer, filename: invoicePdfFilename(invoice.number) };
}

/**
 * PDF client : uniquement factures envoyées, payées ou en retard (anti-brouillon).
 * @param {string} userId
 * @param {string} invoiceId
 * @returns {Promise<{ buffer: Buffer, filename: string }>}
 */
export async function getClientInvoicePdf(userId, invoiceId) {
  const invoice = await getInvoiceForClient(userId, invoiceId);
  if (!CLIENT_INVOICE_STATUSES.includes(invoice.status)) {
    throw AppError.notFound('Facture introuvable');
  }
  const buffer = await buildInvoicePdf(invoice, clubIssuer());
  return { buffer, filename: invoicePdfFilename(invoice.number) };
}

const PUBLIC_PLAN_SELECT = {
  id: true,
  name: true,
  description: true,
  priceCents: true,
  sessionsPerWeek: true,
};

const FAMILY_SUBSCRIPTION_SELECT = {
  id: true,
  userId: true,
  sessionQuota: true,
  subscriptionPlanId: true,
  subscriptionPlan: { select: PLAN_SELECT },
};

/**
 * Quota mensuel initial : séances par semaine × 4 (Excel 8.2, aligné sur le seed).
 * @param {number} sessionsPerWeek
 */
export function monthlySessionQuota(sessionsPerWeek) {
  return sessionsPerWeek * 4;
}

/**
 * Formules actives pour la vitrine et le compte famille (Excel 1.2 / 8.2).
 */
export function listActivePublicPlans() {
  return prisma.subscriptionPlan.findMany({
    where: { active: true },
    select: PUBLIC_PLAN_SELECT,
    orderBy: { priceCents: 'asc' },
  });
}

/**
 * Abonnement de la famille du client connecté.
 * @param {string} userId
 */
export async function getFamilySubscription(userId) {
  const family = await prisma.family.findUnique({
    where: { userId },
    select: FAMILY_SUBSCRIPTION_SELECT,
  });
  if (!family) throw AppError.forbidden('Aucune famille associée à ce compte');
  return family;
}

/**
 * Première souscription client : uniquement si `subscriptionPlanId` est null.
 * @param {string} userId
 * @param {string} planId
 */
export async function subscribeFamilyPlan(userId, planId) {
  const family = await prisma.family.findUnique({ where: { userId } });
  if (!family) throw AppError.forbidden('Aucune famille associée à ce compte');
  if (family.subscriptionPlanId) {
    throw AppError.conflict(
      'Une formule est déjà associée à votre famille. Pour la modifier, contactez le secrétariat.'
    );
  }

  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan || !plan.active) throw AppError.notFound('Formule introuvable');

  const quota = monthlySessionQuota(plan.sessionsPerWeek);
  const result = await prisma.family.updateMany({
    where: { id: family.id, subscriptionPlanId: null },
    data: { subscriptionPlanId: plan.id, sessionQuota: quota },
  });
  if (result.count === 0) {
    throw AppError.conflict(
      'Une formule est déjà associée à votre famille. Pour la modifier, contactez le secrétariat.'
    );
  }

  const updated = await prisma.family.findUniqueOrThrow({
    where: { id: family.id },
    select: FAMILY_SUBSCRIPTION_SELECT,
  });

  await dispatchNotification({
    userId,
    type: NOTIFICATION_TYPES.SUBSCRIPTION_CONFIRMED,
    title: 'Formule enregistrée',
    body: `Votre famille est abonnée à la formule ${plan.name}.`,
    linkUrl: '/app/compte',
  });

  return updated;
}

/**
 * Changement de formule par l'admin : réinitialise le quota sur le nouveau plan.
 * @param {string} familyId
 * @param {string} planId
 */
export async function adminChangeFamilySubscription(familyId, planId) {
  const family = await prisma.family.findUnique({ where: { id: familyId } });
  if (!family) throw AppError.notFound('Famille introuvable');

  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan) throw AppError.notFound('Formule introuvable');

  const updated = await prisma.family.update({
    where: { id: family.id },
    data: {
      subscriptionPlanId: plan.id,
      sessionQuota: monthlySessionQuota(plan.sessionsPerWeek),
    },
    select: FAMILY_SUBSCRIPTION_SELECT,
  });

  await dispatchNotification({
    userId: family.userId,
    type: NOTIFICATION_TYPES.SUBSCRIPTION_CONFIRMED,
    title: 'Formule mise à jour',
    body: `Votre formule d'abonnement est désormais ${plan.name}.`,
    linkUrl: '/app/compte',
  });

  return updated;
}

/**
 * Facture envoyée à l’inscription d’un stage tarifé (Excel 12.1).
 * Idempotente via `InvoiceItem.eventRegistrationId` unique.
 *
 * @param {{
 *   familyId: string,
 *   registrationId: string,
 *   riderName: string,
 *   eventTitle: string,
 *   priceCents: number,
 *   dueAt?: Date | null,
 * }} input
 * @returns {Promise<object | null>}
 */
export async function createSentInvoiceForEventRegistration(input) {
  if (!input.priceCents || input.priceCents <= 0) return null;

  const existingItem = await prisma.invoiceItem.findUnique({
    where: { eventRegistrationId: input.registrationId },
    select: { invoice: { select: INVOICE_SELECT } },
  });
  if (existingItem) return existingItem.invoice;

  /** @type {object | null} */
  let invoice = null;
  try {
    invoice = await prisma.$transaction(async (tx) => {
      return tx.invoice.create({
        data: {
          familyId: input.familyId,
          number: await nextInvoiceNumber(tx),
          status: 'sent',
          issuedAt: new Date(),
          dueAt: input.dueAt ?? null,
          totalCents: input.priceCents,
          items: {
            create: [
              {
                label: `${input.riderName} — ${input.eventTitle}`,
                quantity: 1,
                unitCents: input.priceCents,
                totalCents: input.priceCents,
                eventRegistrationId: input.registrationId,
              },
            ],
          },
        },
        select: INVOICE_SELECT,
      });
    });
  } catch (err) {
    if (err?.code === 'P2002') {
      const item = await prisma.invoiceItem.findUnique({
        where: { eventRegistrationId: input.registrationId },
        select: { invoice: { select: INVOICE_SELECT } },
      });
      return item?.invoice ?? null;
    }
    throw err;
  }

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
        `<p>Bonjour ${escapeHtml(invoice.family.user.firstName)},</p>`,
        `<p>La facture <strong>${escapeHtml(invoice.number)}</strong> est maintenant disponible dans votre espace Equime.</p>`,
        `<p>Montant : ${(invoice.totalCents / 100).toFixed(2)} €</p>`,
      ].join('\n'),
    },
  });
  return invoice;
}

export async function payInvoice(userId, invoiceId) {
  const current = await getInvoiceForClient(userId, invoiceId);
  if (current.status === 'paid') return current;
  if (current.status !== 'sent' && current.status !== 'overdue') {
    throw AppError.badRequest('Cette facture ne peut pas être payée');
  }

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
        `<p>Le paiement de la facture <strong>${escapeHtml(invoice.number)}</strong> a bien été enregistré.</p>`,
      ].join('\n'),
    },
  });
  return invoice;
}
