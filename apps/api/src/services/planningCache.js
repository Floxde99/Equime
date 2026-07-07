// @ts-check
/**
 * Cache Redis du planning (US-4.2 — réponse < 500 ms sur 8 semaines).
 * Invalidé à chaque mutation de cours.
 */
import { redis } from '../lib/redis.js';

const PREFIX = 'planning:';
const TTL_SEC = 300;

/**
 * @param {{ from: Date, to: Date, scope: string, instructorId?: string }} params
 */
function cacheKey({ from, to, scope, instructorId }) {
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const scopeKey = scope === 'mine' && instructorId ? `mine:${instructorId}` : 'all';
  return `${PREFIX}${fromIso}:${toIso}:${scopeKey}`;
}

/**
 * @param {object} params
 * @param {() => Promise<unknown>} loader
 */
export async function getPlanningCached(params, loader) {
  const key = cacheKey(params);
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const data = await loader();
  await redis.set(key, JSON.stringify(data), 'EX', TTL_SEC);
  return data;
}

/** Invalide tout le cache planning après création / modification / annulation de cours. */
export async function invalidatePlanningCache() {
  const keys = await redis.keys(`${PREFIX}*`);
  if (keys.length > 0) await redis.del(...keys);
}
