/**
 * Supprime les compteurs Redis de rate limiting avant les tests E2E.
 * Les tests d'intégration auth (notamment T-1.11) peuvent saturer la fenêtre
 * login sur l'instance Redis de dev partagée.
 */
import { Redis } from 'ioredis';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

const client = new Redis(redisUrl, { maxRetriesPerRequest: 1 });

try {
  const keys = await client.keys('rl:*');
  if (keys.length > 0) {
    await client.del(...keys);
    console.log(`Rate limits E2E réinitialisés (${keys.length} clé(s)).`);
  }
} finally {
  await client.quit();
}
