// @ts-check
/**
 * Contrôleurs HTTP du module auth : orchestration requête/réponse uniquement,
 * la logique vit dans authService / tokenService.
 *
 * Transport des tokens :
 * - access token → corps de réponse JSON (gardé en mémoire côté front, jamais
 *   en localStorage — XSS) ;
 * - refresh token → cookie httpOnly `equime_refresh`, path restreint aux
 *   routes d'auth (il n'est jamais envoyé au reste de l'API).
 */
import { env, isProd } from '../config/env.js';
import { AppError } from '../lib/appError.js';
import * as authService from '../services/authService.js';
import { revokeSession, rotateRefreshToken } from '../services/tokenService.js';

export const REFRESH_COOKIE = 'equime_refresh';

const REFRESH_COOKIE_OPTIONS = Object.freeze({
  httpOnly: true,
  secure: isProd,
  sameSite: /** @type {const} */ ('strict'),
  path: '/api/v1/auth',
  maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
});

/**
 * @param {import('express').Response} res
 * @param {string} refreshToken
 */
function setRefreshCookie(res, refreshToken) {
  res.cookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTIONS);
}

/** @param {import('express').Request} req */
function requestContext(req) {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}

/** POST /api/v1/auth/register */
export async function register(req, res) {
  const { user, accessToken, refreshToken } = await authService.register(
    req.body,
    requestContext(req)
  );
  setRefreshCookie(res, refreshToken);
  res.status(201).json({ user, accessToken });
}

/** POST /api/v1/auth/login */
export async function login(req, res) {
  const { user, accessToken, refreshToken } = await authService.login(
    req.body,
    requestContext(req)
  );
  setRefreshCookie(res, refreshToken);
  res.json({ user, accessToken });
}

/** POST /api/v1/auth/refresh — rotation du refresh token */
export async function refresh(req, res) {
  const presented = req.cookies?.[REFRESH_COOKIE];
  if (!presented) throw AppError.unauthorized('Session absente');

  try {
    const { accessToken, refreshToken, user } = await rotateRefreshToken(presented);
    setRefreshCookie(res, refreshToken);
    const me = await authService.getMe(user.id);
    res.json({ user: me, accessToken });
  } catch (err) {
    // Session compromise ou expirée : le cookie ne sert plus à rien
    res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_OPTIONS.path });
    throw err;
  }
}

/** POST /api/v1/auth/logout — révoque famille de refresh + access courant */
export async function logout(req, res) {
  const user = /** @type {{ jti: string } | undefined} */ (req.user);
  await revokeSession(req.cookies?.[REFRESH_COOKIE], user?.jti);
  res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_OPTIONS.path });
  res.status(204).end();
}

/** GET /api/v1/auth/me */
export async function me(req, res) {
  const user = /** @type {{ id: string }} */ (req.user);
  res.json({ user: await authService.getMe(user.id) });
}

/** POST /api/v1/auth/forgot-password — réponse identique dans tous les cas */
export async function forgotPassword(req, res) {
  await authService.forgotPassword(req.body.email);
  res.json({
    message: 'Si un compte existe avec cette adresse, un email de réinitialisation a été envoyé.',
  });
}

/** POST /api/v1/auth/reset-password */
export async function resetPassword(req, res) {
  await authService.resetPassword(req.body);
  res.json({ message: 'Mot de passe mis à jour, vous pouvez vous connecter.' });
}

/** DELETE /api/v1/auth/me — suppression de compte RGPD (US-1.6) */
export async function deleteAccount(req, res) {
  const user = /** @type {{ id: string, jti: string }} */ (req.user);
  await authService.anonymizeAccount(user.id, user.jti);
  res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_OPTIONS.path });
  res.status(204).end();
}
