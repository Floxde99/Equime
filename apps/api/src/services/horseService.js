// @ts-check
/**
 * Service cavalerie — fiches chevaux et carnet de santé (EPIC 3).
 */
import { AppError } from '../lib/appError.js';
import { prisma } from '../lib/prisma.js';
import { deleteStoredFile, persistHorsePhoto } from '../lib/uploads.js';

const HORSE_SELECT = {
  id: true,
  name: true,
  breed: true,
  birthYear: true,
  photoUrl: true,
  status: true,
  minLevel: true,
  maxLevel: true,
  weeklyLoadHours: true,
  maxWeeklyLoadHours: true,
  alertThresholdHours: true,
  createdAt: true,
  updatedAt: true,
};

export async function listHorses() {
  return prisma.horse.findMany({ select: HORSE_SELECT, orderBy: { name: 'asc' } });
}

/**
 * @param {Partial<{ name: string, breed?: string, birthYear?: number, status: string,
 *   minLevel: string, maxLevel: string, maxWeeklyLoadHours: number, alertThresholdHours: number }>} input
 */
export async function createHorse(input) {
  return prisma.horse.create({ data: input, select: HORSE_SELECT });
}

/**
 * @param {string} horseId
 */
export async function getHorse(horseId) {
  const horse = await prisma.horse.findUnique({ where: { id: horseId }, select: HORSE_SELECT });
  if (!horse) throw AppError.notFound('Cheval introuvable');
  return horse;
}

/**
 * @param {string} horseId
 * @param {Partial<{ name: string, breed?: string, birthYear?: number, status: string,
 *   minLevel: string, maxLevel: string, maxWeeklyLoadHours: number, alertThresholdHours: number }>} input
 */
export async function updateHorse(horseId, input) {
  await getHorse(horseId);
  return prisma.horse.update({ where: { id: horseId }, data: input, select: HORSE_SELECT });
}

/**
 * @param {string} horseId
 */
export async function deleteHorse(horseId) {
  const horse = await getHorse(horseId);
  const enrollments = await prisma.courseEnrollment.count({ where: { horseId } });
  if (enrollments > 0)
    throw AppError.conflict('Impossible de supprimer un cheval attribué à des cours');
  await prisma.horse.delete({ where: { id: horseId } });
  await deleteStoredFile(horse.photoUrl);
}

/**
 * @param {string} horseId
 * @param {Express.Multer.File} file
 */
export async function uploadHorsePhoto(horseId, file) {
  const horse = await getHorse(horseId);
  const { relativePath } = await persistHorsePhoto(file);
  const updated = await prisma.horse.update({
    where: { id: horseId },
    data: { photoUrl: relativePath },
    select: HORSE_SELECT,
  });
  await deleteStoredFile(horse.photoUrl);
  return updated;
}

/**
 * @param {string} horseId
 */
export async function deleteHorsePhoto(horseId) {
  const horse = await getHorse(horseId);
  if (!horse.photoUrl) throw AppError.notFound('Photo introuvable');
  const updated = await prisma.horse.update({
    where: { id: horseId },
    data: { photoUrl: null },
    select: HORSE_SELECT,
  });
  await deleteStoredFile(horse.photoUrl);
  return updated;
}

/**
 * @param {string} horseId
 */
export async function getHorsePhotoPath(horseId) {
  const horse = await getHorse(horseId);
  if (!horse.photoUrl) throw AppError.notFound('Photo introuvable');
  return horse.photoUrl;
}

/**
 * @param {string} horseId
 */
export async function listHealthLogs(horseId) {
  await getHorse(horseId);
  return prisma.horseHealthLog.findMany({
    where: { horseId },
    include: { author: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { occurredAt: 'desc' },
  });
}

/**
 * @param {string} horseId
 * @param {string} authorId
 * @param {{ type: string, notes: string, occurredAt: Date }} input
 */
export async function createHealthLog(horseId, authorId, input) {
  await getHorse(horseId);
  return prisma.horseHealthLog.create({
    data: { horseId, authorId, ...input },
    include: { author: { select: { id: true, firstName: true, lastName: true } } },
  });
}

/** Chevaux dont la charge hebdo dépasse le seuil d'alerte (dashboard admin). */
export async function listHorsesOverLoadThreshold() {
  const horses = await prisma.horse.findMany({ select: HORSE_SELECT });
  return horses.filter((h) => h.weeklyLoadHours >= h.alertThresholdHours);
}
