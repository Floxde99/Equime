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
import { deleteStoredFile } from '../lib/uploads.js';

import {
  blacklistUser,
  hashToken,
  issueTokenPair,
  revokeAllUserTokens,
  blacklistAccessToken,
} from './tokenService.js';

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
 *   phone: string | null, role: string, createdAt: Date, sessionQuota: number | null }} PublicUser
 */

/**
 * Profil public + quota de séances famille (clients uniquement).
 * @param {string} userId
 * @returns {Promise<PublicUser>}
 */
async function loadPublicUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...PUBLIC_USER_SELECT,
      family: { select: { sessionQuota: true } },
    },
  });
  if (!user) throw AppError.unauthorized();
  const { family, ...safe } = user;
  return { ...safe, sessionQuota: family?.sessionQuota ?? null };
}

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
  return { user: await loadPublicUser(user.id), accessToken, refreshToken };
}

/**
 * Création d'un compte membre par un administrateur (Excel 7.1).
 * - `instructor` : pas de famille (seuls les clients en ont une).
 * - `client` : famille sans formule, quota 0.
 * Un admin ne peut pas créer un autre admin par cet endpoint.
 *
 * @param {{ email: string, password: string, firstName: string, lastName: string, phone?: string, role?: string }} input
 * @returns {Promise<PublicUser>}
 */
export async function createMember(input) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw AppError.conflict('Un compte existe déjà avec cette adresse email');

  const role = input.role === ROLES.CLIENT ? ROLES.CLIENT : ROLES.INSTRUCTOR;
  const passwordHash = await hashPassword(input.password);

  if (role === ROLES.CLIENT) {
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
      await tx.family.create({ data: { userId: created.id, sessionQuota: 0 } });
      return created;
    });
    return loadPublicUser(user.id);
  }

  return prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone ?? null,
      role: ROLES.INSTRUCTOR,
    },
    select: PUBLIC_USER_SELECT,
  });
}

/**
 * Alias historique : création d'un moniteur (Excel 7.1).
 * @param {{ email: string, password: string, firstName: string, lastName: string, phone?: string }} input
 * @returns {Promise<PublicUser>}
 */
export async function createInstructor(input) {
  return createMember({ ...input, role: ROLES.INSTRUCTOR });
}

/**
 * Mise à jour de la fiche d'un membre (prénom, nom, téléphone) — pas le rôle.
 * @param {string} memberId
 * @param {{ firstName: string, lastName: string, phone?: string | null }} input
 * @returns {Promise<PublicUser>}
 */
export async function updateMemberProfile(memberId, input) {
  const user = await prisma.user.findUnique({
    where: { id: memberId },
    select: { id: true, role: true, anonymizedAt: true },
  });
  if (!user) throw AppError.notFound('Utilisateur introuvable');
  if (user.role === ROLES.ADMIN) {
    throw AppError.forbidden('Impossible de modifier un administrateur');
  }
  if (user.anonymizedAt) throw AppError.conflict('Compte anonymisé — action impossible');

  await prisma.user.update({
    where: { id: memberId },
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
    },
  });
  return loadPublicUser(user.id);
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
  if (user.anonymizedAt) {
    throw AppError.forbidden('Ce compte a été supprimé');
  }

  const { accessToken, refreshToken } = await issueTokenPair(user, context);
  return { user: await loadPublicUser(user.id), accessToken, refreshToken };
}

/**
 * Profil de l'utilisateur courant.
 * @param {string} userId
 * @returns {Promise<PublicUser>}
 */
export async function getMe(userId) {
  return loadPublicUser(userId);
}

/**
 * Mise à jour du profil (prénom, nom, téléphone) — Excel 3.1.
 * L'email n'est pas modifiable ici.
 * @param {string} userId
 * @param {{ firstName: string, lastName: string, phone?: string | null }} input
 * @returns {Promise<PublicUser>}
 */
export async function updateMe(userId, input) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, anonymizedAt: true },
  });
  if (!user) throw AppError.unauthorized();
  if (user.anonymizedAt) throw AppError.forbidden('Ce compte a été supprimé');

  await prisma.user.update({
    where: { id: userId },
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
    },
  });
  return loadPublicUser(userId);
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
 * @param {string} [actorId] Identifiant de l'admin qui bannit
 */
export async function banUser(userId, actorId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.notFound('Utilisateur introuvable');
  if (user.role === 'admin') throw AppError.forbidden('Impossible de bannir un administrateur');
  if (actorId && userId === actorId) {
    throw AppError.forbidden('Impossible de vous bannir vous-même');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { banned: true, bannedAt: new Date() },
  });
  await revokeAllUserTokens(userId);
  await blacklistUser(userId);
}

/**
 * Levée du bannissement (US-9.2).
 * @param {string} userId
 */
export async function unbanUser(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.notFound('Utilisateur introuvable');
  if (user.anonymizedAt) throw AppError.conflict('Compte anonymisé — action impossible');

  await prisma.user.update({
    where: { id: userId },
    data: { banned: false, bannedAt: null },
  });
}

/**
 * Suppression de compte RGPD : anonymisation des données personnelles,
 * conservation des factures, révocation des sessions (US-1.6).
 *
 * @param {string} userId
 * @param {string | undefined} accessJti jti du token courant à blacklister
 */
export async function anonymizeAccount(userId, accessJti) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { family: { include: { riders: true } } },
  });
  if (!user) throw AppError.unauthorized();
  if (user.anonymizedAt) throw AppError.conflict('Compte déjà supprimé');
  if (user.role !== 'client') {
    throw AppError.forbidden(
      "Seuls les comptes clients peuvent être supprimés depuis l'espace client"
    );
  }

  for (const rider of user.family?.riders ?? []) {
    await deleteStoredFile(rider.medicalCertificateUrl);
    await deleteStoredFile(rider.licenseUrl);
  }

  const placeholderPassword = await hashPassword(randomBytes(32).toString('base64url'));

  await prisma.$transaction(async (tx) => {
    if (user.family) {
      for (const rider of user.family.riders) {
        await tx.rider.update({
          where: { id: rider.id },
          data: {
            firstName: 'Anonyme',
            lastName: rider.id.slice(-6),
            medicalCertificateUrl: null,
            licenseUrl: null,
            medicalCertificateStatus: 'missing',
            licenseStatus: 'missing',
            medicalConsentAt: null,
            medicalCertificateRejectionReason: null,
            licenseRejectionReason: null,
            medicalCertificateExpiresAt: null,
            licenseExpiresAt: null,
          },
        });
      }
    }

    await tx.message.updateMany({
      where: { senderId: userId },
      data: { body: '[Message supprimé]' },
    });

    await tx.notification.deleteMany({ where: { userId } });
    await tx.notificationPreference.deleteMany({ where: { userId } });
    await tx.volunteerSignup.deleteMany({ where: { userId } });
    await tx.passwordResetToken.deleteMany({ where: { userId } });

    await tx.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${userId}@anonymized.local`,
        firstName: 'Utilisateur',
        lastName: 'supprimé',
        phone: null,
        passwordHash: placeholderPassword,
        anonymizedAt: new Date(),
      },
    });
  });

  await revokeAllUserTokens(userId);
  await blacklistUser(userId);
  if (accessJti) await blacklistAccessToken(accessJti);
}

/**
 * Export portabilité RGPD : données structurées du compte client (profil, cavaliers, factures).
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function exportPortableData(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      createdAt: true,
      family: {
        select: {
          sessionQuota: true,
          riders: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              birthdate: true,
              level: true,
              medicalCertificateStatus: true,
              licenseStatus: true,
              medicalConsentAt: true,
              createdAt: true,
            },
          },
          invoices: {
            select: {
              id: true,
              number: true,
              status: true,
              totalCents: true,
              issuedAt: true,
              paidAt: true,
              items: {
                select: { label: true, quantity: true, unitCents: true },
              },
            },
            orderBy: { issuedAt: 'desc' },
          },
        },
      },
    },
  });
  if (!user) throw AppError.unauthorized();
  if (user.role !== ROLES.CLIENT) {
    throw AppError.forbidden("L'export portabilité est réservé aux comptes clients");
  }

  return {
    exportedAt: new Date().toISOString(),
    format: 'equime-portability-v1',
    profile: {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      createdAt: user.createdAt,
    },
    family: user.family
      ? {
          sessionQuota: user.family.sessionQuota,
          riders: user.family.riders,
          invoices: user.family.invoices,
        }
      : null,
  };
}
