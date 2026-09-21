// @ts-check
/**
 * Cache Redis du planning (US-4.2 — réponse < 500 ms sur 8 semaines).
 * Invalidé à chaque mutation de cours.
 *
 * Clé isolée par fenêtre + scope : `all` partagé ; `mine` toujours segmenté
 * par utilisateur (client) ou moniteur — jamais fusionné vers `all`.
 */
import { redis } from '../lib/redis.js';

const PREFIX = 'planning:';
const TTL_SEC = 300;

/**
 * Construit la clé Redis du planning.
 * @param {{ from: Date, to: Date, scope: string, userId?: string, instructorId?: string }} params
 * @returns {string}
 */
export function buildPlanningCacheKey({ from, to, scope, userId, instructorId }) {
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  if (scope === 'mine') {
    const id = instructorId ?? userId ?? 'unknown';
    return `${PREFIX}${fromIso}:${toIso}:mine:${id}`;
  }
  return `${PREFIX}${fromIso}:${toIso}:all`;
}

/**
 * @param {{ from: Date, to: Date, scope: string, userId?: string, instructorId?: string }} params
 * @param {() => Promise<unknown>} loader
 */
export async function getPlanningCached(params, loader) {
  const key = buildPlanningCacheKey(params);
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
