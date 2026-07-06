// @ts-check
/**
 * Service d'authentification : inscription, connexion, mot de passe oublié.
 * La gestion fine des tokens (rotation, révocation) vit dans tokenService.
 */
import { randomBytes } from 'node:crypto';

import { ROLES } from '@equime/shared';

import { env } from '../config/env.js';
import { AppError } from '../lib/appError.js';
import { sendPasswordResetEmail } from '../lib/mailer.js';
import { hashPassword, verifyPassword } from '../lib/passwords.js';
import { prisma } from '../lib/prisma.js';

import { blacklistUser, hashToken, issueTokenPair, revokeAllUserTokens } from './tokenService.js';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 h

/** Champs de l'utilisateur exposables au client (jamais le hash). */
const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  createdAt: true,
};

/**
 * @typedef {{ id: string, email: string, firstName: string, lastName: string,
 *   phone: string | null, role: string, createdAt: Date }} PublicUser
 */

/**
 * Inscription d'un client : crée le compte ET sa famille dans une transaction
 * (US-1.1 — un client sans famille ne peut rien faire dans l'application).
 * Le rôle est TOUJOURS `client` : moniteurs et admins sont créés par un admin.
 *
 * @param {{ email: string, password: string, firstName: string, lastName: string, phone?: string }} input
 * @param {{ userAgent?: string, ip?: string }} [context]
 * @returns {Promise<{ user: PublicUser, accessToken: string, refreshToken: string }>}
 */
export async function register(input, context) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw AppError.conflict('Un compte existe déjà avec cette adresse email');

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone ?? null,
        role: ROLES.CLIENT,
      },
      select: PUBLIC_USER_SELECT,
    });
    await tx.family.create({ data: { userId: created.id } });
    return created;
  });

  const { accessToken, refreshToken } = await issueTokenPair(user, context);
  return { user, accessToken, refreshToken };
}

/**
 * Connexion : message d'erreur identique que l'email soit inconnu ou le mot de
 * passe faux (pas d'énumération de comptes — OWASP A07).
 *
 * @param {{ email: string, password: string }} input
 * @param {{ userAgent?: string, ip?: string }} [context]
 * @returns {Promise<{ user: PublicUser, accessToken: string, refreshToken: string }>}
 */
export async function login(input, context) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  const validPassword = user ? await verifyPassword(user.passwordHash, input.password) : false;
  if (!user || !validPassword) {
    throw AppError.unauthorized('Email ou mot de passe incorrect');
  }
  if (user.banned) {
    throw AppError.forbidden('Compte suspendu — contactez le centre équestre');
  }

  const { accessToken, refreshToken } = await issueTokenPair(user, context);
  const { passwordHash: _hash, ...safe } = user;
  return {
    user: /** @type {PublicUser} */ ({
      id: safe.id,
      email: safe.email,
      firstName: safe.firstName,
      lastName: safe.lastName,
      phone: safe.phone,
      role: safe.role,
      createdAt: safe.createdAt,
    }),
    accessToken,
    refreshToken,
  };
}

/**
 * Profil de l'utilisateur courant.
 * @param {string} userId
 * @returns {Promise<PublicUser>}
 */
export async function getMe(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: PUBLIC_USER_SELECT,
  });
  if (!user) throw AppError.unauthorized();
  return user;
}

/**
 * Demande de réinitialisation : répond TOUJOURS pareil, que l'email existe ou
 * non (pas d'énumération). Le token en clair ne part que dans l'email.
 * @param {string} email
 */
export async function forgotPassword(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.banned) return; // réponse identique côté HTTP

  const token = randomBytes(32).toString('base64url');
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  const resetUrl = `${env.APP_URL}/reinitialisation?token=${token}`;
  await sendPasswordResetEmail({ to: user.email, firstName: user.firstName, resetUrl });
}

/**
 * Réinitialisation effective : token à usage unique, toutes les sessions de
 * l'utilisateur sont révoquées (un attaquant ayant volé une session est éjecté).
 * @param {{ token: string, password: string }} input
 */
export async function resetPassword(input) {
  const stored = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(input.token) },
  });
  if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
    throw AppError.badRequest('Lien de réinitialisation invalide ou expiré');
  }

  const passwordHash = await hashPassword(input.password);
  await prisma.$transaction([
    prisma.user.update({ where: { id: stored.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({
      where: { id: stored.id },
      data: { usedAt: new Date() },
    }),
  ]);
  await revokeAllUserTokens(stored.userId);
}

/**
 * Bannissement d'un compte (US-9.2, exposé en Phase 6 côté admin ; le service
 * vit ici car l'effet est purement « sécurité des sessions »).
 * @param {string} userId
 */
export async function banUser(userId) {
  await prisma.user.update({
    where: { id: userId },
    data: { banned: true, bannedAt: new Date() },
  });
  await revokeAllUserTokens(userId);
  await blacklistUser(userId);
}
