// @ts-check
/**
 * Rate limiting par fenêtre fixe, adossé à Redis (INCR + EXPIRE atomiques),
 * donc partagé entre instances de l'API. Appliqué aux routes d'authentification
 * (OWASP A07 — protection force brute et credential stuffing).
 *
 * Fail-open : si Redis est indisponible, la requête passe (la disponibilité
 * du service prime, le risque est temporaire et loggé).
 */
import { AppError } from '../lib/appError.js';
import { logger } from '../lib/logger.js';
import { redis } from '../lib/redis.js';

/**
 * @param {object} options
 * @param {string} options.keyPrefix Espace de nommage de la limite (ex. `login`)
 * @param {number} options.max Nombre maximal de requêtes par fenêtre
 * @param {number} options.windowSec Durée de la fenêtre en secondes
 * @returns {import('express').RequestHandler}
 */
export function rateLimit({ keyPrefix, max, windowSec }) {
  return async (req, res, next) => {
    const key = `rl:${keyPrefix}:${req.ip}`;
    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSec);
      }
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(max - count, 0)));
      if (count > max) {
        const ttl = await redis.ttl(key);
        res.setHeader('Retry-After', String(Math.max(ttl, 1)));
        next(AppError.tooManyRequests());
        return;
      }
      next();
    } catch (err) {
      logger.warn({ err, key }, 'Rate limit indisponible (Redis down) — requête acceptée');
      next();
    }
  };
}
