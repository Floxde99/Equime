// @ts-check
/**
 * Utilitaires partagés par les tests d'intégration.
 */
import { hashPassword } from '../lib/passwords.js';
import { prisma } from '../lib/prisma.js';
import { isoWeekRange } from '../lib/weeks.js';
import { issueTokenPair } from '../services/tokenService.js';

export {
  refreshCookieOf,
  registerPayload,
  resetAuthTables,
  resetBillingTables,
  resetRateLimits,
} from './helpers.js';

/**
 * Vide les tables métier Phase 3 (ordre FK).
 */
export async function resetCoreTables() {
  await prisma.adminAuditLog.deleteMany();
  await prisma.sessionCredit.deleteMany();
  await prisma.riderSubscription.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.eventRegistration.deleteMany();
  await prisma.event.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.courseEnrollment.deleteMany();
  await prisma.course.deleteMany();
  await prisma.horseHealthLog.deleteMany();
  await prisma.horseAffinity.deleteMany();
  await prisma.horse.deleteMany();
  await prisma.space.deleteMany();
  await prisma.rider.deleteMany();
}

/**
 * @param {{ email?: string, role?: string, firstName?: string, lastName?: string }} [opts]
 */
export async function createUser(opts = {}) {
  const email = opts.email ?? `${opts.role ?? 'client'}@test.fr`;
  const passwordHash = await hashPassword('MotDePasse123');
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: opts.firstName ?? 'Test',
      lastName: opts.lastName ?? 'User',
      role: opts.role ?? 'client',
    },
  });

  if (user.role === 'client') {
    await prisma.family.create({ data: { userId: user.id } });
  }

  return user;
}

/**
 * @param {object} user
 * @returns {Promise<string>}
 */
export async function accessTokenFor(user) {
  const { accessToken } = await issueTokenPair(user);
  return accessToken;
}

/** @param {string} token */
export function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

/**
 * @param {string} userId
 */
export async function familyIdOf(userId) {
  const family = await prisma.family.findUniqueOrThrow({ where: { userId } });
  return family.id;
}

let loadSlotSeq = 0;

/**
 * Donne `hours` heures de charge à un cheval sur la semaine de `weekOf` (par défaut
 * la semaine en cours, ADR 010) : la charge étant dérivée, on crée une séance
 * terminée le lundi à 1 h (heure de Paris),
 * avec une inscription montée par ce cheval. Statut `completed` : la séance ne
 * compte pas dans les KPIs « cours à venir ».
 * @param {{ horseId: string, hours: number, familyId: string, instructorId: string,
 *   weekOf?: Date }} input
 */
export async function giveHorseLoad({
  horseId,
  hours,
  familyId,
  instructorId,
  weekOf = new Date(),
}) {
  loadSlotSeq += 1;
  const startAt = new Date(isoWeekRange(weekOf).start.getTime() + 60 * 60 * 1000);
  const endAt = new Date(startAt.getTime() + hours * 60 * 60 * 1000);
  const space = await prisma.space.create({
    data: { name: `Carrière charge ${loadSlotSeq}`, type: 'outdoor' },
  });
  const course = await prisma.course.create({
    data: {
      title: `Séance charge ${loadSlotSeq}`,
      instructorId,
      spaceId: space.id,
      startAt,
      endAt,
      capacity: 1,
      status: 'completed',
    },
  });
  const rider = await prisma.rider.create({
    data: {
      familyId,
      firstName: `Charge${loadSlotSeq}`,
      lastName: 'Test',
      birthdate: new Date('2010-01-01'),
    },
  });
  await prisma.courseEnrollment.create({
    data: { courseId: course.id, riderId: rider.id, horseId, horseAssignedAt: startAt },
  });
}

let planSeq = 0;

/**
 * Forfait actif couvrant les six mois passés et l'année à venir (ADR 011), sans
 * facture : ouvre le droit hebdomadaire d'un cavalier dans les tests.
 * @param {{ riderId: string, sessionsPerWeek?: number }} input
 */
export async function giveSubscription({ riderId, sessionsPerWeek = 2 }) {
  planSeq += 1;
  const plan = await prisma.subscriptionPlan.create({
    data: { name: `Forfait test ${planSeq}-${riderId}`, priceCents: 50_000, sessionsPerWeek },
  });
  const day = 24 * 60 * 60 * 1000;
  const seasonStart = new Date(Date.now() - 180 * day);
  return prisma.riderSubscription.create({
    data: {
      riderId,
      planId: plan.id,
      seasonStart,
      seasonEnd: new Date(Date.now() + 365 * day),
      startsAt: seasonStart,
      paymentSchedule: 'ten_installments',
      priceCents: plan.priceCents,
    },
  });
}
