// @ts-check
/**
 * Service cours — création récurrente, inscriptions, présences, planning (EPIC 4).
 */
import { COURSE_STATUS, NOTIFICATION_TYPES } from '@equime/shared';

import { AppError } from '../lib/appError.js';
import { getFamilyIdForUser } from '../lib/family.js';
import { isLevelInRange } from '../lib/levels.js';
import { prisma } from '../lib/prisma.js';

import {
  assignHorsesForSession,
  listHorseOverrideOptions,
  overrideAssignedHorse,
} from './horseAssignment.js';
import { createNotification } from './notificationService.js';
import { getPlanningCached, invalidatePlanningCache } from './planningCache.js';
import { expandWeeklyRecurrence } from './recurrence.js';
import { assertNoSpaceConflict } from './spaceService.js';

const COURSE_SELECT = {
  id: true,
  title: true,
  description: true,
  instructorId: true,
  spaceId: true,
  startAt: true,
  endAt: true,
  capacity: true,
  minLevel: true,
  maxLevel: true,
  status: true,
  recurrenceRule: true,
  recurrenceEndDate: true,
  parentCourseId: true,
  createdAt: true,
  updatedAt: true,
};

/**
 * @param {object} input
 * @param {boolean} [skipConflictForId]
 */
async function validateSlots(input, excludeCourseId) {
  await assertNoSpaceConflict({
    spaceId: input.spaceId,
    startAt: input.startAt,
    endAt: input.endAt,
    excludeCourseId,
  });

  if (input.recurrenceRule === 'weekly' && input.recurrenceEndDate) {
    const children = expandWeeklyRecurrence({
      startAt: input.startAt,
      endAt: input.endAt,
      recurrenceEndDate: input.recurrenceEndDate,
    });
    for (const slot of children) {
      await assertNoSpaceConflict({
        spaceId: input.spaceId,
        startAt: slot.startAt,
        endAt: slot.endAt,
      });
    }
  }
}

/**
 * @param {object} input
 */
export async function createCourse(input) {
  const instructor = await prisma.user.findUnique({ where: { id: input.instructorId } });
  if (!instructor || instructor.role === 'client') {
    throw AppError.badRequest('Moniteur invalide');
  }

  await validateSlots(input);

  const course = await prisma.$transaction(async (tx) => {
    const parent = await tx.course.create({
      data: {
        title: input.title,
        description: input.description ?? null,
        instructorId: input.instructorId,
        spaceId: input.spaceId,
        startAt: input.startAt,
        endAt: input.endAt,
        capacity: input.capacity,
        minLevel: input.minLevel,
        maxLevel: input.maxLevel,
        status: input.status,
        recurrenceRule: input.recurrenceRule ?? null,
        recurrenceEndDate: input.recurrenceEndDate ?? null,
      },
      select: COURSE_SELECT,
    });

    if (input.recurrenceRule === 'weekly' && input.recurrenceEndDate) {
      const slots = expandWeeklyRecurrence({
        startAt: input.startAt,
        endAt: input.endAt,
        recurrenceEndDate: input.recurrenceEndDate,
      });

      if (slots.length > 0) {
        await tx.course.createMany({
          data: slots.map((slot) => ({
            title: input.title,
            description: input.description ?? null,
            instructorId: input.instructorId,
            spaceId: input.spaceId,
            startAt: slot.startAt,
            endAt: slot.endAt,
            capacity: input.capacity,
            minLevel: input.minLevel,
            maxLevel: input.maxLevel,
            status: input.status,
            parentCourseId: parent.id,
          })),
        });
      }
    }

    return parent;
  });

  await invalidatePlanningCache();
  return course;
}

/**
 * @param {string} courseId
 */
export async function getCourse(courseId) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      ...COURSE_SELECT,
      instructor: { select: { id: true, firstName: true, lastName: true } },
      space: { select: { id: true, name: true, type: true } },
      _count: { select: { enrollments: true } },
    },
  });
  if (!course) throw AppError.notFound('Cours introuvable');
  return course;
}

/**
 * @param {string} courseId
 * @param {Partial<object>} input
 */
export async function updateCourse(courseId, input) {
  const existing = await getCourse(courseId);
  const merged = {
    spaceId: input.spaceId ?? existing.spaceId,
    startAt: input.startAt ?? existing.startAt,
    endAt: input.endAt ?? existing.endAt,
  };

  await assertNoSpaceConflict({ ...merged, excludeCourseId: courseId });

  const updated = await prisma.course.update({
    where: { id: courseId },
    data: input,
    select: COURSE_SELECT,
  });

  await invalidatePlanningCache();
  return updated;
}

/**
 * @param {string} courseId
 * @param {boolean} cancelSeries
 */
export async function cancelCourse(courseId, cancelSeries) {
  const course = await getCourse(courseId);

  if (cancelSeries && course.recurrenceRule) {
    const rootId = course.parentCourseId ?? course.id;
    await prisma.course.updateMany({
      where: {
        OR: [{ id: rootId }, { parentCourseId: rootId }],
        status: { not: 'cancelled' },
      },
      data: { status: COURSE_STATUS.CANCELLED },
    });
  } else {
    await prisma.course.update({
      where: { id: courseId },
      data: { status: COURSE_STATUS.CANCELLED },
    });
  }

  await invalidatePlanningCache();
}

/**
 * @param {{ from: Date, to: Date, scope: string, userId: string, role: string }} params
 */
export async function getPlanningEvents(params) {
  const instructorFilter =
    params.scope === 'mine' && params.role === 'instructor'
      ? { instructorId: params.userId }
      : params.scope === 'mine' && params.role === 'client'
        ? {
            enrollments: {
              some: { rider: { family: { userId: params.userId } } },
            },
          }
        : {};

  return getPlanningCached(
    {
      from: params.from,
      to: params.to,
      scope: params.scope,
      instructorId: params.role === 'instructor' ? params.userId : undefined,
    },
    async () => {
      const courses = await prisma.course.findMany({
        where: {
          startAt: { gte: params.from, lt: params.to },
          status: { notIn: ['draft', 'cancelled'] },
          ...instructorFilter,
        },
        select: {
          id: true,
          title: true,
          startAt: true,
          endAt: true,
          status: true,
          space: { select: { name: true } },
          instructor: { select: { firstName: true, lastName: true } },
        },
        orderBy: { startAt: 'asc' },
      });

      return courses.map((c) => ({
        id: c.id,
        title: c.title,
        start: c.startAt.toISOString(),
        end: c.endAt.toISOString(),
        extendedProps: {
          status: c.status,
          spaceName: c.space.name,
          instructorName: `${c.instructor.firstName} ${c.instructor.lastName}`,
        },
      }));
    }
  );
}

/**
 * @param {string} userId
 * @param {string} courseId
 * @param {string} riderId
 */
export async function enrollRider(userId, courseId, riderId) {
  const familyId = await getFamilyIdForUser(userId);
  const rider = await prisma.rider.findFirst({ where: { id: riderId, familyId } });
  if (!rider) throw AppError.notFound('Cavalier introuvable');

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { _count: { select: { enrollments: true } } },
  });
  if (!course || course.status === COURSE_STATUS.CANCELLED) {
    throw AppError.notFound('Cours introuvable');
  }
  if (course.status === COURSE_STATUS.DRAFT) {
    throw AppError.badRequest("Ce cours n'est pas encore ouvert aux inscriptions");
  }
  if (!isLevelInRange(rider.level, course.minLevel, course.maxLevel)) {
    throw AppError.badRequest("Le niveau du cavalier n'est pas compatible avec ce cours");
  }
  if (course._count.enrollments >= course.capacity) {
    throw AppError.conflict('Ce cours est complet');
  }

  const family = await prisma.family.findUnique({ where: { id: familyId } });
  if (!family || family.sessionQuota <= 0) {
    throw AppError.badRequest('Quota de séances épuisé sur votre abonnement');
  }

  const existing = await prisma.courseEnrollment.findUnique({
    where: { courseId_riderId: { courseId, riderId } },
  });
  if (existing) throw AppError.conflict('Ce cavalier est déjà inscrit à ce cours');

  const enrollment = await prisma.$transaction(async (tx) => {
    await tx.family.update({
      where: { id: familyId },
      data: { sessionQuota: { decrement: 1 } },
    });
    return tx.courseEnrollment.create({
      data: { courseId, riderId },
      include: { rider: { select: { firstName: true, lastName: true } } },
    });
  });

  await createNotification({
    userId,
    type: NOTIFICATION_TYPES.COURSE_ENROLLED,
    title: 'Inscription confirmée',
    body: `${rider.firstName} est inscrit(e) au cours « ${course.title} »`,
    linkUrl: '/app/planning',
  });

  await invalidatePlanningCache();
  return enrollment;
}

/**
 * @param {string} courseId
 */
export async function listEnrollments(courseId) {
  await getCourse(courseId);
  return prisma.courseEnrollment.findMany({
    where: { courseId },
    include: {
      rider: { select: { id: true, firstName: true, lastName: true, level: true } },
      horse: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * @param {string} courseId
 * @param {string} enrollmentId
 * @param {string} attendance
 */
export async function updateAttendance(courseId, enrollmentId, attendance) {
  const enrollment = await prisma.courseEnrollment.findFirst({
    where: { id: enrollmentId, courseId },
    include: {
      rider: { include: { family: { select: { userId: true } } } },
      course: { select: { title: true } },
    },
  });
  if (!enrollment) throw AppError.notFound('Inscription introuvable');

  const previous = enrollment.attendance;
  const updated = await prisma.courseEnrollment.update({
    where: { id: enrollmentId },
    data: { attendance },
    include: {
      rider: { select: { id: true, firstName: true, lastName: true, level: true } },
      horse: { select: { id: true, name: true } },
    },
  });

  if (attendance === 'absent' && previous !== 'absent') {
    await createNotification({
      userId: enrollment.rider.family.userId,
      type: NOTIFICATION_TYPES.RIDER_ABSENCE,
      title: 'Absence signalée',
      body: `${enrollment.rider.firstName} a été marqué(e) absent(e) au cours « ${enrollment.course.title} »`,
      linkUrl: '/app/planning',
    });
  }

  return updated;
}

/**
 * @param {string} courseId
 */
export async function assignHorses(courseId) {
  await getCourse(courseId);
  return assignHorsesForSession(courseId);
}

/**
 * @param {string} courseId
 * @param {string} enrollmentId
 */
export async function getHorseOverrideOptions(courseId, enrollmentId) {
  await getCourse(courseId);
  return listHorseOverrideOptions(courseId, enrollmentId);
}

/**
 * @param {string} courseId
 * @param {string} enrollmentId
 * @param {string} horseId
 */
export async function overrideHorse(courseId, enrollmentId, horseId) {
  await getCourse(courseId);
  return overrideAssignedHorse(courseId, enrollmentId, horseId);
}

/**
 * Cours ouverts aux inscriptions pour un client (niveau compatible, places disponibles).
 * @param {string} userId
 */
export async function listEnrollableCourses(userId) {
  const familyId = await getFamilyIdForUser(userId);
  const riders = await prisma.rider.findMany({ where: { familyId }, select: { id: true, level: true } });
  if (riders.length === 0) return [];

  const now = new Date();
  const courses = await prisma.course.findMany({
    where: {
      status: COURSE_STATUS.SCHEDULED,
      startAt: { gt: now },
    },
    include: {
      _count: { select: { enrollments: true } },
      space: { select: { name: true } },
    },
    orderBy: { startAt: 'asc' },
  });

  return courses
    .filter((c) => {
      const hasCompatibleRider = riders.some((r) => isLevelInRange(r.level, c.minLevel, c.maxLevel));
      const hasCapacity = c._count.enrollments < c.capacity;
      return hasCompatibleRider && hasCapacity;
    })
    .map((c) => ({
      id: c.id,
      title: c.title,
      startAt: c.startAt,
      endAt: c.endAt,
      minLevel: c.minLevel,
      maxLevel: c.maxLevel,
      capacity: c.capacity,
      enrolledCount: c._count.enrollments,
      spaceName: c.space.name,
    }));
}
