// @ts-check
/**
 * Forfaits de saison par cavalier (ADR 011) : devis, souscription avec facture
 * de saison et échéancier, arrêt d'un forfait.
 */
import { formatDate, NOTIFICATION_TYPES, PAYMENT_SCHEDULE_LABELS, ROLES } from '@equime/shared';

import { env } from '../config/env.js';
import { AppError } from '../lib/appError.js';
import { getFamilyIdForUser } from '../lib/family.js';
import { buildSimpleNotificationEmail } from '../lib/mailer.js';
import { prisma } from '../lib/prisma.js';
import {
  buildInstallments,
  proRataCents,
  scheduleDueDates,
  seasonAt,
  seasonLabel,
} from '../lib/seasons.js';

import { createIssuedInvoice, notifyInvoiceIssued } from './billingService.js';
import { dispatchNotification } from './notificationService.js';
import { applyBestDiscount } from './pricing.js';
import { getClubSettings } from './settingsService.js';

const SUBSCRIPTION_SELECT = {
  id: true,
  riderId: true,
  seasonStart: true,
  seasonEnd: true,
  startsAt: true,
  paymentSchedule: true,
  priceCents: true,
  discountPercent: true,
  status: true,
  endedAt: true,
  invoiceId: true,
  createdAt: true,
  plan: { select: { id: true, name: true, sessionsPerWeek: true } },
  rider: { select: { id: true, firstName: true, lastName: true, familyId: true } },
};

/**
 * Cavalier visible par l'acteur (admin : tous ; client : sa famille).
 * @param {{ id: string, role: string }} actor
 * @param {string} riderId
 */
async function findRider(actor, riderId) {
  const rider = await prisma.rider.findFirst({
    where: {
      id: riderId,
      ...(actor.role === ROLES.ADMIN ? {} : { familyId: await getFamilyIdForUser(actor.id) }),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      familyId: true,
      family: { select: { userId: true, user: { select: { firstName: true } } } },
    },
  });
  if (!rider) throw AppError.notFound('Cavalier introuvable');
  return rider;
}

/**
 * Devis d'un forfait : saison, prorata, réduction famille et échéances.
 * La réduction compte les cavaliers de la famille qui ont déjà un forfait actif
 * sur la même saison, celui-ci compris (on ne la gonfle plus avec des profils vides).
 *
 * @param {any} db
 * @param {{ rider: { id: string, familyId: string }, plan: { priceCents: number },
 *   paymentSchedule: 'quarterly' | 'ten_installments', now: Date }} input
 */
async function quote(db, { rider, plan, paymentSchedule, now }) {
  const settings = await getClubSettings(db);
  const season = seasonAt(now, settings);
  const startsAt = now > season.start ? now : season.start;
  const basePriceCents = settings.proRataOnLateJoin
    ? proRataCents(plan.priceCents, season, startsAt)
    : plan.priceCents;

  const [siblings, rules] = await Promise.all([
    db.riderSubscription.count({
      where: {
        rider: { familyId: rider.familyId },
        riderId: { not: rider.id },
        status: 'active',
        seasonStart: season.start,
      },
    }),
    db.discountRule.findMany({
      where: { active: true },
      select: { id: true, label: true, percentage: true, minRiders: true, active: true },
    }),
  ]);
  const pricing = applyBestDiscount({ basePriceCents, riderCount: siblings + 1, rules });
  const installments = buildInstallments({
    totalCents: pricing.finalPriceCents,
    dueDates: scheduleDueDates(paymentSchedule, season, settings),
    now,
  });

  return {
    season: { start: season.start, end: season.end, label: seasonLabel(season) },
    startsAt,
    paymentSchedule,
    planPriceCents: plan.priceCents,
    basePriceCents,
    prorated: basePriceCents !== plan.priceCents,
    discount: pricing.appliedRule
      ? {
          label: pricing.appliedRule.label,
          percentage: pricing.appliedRule.percentage,
          amountCents: pricing.discountCents,
        }
      : null,
    totalCents: pricing.finalPriceCents,
    installments,
  };
}

/**
 * @param {any} db
 * @param {string} planId
 */
async function findActivePlan(db, planId) {
  const plan = await db.subscriptionPlan.findUnique({
    where: { id: planId },
    select: { id: true, name: true, priceCents: true, sessionsPerWeek: true, active: true },
  });
  if (!plan || !plan.active) throw AppError.notFound('Forfait introuvable');
  return plan;
}

/**
 * @param {any} db
 * @param {string} riderId
 * @param {Date} seasonStart
 */
function findSeasonSubscription(db, riderId, seasonStart) {
  return db.riderSubscription.findFirst({
    where: { riderId, status: 'active', seasonStart },
    select: { id: true, plan: { select: { name: true } } },
  });
}

/**
 * Aperçu avant souscription (aucune écriture).
 * @param {{ id: string, role: string }} actor
 * @param {string} riderId
 * @param {{ planId: string, paymentSchedule: 'quarterly' | 'ten_installments' }} input
 */
export async function previewSubscription(actor, riderId, input) {
  const rider = await findRider(actor, riderId);
  const plan = await findActivePlan(prisma, input.planId);
  const result = await quote(prisma, {
    rider,
    plan,
    paymentSchedule: input.paymentSchedule,
    now: new Date(),
  });
  const existing = await findSeasonSubscription(prisma, rider.id, result.season.start);
  return { ...result, plan, alreadySubscribed: Boolean(existing) };
}

/**
 * Souscription d'un forfait de saison : facture émise (forfait et réduction
 * famille) et échéancier au trimestre ou en 10 fois.
 * @param {{ id: string, role: string }} actor
 * @param {string} riderId
 * @param {{ planId: string, paymentSchedule: 'quarterly' | 'ten_installments' }} input
 */
export async function subscribeRider(actor, riderId, input) {
  const rider = await findRider(actor, riderId);
  const now = new Date();

  const { subscription, invoice } = await prisma.$transaction(async (tx) => {
    // Verrou famille : deux souscriptions simultanées calculeraient la même réduction.
    await tx.$queryRaw`SELECT id FROM "families" WHERE id = ${rider.familyId} FOR UPDATE`;
    const plan = await findActivePlan(tx, input.planId);
    const result = await quote(tx, { rider, plan, paymentSchedule: input.paymentSchedule, now });

    const existing = await findSeasonSubscription(tx, rider.id, result.season.start);
    if (existing) {
      throw AppError.conflict(
        `${rider.firstName} a déjà le forfait « ${existing.plan.name} » pour la saison ${result.season.label}`
      );
    }

    const fromLabel = result.prorated ? ` (à partir du ${formatDate(result.startsAt)})` : '';
    const items = [
      {
        label: `Forfait ${plan.name} — ${rider.firstName} ${rider.lastName} — saison ${result.season.label}${fromLabel}`,
        quantity: 1,
        unitCents: result.basePriceCents,
        totalCents: result.basePriceCents,
      },
    ];
    if (result.discount && result.discount.amountCents > 0) {
      items.push({
        label: `Réduction ${result.discount.label} (${result.discount.percentage} %)`,
        quantity: 1,
        unitCents: -result.discount.amountCents,
        totalCents: -result.discount.amountCents,
      });
    }

    const createdInvoice = await createIssuedInvoice(tx, {
      familyId: rider.familyId,
      items,
      installments: result.installments,
    });
    const created = await tx.riderSubscription.create({
      data: {
        riderId: rider.id,
        planId: plan.id,
        seasonStart: result.season.start,
        seasonEnd: result.season.end,
        startsAt: result.startsAt,
        paymentSchedule: input.paymentSchedule,
        priceCents: result.basePriceCents,
        discountPercent: result.discount?.percentage ?? 0,
        invoiceId: createdInvoice.id,
      },
      select: SUBSCRIPTION_SELECT,
    });
    return { subscription: created, invoice: createdInvoice };
  });

  const scheduleLabel = PAYMENT_SCHEDULE_LABELS[input.paymentSchedule].toLowerCase();
  const body = `${rider.firstName} est inscrit(e) au forfait ${subscription.plan.name} (${subscription.plan.sessionsPerWeek} séance(s) par semaine), réglé ${scheduleLabel}.`;
  await dispatchNotification({
    userId: rider.family.userId,
    type: NOTIFICATION_TYPES.SUBSCRIPTION_CONFIRMED,
    title: 'Forfait enregistré',
    body,
    linkUrl: '/app/cavaliers',
    email: buildSimpleNotificationEmail({
      firstName: rider.family.user.firstName,
      subject: `Equime — Forfait ${subscription.plan.name} pour ${rider.firstName}`,
      paragraphs: [body, 'La facture et son échéancier sont disponibles dans votre espace.'],
      ctaUrl: `${env.APP_URL}/app/factures`,
      ctaLabel: 'Voir la facture',
    }),
  });
  await notifyInvoiceIssued(invoice);

  return { subscription, invoice };
}

/**
 * Arrêt d'un forfait par le secrétariat : plus de séance du forfait après
 * aujourd'hui. Le remboursement éventuel passe par un avoir manuel.
 * @param {string} subscriptionId
 */
export async function endSubscription(subscriptionId) {
  const { count } = await prisma.riderSubscription.updateMany({
    where: { id: subscriptionId, status: 'active' },
    data: { status: 'ended', endedAt: new Date() },
  });
  if (count === 0) {
    const exists = await prisma.riderSubscription.count({ where: { id: subscriptionId } });
    if (!exists) throw AppError.notFound('Forfait introuvable');
    throw AppError.conflict('Ce forfait est déjà arrêté');
  }
  return prisma.riderSubscription.findUniqueOrThrow({
    where: { id: subscriptionId },
    select: SUBSCRIPTION_SELECT,
  });
}
