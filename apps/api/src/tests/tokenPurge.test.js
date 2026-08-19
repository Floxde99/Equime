/**
 * Purge RGPD des refresh tokens expirés (minimisation — tokenService.purgeExpiredRefreshTokens).
 * Le job quotidien est planifié au boot dans `src/index.js` (intervalle + unref).
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { hashPassword } from '../lib/passwords.js';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { hashToken, purgeExpiredRefreshTokens } from '../services/tokenService.js';

import { resetAuthTables } from './helpers.js';

beforeEach(async () => {
  await resetAuthTables();
});

afterAll(async () => {
  await resetAuthTables();
  await prisma.$disconnect();
  redis.disconnect();
});

describe('purgeExpiredRefreshTokens', () => {
  it('supprime un refresh token expiré inséré en base', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'purge-token@test.fr',
        passwordHash: await hashPassword('MotDePasse123'),
        firstName: 'Purge',
        lastName: 'Token',
        role: 'client',
      },
    });

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken('expired-refresh-token-for-purge'),
        familyId: 'family-purge-test',
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    const count = await purgeExpiredRefreshTokens();
    expect(count).toBeGreaterThan(0);

    const remaining = await prisma.refreshToken.count({ where: { userId: user.id } });
    expect(remaining).toBe(0);
  });
});
