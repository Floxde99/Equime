// @ts-check
/**
 * Utilitaires partagés par les tests d'intégration.
 */
import { hashPassword } from '../lib/passwords.js';
import { prisma } from '../lib/prisma.js';
import { issueTokenPair } from '../services/tokenService.js';

export { refreshCookieOf, registerPayload, resetAuthTables, resetRateLimits } from './helpers.js';

/**
 * Vide les tables métier Phase 3 (ordre FK).
 */
export async function resetCoreTables() {
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
    await prisma.family.create({
      data: { userId: user.id, sessionQuota: 10 },
    });
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
