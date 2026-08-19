// @ts-check
/**
 * Service de gestion des tokens (cf. docs/uml/sequence-authentification.md et ADR 002).
 *
 * Modèle à deux tokens :
 * - Access token : JWT signé (HS256), courte durée (15 min), porté en header
 *   Authorization. Contient `sub` (userId), `role` et `jti` (identifiant unique
 *   permettant la révocation via blacklist Redis).
 * - Refresh token : chaîne aléatoire opaque (48 octets), longue durée (7 j),
 *   portée par un cookie httpOnly. Seul son hash SHA-256 est persisté.
 *
 * Rotation : chaque appel à /auth/refresh révoque le token présenté et en émet
 * un nouveau au sein de la même famille (`familyId`). Si un token déjà révoqué
 * est présenté (vol ou rejeu), toute la famille est révoquée et les access
 * tokens associés encore valides sont blacklistés.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';

import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';
import { AppError } from '../lib/appError.js';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

/** @typedef {{ sub: string, role: string, jti: string }} AccessPayload */

const ACCESS_TTL_SEC = env.ACCESS_TOKEN_TTL_MIN * 60;
const REFRESH_TTL_MS = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

// --- Fonctions pures (testées unitairement) ---

/**
 * Génère un refresh token opaque à forte entropie (384 bits).
 * @returns {string}
 */
export function generateRefreshToken() {
  return randomBytes(48).toString('base64url');
}

/**
 * Hash SHA-256 hexadécimal d'un token opaque.
 * (argon2 est inutile ici : l'entropie du token rend la force brute impossible ;
 * SHA-256 permet en revanche une recherche par index unique.)
 * @param {string} token
 * @returns {string}
 */
export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Signe un access token JWT.
 * @param {{ id: string, role: string }} user
 * @returns {{ token: string, jti: string }}
 */
export function signAccessToken(user) {
  const jti = randomUUID();
  const token = jwt.sign({ role: user.role }, env.JWT_ACCESS_SECRET, {
    subject: user.id,
    jwtid: jti,
    expiresIn: ACCESS_TTL_SEC,
    issuer: 'equime-api',
  });
  return { token, jti };
}

/**
 * Vérifie et décode un access token.
 * @param {string} token
 * @returns {AccessPayload} Payload si valide
 * @throws {jwt.JsonWebTokenError | jwt.TokenExpiredError} si invalide ou expiré
 */
export function verifyAccessToken(token) {
  const payload = /** @type {jwt.JwtPayload} */ (
    jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: 'equime-api', algorithms: ['HS256'] })
  );
  return { sub: String(payload.sub), role: String(payload.role), jti: String(payload.jti) };
}

// --- Blacklist Redis ---

/**
 * Blackliste un access token (par son jti) jusqu'à sa propre expiration.
 * @param {string} jti
 * @param {number} [ttlSec] Durée restante (défaut : durée de vie complète)
 */
export async function blacklistAccessToken(jti, ttlSec = ACCESS_TTL_SEC) {
  await redis.set(`blacklist:jti:${jti}`, '1', 'EX', Math.max(ttlSec, 1));
}

/**
 * Blackliste toutes les sessions d'un utilisateur (bannissement) pendant la
 * durée de vie maximale d'un access token : combiné à la révocation des
 * refresh tokens, l'éviction est effective immédiatement.
 * @param {string} userId
 */
export async function blacklistUser(userId) {
  await redis.set(`blacklist:user:${userId}`, '1', 'EX', ACCESS_TTL_SEC);
}

/**
 * Un access token est-il révoqué (logout, réutilisation, ban) ?
 * @param {AccessPayload} payload
 * @returns {Promise<boolean>}
 */
export async function isBlacklisted(payload) {
  const [byJti, byUser] = await redis.mget(
    `blacklist:jti:${payload.jti}`,
    `blacklist:user:${payload.sub}`
  );
  return byJti !== null || byUser !== null;
}

// --- Persistance des refresh tokens ---

/**
 * Émet une paire access + refresh pour un utilisateur, au sein d'une famille
 * (nouvelle famille au login, famille conservée lors d'une rotation).
 * @param {{ id: string, role: string }} user
 * @param {{ familyId?: string, userAgent?: string, ip?: string }} [context]
 * @returns {Promise<{ accessToken: string, refreshToken: string, familyId: string }>}
 */
export async function issueTokenPair(user, context = {}) {
  const familyId = context.familyId ?? randomUUID();
  const { token: accessToken, jti } = signAccessToken(user);
  const refreshToken = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      familyId,
      accessJti: jti,
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      userAgent: context.userAgent?.slice(0, 255) ?? null,
      ip: context.ip ?? null,
    },
  });

  return { accessToken, refreshToken, familyId };
}

/**
 * Révoque tous les refresh tokens actifs d'une famille et blackliste les
 * access tokens associés encore potentiellement valides.
 * @param {string} familyId
 */
export async function revokeFamily(familyId) {
  const active = await prisma.refreshToken.findMany({
    where: { familyId, revokedAt: null },
    select: { accessJti: true },
  });
  await prisma.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await Promise.all(
    active.filter((t) => t.accessJti).map((t) => blacklistAccessToken(String(t.accessJti)))
  );
}

/**
 * Révoque toutes les sessions d'un utilisateur (réinitialisation de mot de
 * passe, bannissement).
 * @param {string} userId
 */
export async function revokeAllUserTokens(userId) {
  const active = await prisma.refreshToken.findMany({
    where: { userId, revokedAt: null },
    select: { accessJti: true },
  });
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await Promise.all(
    active.filter((t) => t.accessJti).map((t) => blacklistAccessToken(String(t.accessJti)))
  );
}

/**
 * Rotation d'un refresh token (cf. diagramme de séquence).
 *
 * @param {string} presentedToken Token en clair reçu dans le cookie
 * @returns {Promise<{ accessToken: string, refreshToken: string, user: { id: string, role: string } }>}
 * @throws {import('../lib/appError.js').AppError} 401 si invalide, expiré, ou réutilisé
 */
export async function rotateRefreshToken(presentedToken) {
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(presentedToken) },
    include: { user: { select: { id: true, role: true, banned: true, anonymizedAt: true } } },
  });

  if (!stored) throw AppError.unauthorized('Session invalide');

  if (stored.revokedAt) {
    // Réutilisation détectée : un token déjà consommé est présenté à nouveau.
    // Vol probable → révocation de toute la famille (l'attaquant ET la victime
    // sont déconnectés, la victime se réauthentifie par mot de passe).
    await revokeFamily(stored.familyId);
    throw AppError.unauthorized('Session révoquée');
  }

  if (stored.expiresAt < new Date()) {
    throw AppError.unauthorized('Session expirée');
  }

  if (stored.user.banned) {
    await revokeFamily(stored.familyId);
    throw AppError.forbidden('Compte suspendu');
  }

  if (stored.user.anonymizedAt) {
    await revokeFamily(stored.familyId);
    throw AppError.forbidden('Ce compte a été supprimé');
  }

  // Rotation : l'ancien token est consommé, un nouveau prend sa place
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const pair = await issueTokenPair(stored.user, { familyId: stored.familyId });
  return { accessToken: pair.accessToken, refreshToken: pair.refreshToken, user: stored.user };
}

/**
 * Révoque la session courante (logout) : famille du refresh présenté + access courant.
 * @param {string | undefined} presentedToken Refresh token du cookie (peut être absent)
 * @param {string | undefined} accessJti jti de l'access token courant
 */
export async function revokeSession(presentedToken, accessJti) {
  if (presentedToken) {
    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(presentedToken) },
      select: { familyId: true },
    });
    if (stored) await revokeFamily(stored.familyId);
  }
  if (accessJti) await blacklistAccessToken(accessJti);
}

/**
 * Purge les refresh tokens expirés ou révoqués depuis plus de 30 jours (minimisation RGPD).
 * @returns {Promise<number>} Nombre de lignes supprimées
 */
export async function purgeExpiredRefreshTokens() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const result = await prisma.refreshToken.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { lt: cutoff } }],
    },
  });
  return result.count;
}
