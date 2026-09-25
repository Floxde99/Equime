// @ts-check
/**
 * Utilitaires partagés par les tests d'intégration auth.
 */
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

/**
 * Vide la facturation (ordre FK) : règlements, échéances, forfaits, crédits, factures.
 */
export async function resetBillingTables() {
  await prisma.payment.deleteMany();
  await prisma.invoiceInstallment.deleteMany();
  await prisma.sessionCredit.deleteMany();
  await prisma.riderSubscription.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
}

/**
 * Vide les tables touchées par les tests auth (ordre FK).
 */
export async function resetAuthTables() {
  await prisma.adminAuditLog.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.refreshToken.deleteMany();
  await resetBillingTables();
  await prisma.message.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.horseHealthLog.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.volunteerSignup.deleteMany();
  await prisma.notificationPreference.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.rider.deleteMany();
  await prisma.family.deleteMany();
  await prisma.user.deleteMany();
}

/**
 * Supprime les compteurs de rate limiting (les tests enchaînent plus de
 * requêtes qu'un humain — seul le test dédié vérifie la limite).
 */
export async function resetRateLimits() {
  const keys = await redis.keys('rl:*');
  if (keys.length > 0) await redis.del(...keys);
}

/**
 * Extrait le cookie refresh d'une réponse Supertest.
 * @param {import('supertest').Response} res
 * @returns {string | undefined} `equime_refresh=<valeur>` prêt à renvoyer
 */
export function refreshCookieOf(res) {
  const cookies = /** @type {string[] | undefined} */ (res.headers['set-cookie']);
  const cookie = cookies?.find((c) => c.startsWith('equime_refresh='));
  return cookie?.split(';')[0];
}

/** Corps d'inscription valide, email paramétrable. */
export function registerPayload(email = 'client@test.fr') {
  return {
    email,
    password: 'MotDePasse123',
    firstName: 'Jean',
    lastName: 'Test',
  };
}
