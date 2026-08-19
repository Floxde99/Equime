// @ts-check
/**
 * Rate limiting par fenêtre fixe, adossé à Redis (INCR + EXPIRE atomiques),
 * donc partagé entre instances de l'API. Appliqué aux routes d'authentification
 * (OWASP A07 — protection force brute et credential stuffing).
 *
 * Fail-closed sur les routes d'auth : Redis indisponible → 503.
 * Fail-open ailleurs (newsletter) : la disponibilité prime, le risque est
 * temporaire et loggé.
 */
import { AppError } from '../lib/appError.js';
import { logger } from '../lib/logger.js';
import { redis } from '../lib/redis.js';

/**
 * @param {object} options
 * @param {string} options.keyPrefix Espace de nommage de la limite (ex. `login`)
 * @param {number} options.max Nombre maximal de requêtes par fenêtre
 * @param {number} options.windowSec Durée de la fenêtre en secondes
 * @param {boolean} [options.failClosed] Si vrai, Redis down → 503 (routes d'auth)
 * @param {(req: import('express').Request) => string} [options.keyFrom]
 *        Identifiant de la clé (défaut : `req.ip`)
 * @returns {import('express').RequestHandler}
 */
export function rateLimit({ keyPrefix, max, windowSec, failClosed = false, keyFrom }) {
  return async (req, res, next) => {
    const identifier = keyFrom ? keyFrom(req) : req.ip;
    const key = `rl:${keyPrefix}:${identifier}`;
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
      if (failClosed) {
        logger.warn({ err, key }, 'Rate limit indisponible (Redis down) — requête refusée');
        next(AppError.serviceUnavailable());
        return;
      }
      logger.warn({ err, key }, 'Rate limit indisponible (Redis down) — requête acceptée');
      next();
    }
  };
}
