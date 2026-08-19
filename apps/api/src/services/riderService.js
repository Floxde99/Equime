// @ts-check
/**
 * Service cavaliers — CRUD famille, documents, affinités (EPIC 2).
 */
import { AppError } from '../lib/appError.js';
import { assertRiderInFamily, getFamilyIdForUser } from '../lib/family.js';
import { prisma } from '../lib/prisma.js';
import { deleteStoredFile, persistRiderDocument } from '../lib/uploads.js';

const RIDER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  birthdate: true,
  level: true,
  medicalCertificateStatus: true,
  licenseStatus: true,
  medicalConsentAt: true,
  createdAt: true,
  updatedAt: true,
};

/**
 * @param {string} userId
 */
export async function listFamilyRiders(userId) {
  const familyId = await getFamilyIdForUser(userId);
  return prisma.rider.findMany({ where: { familyId }, select: RIDER_SELECT, orderBy: { firstName: 'asc' } });
}

/**
 * @param {string} userId
 * @param {{ firstName: string, lastName: string, birthdate: Date, level: string }} input
 */
export async function createRider(userId, input) {
  const familyId = await getFamilyIdForUser(userId);
  return prisma.rider.create({
    data: { familyId, ...input },
    select: RIDER_SELECT,
  });
}

/**
 * @param {string} userId
 * @param {string} riderId
 * @param {Partial<{ firstName: string, lastName: string, birthdate: Date, level: string }>} input
 */
export async function updateRider(userId, riderId, input) {
  const familyId = await getFamilyIdForUser(userId);
  await assertRiderInFamily(riderId, familyId);
  return prisma.rider.update({ where: { id: riderId }, data: input, select: RIDER_SELECT });
}

/**
 * @param {string} userId
 * @param {string} riderId
 */
export async function deleteRider(userId, riderId) {
  const familyId = await getFamilyIdForUser(userId);
  const rider = await prisma.rider.findFirst({
    where: { id: riderId, familyId },
    select: { id: true, medicalCertificateUrl: true, licenseUrl: true },
  });
  if (!rider) throw AppError.notFound('Cavalier introuvable');

  const enrollments = await prisma.courseEnrollment.count({ where: { riderId } });
  if (enrollments > 0) {
    throw AppError.conflict('Impossible de supprimer un cavalier inscrit à des cours');
  }

  await prisma.rider.delete({ where: { id: riderId } });
  await deleteStoredFile(rider.medicalCertificateUrl);
  await deleteStoredFile(rider.licenseUrl);
}

/**
 * @param {string} userId
 * @param {string} riderId
 * @param {'medical_certificate' | 'license'} docType
 * @param {Express.Multer.File} file
 * @param {{ medicalConsent?: boolean }} fields
 */
export async function uploadRiderDocument(userId, riderId, docType, file, fields) {
  const familyId = await getFamilyIdForUser(userId);
  const rider = await assertRiderInFamily(riderId, familyId);

  if (docType === 'medical_certificate' && !fields.medicalConsent) {
    throw AppError.badRequest('Le consentement explicite est requis pour le certificat médical');
  }

  const { relativePath } = await persistRiderDocument(file, docType);
  const urlField = docType === 'medical_certificate' ? 'medicalCertificateUrl' : 'licenseUrl';
  const statusField =
    docType === 'medical_certificate' ? 'medicalCertificateStatus' : 'licenseStatus';
  const previousPath = rider[urlField];

  const updated = await prisma.rider.update({
    where: { id: riderId },
    data: {
      [urlField]: relativePath,
      [statusField]: 'pending',
      ...(docType === 'medical_certificate' ? { medicalConsentAt: new Date() } : {}),
    },
    select: RIDER_SELECT,
  });

  await deleteStoredFile(previousPath);
  return updated;
}

/**
 * @param {string} userId
 * @param {string} riderId
 * @param {'medical_certificate' | 'license'} docType
 * @param {'client' | 'admin'} role
 */
export async function getRiderDocumentPath(userId, riderId, docType, role) {
  const rider = await prisma.rider.findUnique({
    where: { id: riderId },
    include: { family: { select: { userId: true } } },
  });
  if (!rider) throw AppError.notFound('Cavalier introuvable');

  if (role !== 'admin' && rider.family.userId !== userId) {
    throw AppError.forbidden();
  }

  const relativePath =
    docType === 'medical_certificate' ? rider.medicalCertificateUrl : rider.licenseUrl;
  if (!relativePath) throw AppError.notFound('Document introuvable');

  return relativePath;
}

/**
 * @param {string} userId
 * @param {string} riderId
 */
export async function listRiderAffinities(userId, riderId) {
  const familyId = await getFamilyIdForUser(userId);
  await assertRiderInFamily(riderId, familyId);
  return prisma.horseAffinity.findMany({
    where: { riderId },
    include: { horse: { select: { id: true, name: true, status: true } } },
    orderBy: { updatedAt: 'desc' },
  });
}

/**
 * @param {string} userId
 * @param {string} riderId
 * @param {string} horseId
 * @param {string} affinity
 */
export async function upsertRiderAffinity(userId, riderId, horseId, affinity) {
  const familyId = await getFamilyIdForUser(userId);
  await assertRiderInFamily(riderId, familyId);

  const horse = await prisma.horse.findUnique({ where: { id: horseId } });
  if (!horse) throw AppError.notFound('Cheval introuvable');

  return prisma.horseAffinity.upsert({
    where: { riderId_horseId: { riderId, horseId } },
    create: { riderId, horseId, affinity },
    update: { affinity },
    include: { horse: { select: { id: true, name: true, status: true } } },
  });
}