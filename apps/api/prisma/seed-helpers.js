// @ts-check
/**
 * Helpers communs aux seeds dev et recette.
 * Autonomes vis-à-vis de l'API (ni services ni client Prisma de src/) : les seeds
 * s'exécutent hors de son cycle de vie. Seule exception, la logique pure des
 * saisons et échéanciers (src/lib/seasons.js), pour des dates identiques à l'API.
 */
import argon2 from 'argon2';

import { buildInstallments, scheduleDueDates, seasonAt, seasonLabel } from '../src/lib/seasons.js';

/**
 * Hash argon2id (mêmes paramètres que le service auth de la Phase 2).
 * @param {string} password
 * @returns {Promise<string>}
 */
export function hashPassword(password) {
  return argon2.hash(password, { type: argon2.argon2id });
}

/**
 * Prochain jour de semaine donné à une heure fixe (base des plannings de seed).
 * @param {number} weekday 0 = dimanche … 6 = samedi
 * @param {number} hour Heure locale
 * @param {Date} [from]
 * @returns {Date}
 */
export function nextWeekday(weekday, hour, from = new Date()) {
  const date = new Date(from);
  date.setHours(hour, 0, 0, 0);
  const diff = (weekday - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + diff);
  return date;
}

/**
 * Décale une date de n semaines.
 * @param {Date} date
 * @param {number} weeks
 * @returns {Date}
 */
export function addWeeks(date, weeks) {
  const result = new Date(date);
  result.setDate(result.getDate() + weeks * 7);
  return result;
}

/**
 * Décale une date de n minutes.
 * @param {Date} date
 * @param {number} minutes
 * @returns {Date}
 */
export function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000);
}

/**
 * Générateur pseudo-aléatoire déterministe (mulberry32) : le seed de recette
 * produit toujours le même jeu de données, condition d'un cahier de recette rejouable.
 * @param {number} seed
 * @returns {() => number} nombre dans [0, 1)
 */
export function createRng(seed) {
  let state = seed;
  return function rng() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Vide toutes les tables dans l'ordre inverse des dépendances FK.
 * @param {import('../generated/prisma/client.js').PrismaClient} prisma
 */
export async function resetDatabase(prisma) {
  await prisma.notification.deleteMany();
  await prisma.notificationPreference.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.volunteerSignup.deleteMany();
  await prisma.volunteerMission.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoiceInstallment.deleteMany();
  await prisma.sessionCredit.deleteMany();
  await prisma.riderSubscription.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.eventRegistration.deleteMany();
  await prisma.event.deleteMany();
  await prisma.courseEnrollment.deleteMany();
  await prisma.course.deleteMany();
  await prisma.horseHealthLog.deleteMany();
  await prisma.horseAffinity.deleteMany();
  await prisma.horse.deleteMany();
  await prisma.space.deleteMany();
  await prisma.rider.deleteMany();
  await prisma.family.deleteMany();
  await prisma.discountRule.deleteMany();
  await prisma.subscriptionPlan.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.newsletterSubscription.deleteMany();
  await prisma.user.deleteMany();
}

/** Paramètres de saison par défaut du club (ClubSettings). */
const DEFAULT_SEASON_SETTINGS = {
  seasonStart: '09-01',
  seasonEnd: '06-30',
  installmentDay: 5,
  quarterDueDates: ['09-05', '01-05', '04-05'],
};

/**
 * Forfait de saison d'un cavalier, souscrit en début de saison, avec sa facture
 * et son échéancier (ADR 011). Les `paidInstallments` premières échéances sont
 * réglées par chèque.
 *
 * @param {import('../generated/prisma/client.js').PrismaClient} prisma
 * @param {{ familyId: string, rider: { id: string, firstName: string, lastName: string },
 *   plan: { id: string, name: string, priceCents: number },
 *   paymentSchedule: 'quarterly' | 'ten_installments', number: string,
 *   discount?: { label: string, percentage: number }, paidInstallments?: number,
 *   overdue?: boolean, now?: Date }} input
 */
export async function createSeasonSubscription(prisma, input) {
  const now = input.now ?? new Date();
  const season = seasonAt(now, DEFAULT_SEASON_SETTINGS);
  const discountCents = input.discount
    ? Math.round((input.plan.priceCents * input.discount.percentage) / 100)
    : 0;
  const totalCents = input.plan.priceCents - discountCents;
  const installments = buildInstallments({
    totalCents,
    dueDates: scheduleDueDates(input.paymentSchedule, season, DEFAULT_SEASON_SETTINGS),
    now: new Date(season.start.getTime() - 1),
  });
  const paidCount = input.paidInstallments ?? 0;
  const paidAtOf = (/** @type {Date} */ dueAt) => (dueAt < now ? dueAt : now);
  const issuedAt = season.start < now ? season.start : now;

  const items = [
    {
      label: `Forfait ${input.plan.name} — ${input.rider.firstName} ${input.rider.lastName} — saison ${seasonLabel(season)}`,
      quantity: 1,
      unitCents: input.plan.priceCents,
      totalCents: input.plan.priceCents,
    },
  ];
  if (input.discount) {
    items.push({
      label: `Réduction ${input.discount.label} (${input.discount.percentage} %)`,
      quantity: 1,
      unitCents: -discountCents,
      totalCents: -discountCents,
    });
  }

  const invoice = await prisma.invoice.create({
    data: {
      familyId: input.familyId,
      number: input.number,
      status: input.overdue ? 'overdue' : 'sent',
      issuedAt,
      dueAt: installments[0].dueAt,
      totalCents,
      items: { create: items },
      installments: {
        create: installments.map((installment, index) => ({
          ...installment,
          paidAt: index < paidCount ? paidAtOf(installment.dueAt) : null,
        })),
      },
    },
    include: { installments: { orderBy: { sequence: 'asc' } } },
  });

  for (const installment of invoice.installments.slice(0, paidCount)) {
    await prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        installmentId: installment.id,
        method: 'cheque',
        amountCents: installment.amountCents,
        paidAt: paidAtOf(installment.dueAt),
        reference: `CHQ ${String(4_200_000 + installment.sequence)}`,
      },
    });
  }

  return prisma.riderSubscription.create({
    data: {
      riderId: input.rider.id,
      planId: input.plan.id,
      seasonStart: season.start,
      seasonEnd: season.end,
      startsAt: season.start,
      paymentSchedule: input.paymentSchedule,
      priceCents: input.plan.priceCents,
      discountPercent: input.discount?.percentage ?? 0,
      invoiceId: invoice.id,
    },
  });
}
