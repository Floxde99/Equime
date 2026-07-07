// @ts-check
/**
 * Accès famille — scope client pour les cavaliers.
 */
import { AppError } from './appError.js';
import { prisma } from './prisma.js';

/**
 * @param {string} userId
 */
export async function getFamilyIdForUser(userId) {
  const family = await prisma.family.findUnique({ where: { userId }, select: { id: true } });
  if (!family) throw AppError.forbidden('Aucune famille associée à ce compte');
  return family.id;
}

/**
 * @param {string} riderId
 * @param {string} familyId
 */
export async function assertRiderInFamily(riderId, familyId) {
  const rider = await prisma.rider.findFirst({
    where: { id: riderId, familyId },
    select: {
      id: true,
      medicalCertificateUrl: true,
      licenseUrl: true,
    },
  });
  if (!rider) throw AppError.notFound('Cavalier introuvable');
  return rider;
}
