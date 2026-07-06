// @ts-check
/**
 * Utilitaires partagés par les tests d'intégration auth.
 */
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

/**
 * Vide les tables touchées par les tests auth (ordre FK).
 */
export async function resetAuthTables() {
  await prisma.passwordResetToken.deleteMany();
  await prisma.refreshToken.deleteMany();
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
