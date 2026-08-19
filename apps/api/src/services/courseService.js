// @ts-check
/**
 * Service cours — création récurrente, inscriptions, présences, planning (EPIC 4).
 */
import { ATTENDANCE_STATUS, COURSE_STATUS, NOTIFICATION_TYPES, ROLES } from '@equime/shared';

import { AppError } from '../lib/appError.js';
import { getFamilyIdForUser } from '../lib/family.js';
import { isLevelInRange } from '../lib/levels.js';
import { prisma } from '../lib/prisma.js';
import { assertRiderDocumentsApproved } from '../lib/riderDocuments.js';

import {
  assignHorsesForSession,
  listHorseOverrideOptions,
  overrideAssignedHorse,
} from './horseAssignment.js';
import { createNotification } from './notificationService.js';
import { getPlanningCached, invalidatePlanningCache } from './planningCache.js';
import { expandWeeklyRecurrence } from './recurrence.js';
import { assertNoSpaceConflict, assertRidingSpace } from './spaceService.js';

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

const PUBLIC_COURSE_LIMIT = 12;

/**
 * Séances à venir pour la vitrine (Excel 1.2) : champs publics seulement,
 * pas d'identité d'élève ni de moniteur.
 */
export async function listPublicCourses() {
  const now = new Date();
  const courses = await prisma.course.findMany({
    where: {
      status: { in: [COURSE_STATUS.SCHEDULED, COURSE_STATUS.ONGOING] },
      startAt: { gt: now },
    },
    select: {
      id: true,
      title: true,
      startAt: true,
      endAt: true,
      capacity: true,
      space: { select: { type: true } },
      _count: { select: { enrollments: true } },
    },
    orderBy: { startAt: 'asc' },
    take: PUBLIC_COURSE_LIMIT,
  });

  return courses.map((course) => ({
    id: course.id,
    title: course.title,
    startAt: course.startAt,
    endAt: course.endAt,
    type: course.space.type,
    remainingSpots: Math.max(0, course.capacity - course._count.enrollments),
  }));
}

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

  await assertRidingSpace(input.spaceId);
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

  if (input.spaceId) await assertRidingSpace(input.spaceId);
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
  let cancelledCourseIds = [courseId];

  if (cancelSeries && course.recurrenceRule) {
    const rootId = course.parentCourseId ?? course.id;
    const seriesCourses = await prisma.course.findMany({
      where: {
        OR: [{ id: rootId }, { parentCourseId: rootId }],
        status: { not: COURSE_STATUS.CANCELLED },
      },
      select: { id: true },
    });
    cancelledCourseIds = seriesCourses.map((c) => c.id);
    await prisma.course.updateMany({
      where: { id: { in: cancelledCourseIds } },
      data: { status: COURSE_STATUS.CANCELLED },
    });
  } else {
    await prisma.course.update({
      where: { id: courseId },
      data: { status: COURSE_STATUS.CANCELLED },
    });
  }

  const enrollments = await prisma.courseEnrollment.findMany({
    where: { courseId: { in: cancelledCourseIds } },
    include: {
      rider: { include: { family: { select: { userId: true } } } },
      course: { select: { title: true, startAt: true } },
    },
  });

  for (const enrollment of enrollments) {
    const dateLabel = enrollment.course.startAt.toLocaleDateString('fr-FR');
    await createNotification({
      userId: enrollment.rider.family.userId,
      type: NOTIFICATION_TYPES.COURSE_CANCELLED,
      title: 'Cours annulé',
      body: `Le cours « ${enrollment.course.title} » du ${dateLabel} a été annulé`,
      linkUrl: '/app/planning',
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
 * @param {{ role: string, force?: boolean }} [options] `force` n'est honoré que pour un admin (Excel 10.4).
 */
export async function enrollRider(userId, courseId, riderId, options = {}) {
  const force = options.role === ROLES.ADMIN && options.force === true;
  const riderInclude = { family: { select: { userId: true } } };

  const rider =
    options.role === ROLES.ADMIN
      ? await prisma.rider.findUnique({ where: { id: riderId }, include: riderInclude })
      : await prisma.rider.findFirst({
          where: { id: riderId, familyId: await getFamilyIdForUser(userId) },
          include: riderInclude,
        });
  if (!rider) throw AppError.notFound('Cavalier introuvable');

  if (!force) {
    assertRiderDocumentsApproved(rider);
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
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

  const existing = await prisma.courseEnrollment.findUnique({
    where: { courseId_riderId: { courseId, riderId } },
  });
  if (existing) throw AppError.conflict('Ce cavalier est déjà inscrit à ce cours');

  const enrollment = await prisma.$transaction(async (tx) => {
    const lockedCourse = await tx.course.findUnique({
      where: { id: courseId },
      include: { _count: { select: { enrollments: true } } },
    });
    if (!lockedCourse || lockedCourse._count.enrollments >= lockedCourse.capacity) {
      throw AppError.conflict('Ce cours est complet');
    }

    if (!force) {
      const quota = await tx.family.updateMany({
        where: { id: rider.familyId, sessionQuota: { gt: 0 } },
        data: { sessionQuota: { decrement: 1 } },
      });
      if (quota.count !== 1) {
        throw AppError.badRequest('Quota de séances épuisé sur votre abonnement');
      }
    }

    return tx.courseEnrollment.create({
      data: { courseId, riderId },
      include: { rider: { select: { firstName: true, lastName: true } } },
    });
  });

  await createNotification({
    userId: rider.family.userId,
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
      horse: { select: { id: true, name: true, photoUrl: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * @param {string} courseId
 * @param {string} enrollmentId
 * @param {string} attendance
 * @param {{ id: string, role: string }} actor
 */
export async function updateAttendance(courseId, enrollmentId, attendance, actor) {
  const enrollment = await prisma.courseEnrollment.findFirst({
    where: { id: enrollmentId, courseId },
    include: {
      rider: { include: { family: { select: { userId: true } } } },
      course: { select: { title: true, startAt: true } },
    },
  });
  if (!enrollment) throw AppError.notFound('Inscription introuvable');

  if (actor.role === ROLES.CLIENT) {
    if (enrollment.rider.family.userId !== actor.id) {
      throw AppError.notFound('Inscription introuvable');
    }
    if (attendance !== ATTENDANCE_STATUS.EXCUSED) {
      throw AppError.forbidden('Vous pouvez uniquement signaler une absence (excusé)');
    }
    if (enrollment.course.startAt <= new Date()) {
      throw AppError.badRequest('Seules les séances à venir peuvent être excusées');
    }
  }

  const previous = enrollment.attendance;
  const updated = await prisma.courseEnrollment.update({
    where: { id: enrollmentId },
    data: { attendance },
    include: {
      rider: { select: { id: true, firstName: true, lastName: true, level: true } },
      horse: { select: { id: true, name: true, photoUrl: true } },
    },
  });

  const clientExcuse = actor.role === ROLES.CLIENT && attendance === ATTENDANCE_STATUS.EXCUSED;
  const instructorAbsence = attendance === ATTENDANCE_STATUS.ABSENT;
  if (
    (clientExcuse && previous !== ATTENDANCE_STATUS.EXCUSED) ||
    (instructorAbsence && previous !== ATTENDANCE_STATUS.ABSENT)
  ) {
    await createNotification({
      userId: enrollment.rider.family.userId,
      type: NOTIFICATION_TYPES.RIDER_ABSENCE,
      title: 'Absence signalée',
      body: clientExcuse
        ? `${enrollment.rider.firstName} sera absent(e) au cours « ${enrollment.course.title} »`
        : `${enrollment.rider.firstName} a été marqué(e) absent(e) au cours « ${enrollment.course.title} »`,
      linkUrl: '/app/planning',
    });
  }

  return updated;
}

/**
 * Inscriptions à venir de la famille (pour signaler une absence, Excel 3.7).
 * @param {string} userId
 */
export async function listFamilyUpcomingEnrollments(userId) {
  const familyId = await getFamilyIdForUser(userId);
  const rows = await prisma.courseEnrollment.findMany({
    where: {
      rider: { familyId },
      course: {
        startAt: { gt: new Date() },
        status: { notIn: [COURSE_STATUS.DRAFT, COURSE_STATUS.CANCELLED] },
      },
    },
    include: {
      rider: { select: { id: true, firstName: true, lastName: true } },
      course: {
        select: {
          id: true,
          title: true,
          startAt: true,
          endAt: true,
          space: { select: { name: true } },
          instructor: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { course: { startAt: 'asc' } },
  });

  return rows.map((row) => ({
    id: row.id,
    courseId: row.courseId,
    attendance: row.attendance,
    rider: row.rider,
    course: {
      id: row.course.id,
      title: row.course.title,
      startAt: row.course.startAt,
      endAt: row.course.endAt,
      spaceName: row.course.space.name,
      instructorName: `${row.course.instructor.firstName} ${row.course.instructor.lastName}`,
    },
  }));
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
  const riders = await prisma.rider.findMany({
    where: { familyId },
    select: { id: true, level: true },
  });
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
      const hasCompatibleRider = riders.some((r) =>
        isLevelInRange(r.level, c.minLevel, c.maxLevel)
      );
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
