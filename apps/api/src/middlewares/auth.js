// @ts-check
/**
 * Middlewares d'authentification et d'autorisation.
 *
 * requireAuth : vérifie l'access token (signature, expiration) puis la
 * blacklist Redis (logout, réutilisation détectée, bannissement).
 * requireRole : contrôle d'accès par rôle, à placer APRÈS requireAuth.
 */
import jwt from 'jsonwebtoken';

import { AppError } from '../lib/appError.js';
import { isBlacklisted, verifyAccessToken } from '../services/tokenService.js';

/**
 * @typedef {{ id: string, role: string, jti: string }} AuthUser
 */

/** @type {import('express').RequestHandler} */
export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw AppError.unauthorized();
    }

    let payload;
    try {
      payload = verifyAccessToken(header.slice('Bearer '.length));
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        // Code dédié : le front déclenche un refresh silencieux sur TOKEN_EXPIRED
        throw new AppError('Session expirée', { statusCode: 401, code: 'TOKEN_EXPIRED' });
      }
      throw AppError.unauthorized();
    }

    if (await isBlacklisted(payload)) {
      throw AppError.unauthorized('Session révoquée');
    }

    req.user = /** @type {AuthUser} */ ({ id: payload.sub, role: payload.role, jti: payload.jti });
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * @param {...string} roles Rôles autorisés (ex. `requireRole(ROLES.ADMIN)`)
 * @returns {import('express').RequestHandler}
 */
export function requireRole(...roles) {
  return (req, _res, next) => {
    const user = /** @type {AuthUser | undefined} */ (req.user);
    if (!user) {
      next(AppError.unauthorized());
      return;
    }
    if (!roles.includes(user.role)) {
      next(AppError.forbidden());
      return;
    }
    next();
  };
}
