// @ts-check
/**
 * Droits aux séances (ADR 011) : forfait par cavalier, droit hebdomadaire,
 * crédits de rattrapage. Les fonctions prennent un client Prisma ou
 * transactionnel pour s'exécuter sous les verrous de l'inscription.
 */
import { ENROLLMENT_ENTITLEMENTS } from '@equime/shared';

import { AppError } from '../lib/appError.js';
import { prisma } from '../lib/prisma.js';
import { isoWeekRange } from '../lib/weeks.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const SUBSCRIPTION_PLAN_SELECT = { id: true, name: true, sessionsPerWeek: true };

/**
 * Choix du droit consommé par une inscription (logique pure).
 * @param {{ sessionsPerWeek: number | null, usedThisWeek: number, creditId: string | null }} input
 *   `sessionsPerWeek` null : pas de forfait couvrant la séance.
 * @returns {{ entitlement: 'subscription' } | { entitlement: 'makeup', creditId: string }
 *   | { refusal: 'no_subscription' | 'week_full' }}
 */
export function chooseEntitlement({ sessionsPerWeek, usedThisWeek, creditId }) {
  if (sessionsPerWeek !== null && usedThisWeek < sessionsPerWeek) {
    return { entitlement: ENROLLMENT_ENTITLEMENTS.SUBSCRIPTION };
  }
  if (creditId) return { entitlement: ENROLLMENT_ENTITLEMENTS.MAKEUP, creditId };
  return { refusal: sessionsPerWeek === null ? 'no_subscription' : 'week_full' };
}

/**
 * Date d'expiration d'un crédit : N jours après la séance annulée.
 * @param {Date} courseStartAt
 * @param {number} validityDays
 */
export function creditExpiry(courseStartAt, validityDays) {
  return new Date(courseStartAt.getTime() + validityDays * DAY_MS);
}

/**
 * Annulation « dans les délais » : au moins N heures avant le début de la séance.
 * @param {Date} courseStartAt
 * @param {number} deadlineHours
 * @param {Date} [now]
 */
export function isCancelledInTime(courseStartAt, deadlineHours, now = new Date()) {
  return courseStartAt.getTime() - now.getTime() >= deadlineHours * 60 * 60 * 1000;
}

/**
 * Limite d'annulation avec rattrapage pour une séance.
 * @param {Date} courseStartAt
 * @param {number} deadlineHours
 */
export function cancellationDeadline(courseStartAt, deadlineHours) {
  return new Date(courseStartAt.getTime() - deadlineHours * 60 * 60 * 1000);
}

/**
 * Forfait du cavalier qui couvre une date (saison en cours, forfait non arrêté avant).
 * @param {any} db
 * @param {string} riderId
 * @param {Date} at
 */
export function findCoveringSubscription(db, riderId, at) {
  return db.riderSubscription.findFirst({
    where: {
      riderId,
      seasonStart: { lte: at },
      seasonEnd: { gt: at },
      OR: [{ status: 'active' }, { endedAt: { gt: at } }],
    },
    select: { id: true, plan: { select: SUBSCRIPTION_PLAN_SELECT } },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Séances du forfait déjà prises sur la semaine ISO de `at`, quel que soit leur
 * état : une séance annulée à temps a été convertie en crédit, elle reste comptée.
 * @param {any} db
 * @param {string} riderId
 * @param {Date} at
 * @param {string} [excludeEnrollmentId]
 */
export function countWeekSubscriptionSessions(db, riderId, at, excludeEnrollmentId) {
  const week = isoWeekRange(at);
  return db.courseEnrollment.count({
    where: {
      riderId,
      entitlement: ENROLLMENT_ENTITLEMENTS.SUBSCRIPTION,
      ...(excludeEnrollmentId ? { id: { not: excludeEnrollmentId } } : {}),
      course: { startAt: { gte: week.start, lt: week.end } },
    },
  });
}

/**
 * Crédit de rattrapage encore valable à la date de la séance (le plus proche de
 * son expiration d'abord).
 * @param {any} db
 * @param {string} riderId
 * @param {Date} at
 */
export function findUsableCredit(db, riderId, at) {
  return db.sessionCredit.findFirst({
    where: { riderId, usedAt: null, expiresAt: { gt: at } },
    orderBy: { expiresAt: 'asc' },
    select: { id: true, expiresAt: true },
  });
}

/**
 * Droit à consommer pour inscrire un cavalier à une séance, ou erreur explicite.
 * @param {any} db
 * @param {{ rider: { id: string, firstName: string }, courseStartAt: Date,
 *   excludeEnrollmentId?: string }} input
 */
export async function resolveEntitlement(db, { rider, courseStartAt, excludeEnrollmentId }) {
  const [subscription, credit] = await Promise.all([
    findCoveringSubscription(db, rider.id, courseStartAt),
    findUsableCredit(db, rider.id, courseStartAt),
  ]);
  const usedThisWeek = subscription
    ? await countWeekSubscriptionSessions(db, rider.id, courseStartAt, excludeEnrollmentId)
    : 0;

  const decision = chooseEntitlement({
    sessionsPerWeek: subscription?.plan.sessionsPerWeek ?? null,
    usedThisWeek,
    creditId: credit?.id ?? null,
  });

  if ('refusal' in decision) {
    if (decision.refusal === 'no_subscription') {
      throw AppError.badRequest(
        `${rider.firstName} n'a pas de forfait pour cette saison. Choisissez un forfait depuis la page Famille.`
      );
    }
    const perWeek = subscription?.plan.sessionsPerWeek ?? 0;
    throw AppError.badRequest(
      `${rider.firstName} a déjà pris ${perWeek > 1 ? `ses ${perWeek} séances` : 'sa séance'} de la semaine et n'a pas de crédit de rattrapage.`
    );
  }
  return decision;
}

/**
 * Droits de chaque cavalier : forfait en cours ou à venir, séances prises cette
 * semaine, crédits de rattrapage disponibles.
 * @param {string[]} riderIds
 * @param {Date} [now]
 */
export async function getRidersEntitlements(riderIds, now = new Date()) {
  if (riderIds.length === 0) return [];
  const week = isoWeekRange(now);

  const [subscriptions, credits, weekSessions] = await Promise.all([
    prisma.riderSubscription.findMany({
      where: { riderId: { in: riderIds }, status: 'active', seasonEnd: { gt: now } },
      select: {
        id: true,
        riderId: true,
        seasonStart: true,
        seasonEnd: true,
        startsAt: true,
        paymentSchedule: true,
        priceCents: true,
        discountPercent: true,
        invoiceId: true,
        plan: { select: SUBSCRIPTION_PLAN_SELECT },
      },
      orderBy: { seasonStart: 'asc' },
    }),
    prisma.sessionCredit.findMany({
      where: { riderId: { in: riderIds }, usedAt: null, expiresAt: { gt: now } },
      select: { id: true, riderId: true, source: true, expiresAt: true },
      orderBy: { expiresAt: 'asc' },
    }),
    prisma.courseEnrollment.groupBy({
      by: ['riderId'],
      where: {
        riderId: { in: riderIds },
        entitlement: ENROLLMENT_ENTITLEMENTS.SUBSCRIPTION,
        course: { startAt: { gte: week.start, lt: week.end } },
      },
      _count: { _all: true },
    }),
  ]);

  return riderIds.map((riderId) => {
    const subscription = subscriptions.find((s) => s.riderId === riderId) ?? null;
    return {
      riderId,
      subscription,
      sessionsPerWeek: subscription?.plan.sessionsPerWeek ?? 0,
      usedThisWeek: weekSessions.find((w) => w.riderId === riderId)?._count._all ?? 0,
      credits: credits.filter((c) => c.riderId === riderId),
    };
  });
}
