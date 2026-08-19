// @ts-check
import { Redis } from 'ioredis';

import { env } from '../config/env.js';

import { logger } from './logger.js';

/**
 * Client Redis partagé (blacklist de tokens et cache planning dans les phases suivantes).
 * `lazyConnect` : la connexion n'est ouverte qu'au premier usage, ce qui permet
 * aux tests de tourner sans instance Redis.
 */
export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  retryStrategy(times) {
    if (times > 10) return null; // abandonne après ~10 s, évite les reconnexions infinies
    return Math.min(times * 1000, 2000);
  },
});

redis.on('error', (err) => {
  logger.warn({ err: err.message }, 'Connexion Redis indisponible');
});

/**
 * Vérifie la disponibilité de Redis sans bloquer la réponse.
 * @param {number} [timeoutMs] Délai maximal avant de considérer Redis indisponible
 * @returns {Promise<boolean>}
 */
export async function pingRedis(timeoutMs = 500) {
  try {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('redis ping timeout')), timeoutMs)
    );
    const result = await Promise.race([redis.ping(), timeout]);
    return result === 'PONG';
  } catch {
    return false;
  }
}
