// @ts-check
/**
 * Service espaces — CRUD admin et détection de conflits planning (EPIC 3).
 */
import { SPACE_TYPES } from '@equime/shared';

import { AppError } from '../lib/appError.js';
import { prisma } from '../lib/prisma.js';

import { intervalsOverlap } from './recurrence.js';

const SPACE_SELECT = {
  id: true,
  name: true,
  type: true,
  capacity: true,
  createdAt: true,
  updatedAt: true,
};

export async function listSpaces() {
  return prisma.space.findMany({ select: SPACE_SELECT, orderBy: { name: 'asc' } });
}

/**
 * @param {{ name: string, type: string, capacity?: number }} input
 */
export async function createSpace(input) {
  return prisma.space.create({ data: input, select: SPACE_SELECT });
}

/**
 * @param {string} spaceId
 */
export async function getSpace(spaceId) {
  const space = await prisma.space.findUnique({ where: { id: spaceId }, select: SPACE_SELECT });
  if (!space) throw AppError.notFound('Espace introuvable');
  return space;
}

/**
 * Un box n’est pas un lieu de cours (manège / carrière / paddock uniquement).
 * @param {string} spaceId
 */
export async function assertRidingSpace(spaceId) {
  const space = await getSpace(spaceId);
  if (space.type === SPACE_TYPES.STALL) {
    throw AppError.badRequest(
      'Un box ne peut pas accueillir un cours — choisissez un manège, une carrière ou un paddock'
    );
  }
  return space;
}

/**
 * @param {string} spaceId
 * @param {{ name?: string, type?: string, capacity?: number }} input
 */
export async function updateSpace(spaceId, input) {
  await getSpace(spaceId);
  return prisma.space.update({ where: { id: spaceId }, data: input, select: SPACE_SELECT });
}

/**
 * @param {string} spaceId
 */
export async function deleteSpace(spaceId) {
  await getSpace(spaceId);
  const courses = await prisma.course.count({ where: { spaceId, status: { not: 'cancelled' } } });
  if (courses > 0)
    throw AppError.conflict('Impossible de supprimer un espace utilisé par des cours');
  await prisma.space.delete({ where: { id: spaceId } });
}

/**
 * Détecte un conflit de planning dans le même espace.
 * @param {{ spaceId: string, startAt: Date, endAt: Date, excludeCourseId?: string }} params
 */
export async function assertNoSpaceConflict({ spaceId, startAt, endAt, excludeCourseId }) {
  const overlapping = await prisma.course.findMany({
    where: {
      spaceId,
      status: { notIn: ['cancelled', 'draft'] },
      ...(excludeCourseId ? { id: { not: excludeCourseId } } : {}),
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
    select: { id: true, title: true, startAt: true, endAt: true },
  });

  const conflict = overlapping.find((c) => intervalsOverlap(startAt, endAt, c.startAt, c.endAt));
  if (conflict) {
    throw AppError.conflict(
      `Conflit de planning dans cet espace avec le cours « ${conflict.title} »`
    );
  }
}
