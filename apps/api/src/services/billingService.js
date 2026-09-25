// @ts-check
/**
 * Facturation (EPIC 6) : factures, échéanciers et règlements (ADR 011).
 */
import { formatEuroCents, NOTIFICATION_TYPES, PAYMENT_METHODS } from '@equime/shared';

import { env, isSimulatedPaymentAllowed } from '../config/env.js';
import { AppError } from '../lib/appError.js';
import { buildInvoicePdf, invoicePdfFilename } from '../lib/invoicePdf.js';
import { logger } from '../lib/logger.js';
import { escapeHtml } from '../lib/mailer.js';
import { prisma } from '../lib/prisma.js';

import { dispatchNotification } from './notificationService.js';

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
  installments: {
    select: { id: true, sequence: true, dueAt: true, amountCents: true, paidAt: true },
    orderBy: { sequence: 'asc' },
  },
  payments: {
    select: { id: true, method: true, amountCents: true, paidAt: true, reference: true },
    orderBy: { paidAt: 'asc' },
  },
  riderSubscription: {
    select: {
      id: true,
      paymentSchedule: true,
      rider: { select: { id: true, firstName: true, lastName: true } },
      plan: { select: { id: true, name: true } },
    },
  },
};

/** Délai de paiement par défaut d'une facture libre. */
const DEFAULT_PAYMENT_DAYS = 30;

/**
 * Échéance suivante et reste dû, déduits des règlements couvrant les échéances
 * dans l'ordre (logique pure).
 * @param {{ totalCents: number, installments: Array<{ id: string, sequence: number,
 *   dueAt: Date, amountCents: number }>, payments: Array<{ amountCents: number }> }} invoice
 */
export function summarizeInvoicePayments(invoice) {
  const paidCents = invoice.payments.reduce((sum, p) => sum + p.amountCents, 0);
  const remainingCents = Math.max(0, invoice.totalCents - paidCents);
  let cumulative = 0;
  /** @type {{ id: string, sequence: number, dueAt: Date, amountCents: number } | null} */
  let nextInstallment = null;
  for (const installment of invoice.installments) {
    cumulative += installment.amountCents;
    if (cumulative > paidCents) {
      nextInstallment = {
        id: installment.id,
        sequence: installment.sequence,
        dueAt: installment.dueAt,
        amountCents: Math.min(installment.amountCents, cumulative - paidCents),
      };
      break;
    }
  }
  return { paidCents, remainingCents, nextInstallment };
}

/**
 * @template {{ totalCents: number, installments: any[], payments: any[] }} T
 * @param {T} invoice
 */
function withPaymentSummary(invoice) {
  return { ...invoice, ...summarizeInvoicePayments(invoice) };
}

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
  const subscriptions = await prisma.riderSubscription.count({ where: { planId } });
  if (subscriptions > 0) {
    throw AppError.conflict(
      'Ce forfait a déjà été souscrit : archivez-le plutôt que de le supprimer'
    );
  }
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

/** @param {any} tx */
export async function nextInvoiceNumber(tx) {
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

/**
 * Facture libre (brouillon) : lignes saisies, une seule échéance.
 * Les forfaits de saison sont facturés à la souscription (subscriptionService).
 * @param {{ familyId: string, dueAt?: Date, items: Array<{ label: string, quantity: number, unitCents: number }> }} input
 */
export async function createInvoice(input) {
  const family = await prisma.family.findUnique({ where: { id: input.familyId } });
  if (!family) throw AppError.notFound('Famille introuvable');

  const items = input.items.map((item) => ({
    label: item.label,
    quantity: item.quantity,
    unitCents: item.unitCents,
    totalCents: item.quantity * item.unitCents,
  }));
  const totalCents = Math.max(
    0,
    items.reduce((sum, item) => sum + item.totalCents, 0)
  );
  const dueAt = input.dueAt ?? new Date(Date.now() + DEFAULT_PAYMENT_DAYS * 24 * 60 * 60 * 1000);

  const invoice = await prisma.$transaction(async (tx) =>
    tx.invoice.create({
      data: {
        familyId: input.familyId,
        number: await nextInvoiceNumber(tx),
        dueAt,
        totalCents,
        items: { create: items },
        installments: { create: [{ sequence: 1, dueAt, amountCents: totalCents }] },
      },
      select: INVOICE_SELECT,
    })
  );
  return withPaymentSummary(invoice);
}

/**
 * Facture émise (statut « envoyée ») avec son échéancier, dans une transaction.
 * @param {any} tx
 * @param {{ familyId: string, items: Array<{ label: string, quantity: number, unitCents: number,
 *   totalCents: number, eventRegistrationId?: string }>,
 *   installments: Array<{ sequence: number, dueAt: Date, amountCents: number }> }} input
 */
export async function createIssuedInvoice(tx, input) {
  const totalCents = input.installments.reduce((sum, i) => sum + i.amountCents, 0);
  const now = new Date();
  // Montant nul (réduction de 100 %) : rien à régler, la facture est soldée d'emblée.
  const settled = totalCents === 0;
  return tx.invoice.create({
    data: {
      familyId: input.familyId,
      number: await nextInvoiceNumber(tx),
      status: settled ? 'paid' : 'sent',
      issuedAt: now,
      paidAt: settled ? now : null,
      dueAt: input.installments[0].dueAt,
      totalCents,
      items: { create: input.items },
      installments: {
        create: input.installments.map((i) => ({ ...i, paidAt: settled ? now : null })),
      },
    },
    select: INVOICE_SELECT,
  });
}

/**
 * Notification « nouvelle facture » (in-app et e-mail).
 * @param {{ number: string, totalCents: number, installments: Array<unknown>,
 *   family: { userId: string, user: { firstName: string } } }} invoice
 */
export function notifyInvoiceIssued(invoice) {
  const amount = formatEuroCents(invoice.totalCents);
  const schedule =
    invoice.installments.length > 1 ? ` Payable en ${invoice.installments.length} échéances.` : '';
  return dispatchNotification({
    userId: invoice.family.userId,
    type: NOTIFICATION_TYPES.INVOICE_CREATED,
    title: 'Nouvelle facture disponible',
    body: `La facture ${invoice.number} de ${amount} est disponible.${schedule}`,
    linkUrl: '/app/factures',
    email: {
      subject: `Equime — Facture ${invoice.number} disponible`,
      text: [
        `Bonjour ${invoice.family.user.firstName},`,
        '',
        `La facture ${invoice.number} est maintenant disponible dans votre espace Equime.`,
        `Montant : ${amount}.${schedule}`,
      ].join('\n'),
      html: [
        `<p>Bonjour ${escapeHtml(invoice.family.user.firstName)},</p>`,
        `<p>La facture <strong>${escapeHtml(invoice.number)}</strong> est maintenant disponible dans votre espace Equime.</p>`,
        `<p>Montant : ${escapeHtml(amount)}.${escapeHtml(schedule)}</p>`,
      ].join('\n'),
    },
  });
}

/**
 * Liste admin : tous les statuts, y compris les brouillons (non envoyés).
 * @returns {Promise<object[]>}
 */
export async function listAdminInvoices() {
  const invoices = await prisma.invoice.findMany({
    select: INVOICE_SELECT,
    orderBy: [{ createdAt: 'desc' }],
  });
  return invoices.map(withPaymentSummary);
}

/** Statuts visibles côté client — les brouillons restent internes à l'admin. */
const CLIENT_INVOICE_STATUSES = ['sent', 'paid', 'overdue'];

export async function listFamilyInvoices(userId) {
  const family = await prisma.family.findUnique({ where: { userId } });
  if (!family) return [];
  const invoices = await prisma.invoice.findMany({
    where: { familyId: family.id, status: { in: CLIENT_INVOICE_STATUSES } },
    select: INVOICE_SELECT,
    orderBy: [{ createdAt: 'desc' }],
  });
  return invoices.map(withPaymentSummary);
}

async function getInvoiceOrThrow(invoiceId) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: INVOICE_SELECT,
  });
  if (!invoice) throw AppError.notFound('Facture introuvable');
  return withPaymentSummary(invoice);
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
  return withPaymentSummary(invoice);
}

/**
 * Facture d'une famille pour le client connecté (isolation famille).
 * @param {string} userId
 * @param {string} invoiceId
 */
export async function getClientInvoice(userId, invoiceId) {
  return getInvoiceForClient(userId, invoiceId);
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

  await notifyInvoiceIssued(invoice);
  return withPaymentSummary(invoice);
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
  return withPaymentSummary(invoice);
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

/**
 * Forfaits actifs pour la vitrine et la page Famille (Excel 1.2 / 8.2).
 * `priceCents` est le prix de la saison (ADR 011).
 */
export function listActivePublicPlans() {
  return prisma.subscriptionPlan.findMany({
    where: { active: true },
    select: PUBLIC_PLAN_SELECT,
    orderBy: { priceCents: 'asc' },
  });
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

  /** @type {any} */
  let invoice = null;
  try {
    invoice = await prisma.$transaction(async (tx) =>
      createIssuedInvoice(tx, {
        familyId: input.familyId,
        items: [
          {
            label: `${input.riderName} — ${input.eventTitle}`,
            quantity: 1,
            unitCents: input.priceCents,
            totalCents: input.priceCents,
            eventRegistrationId: input.registrationId,
          },
        ],
        installments: [
          { sequence: 1, dueAt: input.dueAt ?? new Date(), amountCents: input.priceCents },
        ],
      })
    );
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

  await notifyInvoiceIssued(invoice);
  return invoice;
}

/**
 * Enregistre un règlement (ADR 011) : les règlements couvrent les échéances dans
 * l'ordre ; la facture passe « payée » quand ils couvrent son total.
 *
 * - Règlement saisi au club : refusé s'il dépasse le reste dû.
 * - Paiement Stripe : l'argent est déjà encaissé, il est toujours enregistré
 *   (un trop-perçu est tracé pour remboursement). Idempotent par PaymentIntent :
 *   webhook et confirmation de retour peuvent arriver ensemble.
 *
 * @param {{ invoiceId: string, method: string, amountCents: number, paidAt?: Date,
 *   reference?: string, stripePaymentIntentId?: string | null, installmentId?: string | null,
 *   recordedById?: string | null }} input
 * @returns {Promise<{ invoice: object, recorded: boolean }>}
 */
export async function recordPayment(input) {
  const isStripe = Boolean(input.stripePaymentIntentId);
  /** @type {{ fullyPaid: boolean, remainingCents: number } | null} */
  let outcome = null;
  try {
    outcome = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "invoices" WHERE id = ${input.invoiceId} FOR UPDATE`;
      if (isStripe) {
        const known = await tx.payment.findUnique({
          where: { stripePaymentIntentId: /** @type {string} */ (input.stripePaymentIntentId) },
          select: { id: true },
        });
        if (known) return null;
      }
      const invoice = await tx.invoice.findUnique({
        where: { id: input.invoiceId },
        select: {
          status: true,
          totalCents: true,
          installments: {
            select: { id: true, amountCents: true, paidAt: true },
            orderBy: { sequence: 'asc' },
          },
          payments: { select: { amountCents: true } },
        },
      });
      if (!invoice) throw AppError.notFound('Facture introuvable');

      const payable = invoice.status === 'sent' || invoice.status === 'overdue';
      const paidBefore = invoice.payments.reduce((sum, p) => sum + p.amountCents, 0);
      const remainingBefore = invoice.totalCents - paidBefore;
      if (!isStripe) {
        if (!payable) throw AppError.badRequest('Cette facture ne peut pas recevoir de règlement');
        if (input.amountCents > remainingBefore) {
          throw AppError.badRequest(
            `Le règlement dépasse le reste dû (${formatEuroCents(remainingBefore)})`
          );
        }
      } else if (!payable || input.amountCents > remainingBefore) {
        logger.error(
          { invoiceId: input.invoiceId, paymentIntentId: input.stripePaymentIntentId },
          'Paiement Stripe au-delà du reste dû : trop-perçu à rembourser'
        );
      }

      const paidAt = input.paidAt ?? new Date();
      await tx.payment.create({
        data: {
          invoiceId: input.invoiceId,
          installmentId: input.installmentId ?? null,
          method: input.method,
          amountCents: input.amountCents,
          paidAt,
          reference: input.reference ?? null,
          stripePaymentIntentId: input.stripePaymentIntentId ?? null,
          recordedById: input.recordedById ?? null,
        },
      });

      const paidTotal = paidBefore + input.amountCents;
      let cumulative = 0;
      for (const installment of invoice.installments) {
        cumulative += installment.amountCents;
        if (!installment.paidAt && cumulative <= paidTotal) {
          await tx.invoiceInstallment.update({
            where: { id: installment.id },
            data: { paidAt },
          });
        }
      }

      const fullyPaid = payable && paidTotal >= invoice.totalCents;
      if (fullyPaid) {
        await tx.invoice.update({
          where: { id: input.invoiceId },
          data: { status: 'paid', paidAt },
        });
      }
      return { fullyPaid, remainingCents: Math.max(0, invoice.totalCents - paidTotal) };
    });
  } catch (err) {
    // Même PaymentIntent déjà enregistré (webhook et retour de paiement simultanés).
    if (isStripe && /** @type {{ code?: string }} */ (err)?.code === 'P2002') {
      return { invoice: await getInvoiceOrThrow(input.invoiceId), recorded: false };
    }
    throw err;
  }

  const invoice = await getInvoiceOrThrow(input.invoiceId);
  if (!outcome) return { invoice, recorded: false };
  const amount = formatEuroCents(input.amountCents);
  const body = outcome.fullyPaid
    ? `Règlement de ${amount} reçu : la facture ${invoice.number} est soldée.`
    : `Règlement de ${amount} reçu pour la facture ${invoice.number}. Reste dû : ${formatEuroCents(outcome.remainingCents)}.`;
  await dispatchNotification({
    userId: invoice.family.userId,
    type: NOTIFICATION_TYPES.PAYMENT_CONFIRMED,
    title: 'Paiement confirmé',
    body,
    linkUrl: '/app/factures',
    email: {
      subject: `Equime — Paiement reçu (${invoice.number})`,
      text: ['Bonjour,', '', body].join('\n'),
      html: ['<p>Bonjour,</p>', `<p>${escapeHtml(body)}</p>`].join('\n'),
    },
  });
  return { invoice, recorded: true };
}

/**
 * Règlement saisi par le secrétariat (espèces, chèque, ANCV, Pass'Sport…).
 * @param {string} invoiceId
 * @param {{ method: string, amountCents: number, paidAt?: Date, reference?: string }} input
 * @param {string} adminId
 */
export async function recordOfflinePayment(invoiceId, input, adminId) {
  if (input.method === PAYMENT_METHODS.CARD_ONLINE) {
    throw AppError.badRequest('Les paiements en ligne sont enregistrés automatiquement');
  }
  const { invoice } = await recordPayment({ ...input, invoiceId, recordedById: adminId });
  return invoice;
}

/**
 * Paiement simulé de l'échéance suivante (dev/test sans Stripe uniquement).
 * @param {string} userId
 * @param {string} invoiceId
 */
export async function payInvoice(userId, invoiceId) {
  if (!isSimulatedPaymentAllowed()) {
    throw AppError.gone(
      'Le paiement simulé n’est plus disponible. Utilisez le paiement sécurisé Stripe.'
    );
  }

  const current = await getInvoiceForClient(userId, invoiceId);
  if (current.status === 'paid') return current;
  if (current.status !== 'sent' && current.status !== 'overdue') {
    throw AppError.badRequest('Cette facture ne peut pas être payée');
  }
  if (!current.nextInstallment) return current;

  const { invoice } = await recordPayment({
    invoiceId,
    installmentId: current.nextInstallment.id,
    method: PAYMENT_METHODS.OTHER,
    amountCents: current.nextInstallment.amountCents,
    reference: 'Paiement simulé',
  });
  return invoice;
}
