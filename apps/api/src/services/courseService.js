// @ts-check
/**
 * Service cours — création récurrente, inscriptions, présences, planning (EPIC 4).
 */
import {
  COURSE_STATUS,
  ENROLLMENT_ENTITLEMENTS,
  ENROLLMENT_STATUS,
  formatDate,
  formatDateTime,
  NOTIFICATION_TYPES,
  ROLES,
} from '@equime/shared';

import { env } from '../config/env.js';
import { AppError } from '../lib/appError.js';
import { getFamilyIdForUser } from '../lib/family.js';
import { isLevelInRange } from '../lib/levels.js';
import { logger } from '../lib/logger.js';
import { buildSimpleNotificationEmail } from '../lib/mailer.js';
import { prisma } from '../lib/prisma.js';
import { assertRiderDocumentsApproved } from '../lib/riderDocuments.js';
import { isoWeekRange } from '../lib/weeks.js';

import {
  cancellationDeadline,
  creditExpiry,
  isCancelledInTime,
  resolveEntitlement,
} from './entitlementService.js';
import {
  assignHorsesForSession,
  listHorseOverrideOptions,
  overrideAssignedHorse,
} from './horseAssignment.js';
import { dispatchNotification } from './notificationService.js';
import { getPlanningCached, invalidatePlanningCache } from './planningCache.js';
import { expandWeeklyRecurrence } from './recurrence.js';
import { getClubSettings } from './settingsService.js';
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

/** Inscriptions qui occupent une place : ni annulées, ni excusées (ADR 011). */
const SEAT_TAKEN = { status: ENROLLMENT_STATUS.ACTIVE, attendance: { not: 'excused' } };
const SEAT_COUNT = { _count: { select: { enrollments: { where: SEAT_TAKEN } } } };

/** Notifications envoyées en parallèle par lot (borne la charge SendGrid et BDD). */
const NOTIFICATION_BATCH_SIZE = 5;

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
      ...SEAT_COUNT,
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
 * Lecture d'un cours. Les brouillons (`draft`) ne sont exposés qu'à un admin
 * ou au moniteur assigné (anti-IDOR) ; les appels internes sans `viewer`
 * (mutations admin) restent autorisés.
 *
 * @param {string} courseId
 * @param {{ id: string, role: string }} [viewer] Utilisateur authentifié (GET HTTP)
 */
export async function getCourse(courseId, viewer) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      ...COURSE_SELECT,
      instructor: { select: { id: true, firstName: true, lastName: true } },
      space: { select: { id: true, name: true, type: true } },
      ...SEAT_COUNT,
    },
  });
  if (!course) throw AppError.notFound('Cours introuvable');

  if (viewer && course.status === COURSE_STATUS.DRAFT) {
    const isAdmin = viewer.role === ROLES.ADMIN;
    const isAssignedInstructor =
      viewer.role === ROLES.INSTRUCTOR && course.instructorId === viewer.id;
    if (!isAdmin && !isAssignedInstructor) {
      throw AppError.notFound('Cours introuvable');
    }
  }

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
    where: { courseId: { in: cancelledCourseIds }, status: ENROLLMENT_STATUS.ACTIVE },
    include: {
      creditUsed: { select: { id: true, expiresAt: true } },
      rider: {
        include: {
          family: {
            select: {
              userId: true,
              user: { select: { firstName: true } },
            },
          },
        },
      },
      course: { select: { title: true, startAt: true } },
    },
  });

  const credited = await grantClubCancellationCredits(enrollments);

  await invalidatePlanningCache();

  /** @param {(typeof enrollments)[number]} enrollment */
  const notifyCancellation = (enrollment) => {
    const dateLabel = formatDateTime(enrollment.course.startAt);
    const title = enrollment.course.title;
    const firstName = enrollment.rider.family.user.firstName;
    const expiresAt = credited.get(enrollment.id);
    const creditLine = expiresAt
      ? `Un rattrapage est offert à ${enrollment.rider.firstName}, à utiliser avant le ${formatDate(expiresAt)}.`
      : null;
    return dispatchNotification({
      userId: enrollment.rider.family.userId,
      type: NOTIFICATION_TYPES.COURSE_CANCELLED,
      title: 'Cours annulé',
      body: [`Le cours « ${title} » du ${dateLabel} a été annulé.`, creditLine]
        .filter(Boolean)
        .join(' '),
      linkUrl: '/app/planning',
      email: buildSimpleNotificationEmail({
        firstName,
        subject: `Equime — Cours annulé : ${title}`,
        paragraphs: [
          `Le cours « ${title} » du ${dateLabel} a été annulé.`,
          ...(creditLine ? [creditLine] : []),
          'Consultez le planning pour les prochaines séances.',
        ],
        ctaUrl: `${env.APP_URL}/app/planning`,
        ctaLabel: 'Voir le planning',
      }),
    });
  };

  // Envoi par lots parallèles : une annulation de série (des dizaines
  // d'inscriptions) ne doit pas enchaîner les allers-retours SendGrid un à un.
  // L'annulation est déjà enregistrée : un échec de notification est tracé,
  // jamais propagé.
  for (let i = 0; i < enrollments.length; i += NOTIFICATION_BATCH_SIZE) {
    const batch = enrollments.slice(i, i + NOTIFICATION_BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(notifyCancellation));
    for (const result of results) {
      if (result.status === 'rejected') {
        logger.error({ err: result.reason, courseId }, "Échec de notification d'annulation");
      }
    }
  }
}

/**
 * Séance annulée par le club (ADR 011) : un crédit par inscrit. Un rattrapage
 * annulé rend le crédit consommé (prolongé si besoin) au lieu d'en créer un autre.
 * Idempotent : un seul crédit par inscription (`sourceEnrollmentId` unique).
 *
 * @param {Array<{ id: string, riderId: string, entitlement: string,
 *   course: { startAt: Date }, creditUsed: { id: string, expiresAt: Date } | null }>} enrollments
 * @returns {Promise<Map<string, Date>>} expiration du crédit par inscription
 */
async function grantClubCancellationCredits(enrollments) {
  /** @type {Map<string, Date>} */
  const credited = new Map();
  const eligible = enrollments.filter(
    (e) => e.entitlement !== ENROLLMENT_ENTITLEMENTS.FORCED && e.course.startAt > new Date()
  );
  if (eligible.length === 0) return credited;

  const { makeupValidityDays } = await getClubSettings();
  await prisma.$transaction(async (tx) => {
    for (const enrollment of eligible) {
      const expiresAt = creditExpiry(enrollment.course.startAt, makeupValidityDays);
      if (enrollment.entitlement === ENROLLMENT_ENTITLEMENTS.MAKEUP && enrollment.creditUsed) {
        const restoredExpiry =
          enrollment.creditUsed.expiresAt > expiresAt ? enrollment.creditUsed.expiresAt : expiresAt;
        await tx.sessionCredit.update({
          where: { id: enrollment.creditUsed.id },
          data: { usedAt: null, usedByEnrollmentId: null, expiresAt: restoredExpiry },
        });
        credited.set(enrollment.id, restoredExpiry);
        continue;
      }
      const { count } = await tx.sessionCredit.createMany({
        data: [
          {
            riderId: enrollment.riderId,
            source: 'club_cancellation',
            sourceEnrollmentId: enrollment.id,
            expiresAt,
          },
        ],
        skipDuplicates: true,
      });
      if (count > 0) credited.set(enrollment.id, expiresAt);
    }
  });
  return credited;
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
              some: {
                status: ENROLLMENT_STATUS.ACTIVE,
                rider: { family: { userId: params.userId } },
              },
            },
          }
        : {};

  return getPlanningCached(
    {
      from: params.from,
      to: params.to,
      scope: params.scope,
      userId: params.userId,
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

const RIDER_WITH_FAMILY = {
  family: {
    select: {
      userId: true,
      user: { select: { firstName: true } },
    },
  },
};

/**
 * Cavalier visible par l'acteur : toute la cavalerie pour l'admin, sa famille pour un client.
 * @param {string} userId
 * @param {string} riderId
 * @param {string | undefined} role
 */
async function findRiderForActor(userId, riderId, role) {
  const rider =
    role === ROLES.ADMIN
      ? await prisma.rider.findUnique({ where: { id: riderId }, include: RIDER_WITH_FAMILY })
      : await prisma.rider.findFirst({
          where: { id: riderId, familyId: await getFamilyIdForUser(userId) },
          include: RIDER_WITH_FAMILY,
        });
  if (!rider) throw AppError.notFound('Cavalier introuvable');
  return rider;
}

/**
 * Droit à consommer pour réactiver une inscription annulée à la même séance.
 * Une annulation tardive n'a rien rendu : le droit d'origine est repris tel quel.
 * Un crédit produit et encore disponible est retiré (retour à l'état d'avant).
 *
 * @param {any} tx
 * @param {{ id: string, entitlement: string,
 *   creditProduced: { id: string, usedAt: Date | null } | null,
 *   creditUsed: { id: string } | null }} existing
 * @returns {Promise<string | null>} droit repris, ou null pour appliquer les règles normales
 */
async function reclaimEntitlement(tx, existing) {
  const produced = existing.creditProduced;
  if (produced && !produced.usedAt) {
    await tx.sessionCredit.delete({ where: { id: produced.id } });
    return existing.entitlement;
  }
  if (!produced && existing.entitlement === ENROLLMENT_ENTITLEMENTS.SUBSCRIPTION) {
    return ENROLLMENT_ENTITLEMENTS.SUBSCRIPTION;
  }
  if (existing.entitlement === ENROLLMENT_ENTITLEMENTS.MAKEUP && existing.creditUsed) {
    return ENROLLMENT_ENTITLEMENTS.MAKEUP;
  }
  return null;
}

/**
 * Inscription d'un cavalier à une séance (ADR 011).
 * Consomme une séance du forfait (droit hebdomadaire) ou, au-delà, un crédit de
 * rattrapage. `force` (admin uniquement, Excel 10.4) contourne documents et droits,
 * jamais la capacité ; il est tracé dans le journal d'audit.
 *
 * @param {string} userId
 * @param {string} courseId
 * @param {string} riderId
 * @param {{ role: string, force?: boolean }} [options]
 */
export async function enrollRider(userId, courseId, riderId, options = {}) {
  const force = options.role === ROLES.ADMIN && options.force === true;
  const rider = await findRiderForActor(userId, riderId, options.role);

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course || course.status === COURSE_STATUS.CANCELLED) {
    throw AppError.notFound('Cours introuvable');
  }
  if (course.status === COURSE_STATUS.DRAFT) {
    throw AppError.badRequest("Ce cours n'est pas encore ouvert aux inscriptions");
  }
  if (course.startAt <= new Date()) {
    throw AppError.badRequest('Cette séance a déjà commencé');
  }
  // Documents valables à la date de la séance, pas seulement au jour de l'inscription
  if (!force) {
    assertRiderDocumentsApproved(rider, course.startAt);
  }
  if (!isLevelInRange(rider.level, course.minLevel, course.maxLevel)) {
    throw AppError.badRequest("Le niveau du cavalier n'est pas compatible avec ce cours");
  }

  const enrollment = await prisma.$transaction(async (tx) => {
    // Verrous : la séance (dernière place) puis le cavalier (droit de la semaine).
    await tx.$queryRaw`SELECT id FROM "courses" WHERE id = ${courseId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "riders" WHERE id = ${riderId} FOR UPDATE`;

    const existing = await tx.courseEnrollment.findUnique({
      where: { courseId_riderId: { courseId, riderId } },
      include: {
        creditProduced: { select: { id: true, usedAt: true } },
        creditUsed: { select: { id: true } },
      },
    });
    if (existing?.status === ENROLLMENT_STATUS.ACTIVE) {
      throw AppError.conflict('Ce cavalier est déjà inscrit à ce cours');
    }

    const overlapping = await tx.courseEnrollment.findFirst({
      where: {
        riderId,
        status: ENROLLMENT_STATUS.ACTIVE,
        courseId: { not: courseId },
        course: {
          status: { not: COURSE_STATUS.CANCELLED },
          startAt: { lt: course.endAt },
          endAt: { gt: course.startAt },
        },
      },
      select: { course: { select: { title: true } } },
    });
    if (overlapping) {
      throw AppError.conflict(
        `${rider.firstName} est déjà inscrit(e) sur ce créneau (« ${overlapping.course.title} »)`
      );
    }

    const seatsTaken = await tx.courseEnrollment.count({ where: { courseId, ...SEAT_TAKEN } });
    if (seatsTaken >= course.capacity) {
      throw AppError.conflict('Ce cours est complet');
    }

    /** @type {string} */
    let entitlement = ENROLLMENT_ENTITLEMENTS.FORCED;
    /** @type {string | null} */
    let creditId = null;
    if (!force) {
      const reclaimed = existing ? await reclaimEntitlement(tx, existing) : null;
      if (reclaimed) {
        entitlement = reclaimed;
      } else {
        const decision = await resolveEntitlement(tx, {
          rider,
          courseStartAt: course.startAt,
          excludeEnrollmentId: existing?.id,
        });
        entitlement = decision.entitlement;
        creditId = 'creditId' in decision ? decision.creditId : null;
      }
    }

    const data = {
      status: ENROLLMENT_STATUS.ACTIVE,
      entitlement,
      cancelledAt: null,
      attendance: 'pending',
      horseId: null,
      horseAssignedAt: null,
    };
    const include = { rider: { select: { firstName: true, lastName: true } } };
    const saved = existing
      ? await tx.courseEnrollment.update({ where: { id: existing.id }, data, include })
      : await tx.courseEnrollment.create({ data: { courseId, riderId, ...data }, include });

    if (creditId) {
      await tx.sessionCredit.update({
        where: { id: creditId },
        data: { usedAt: new Date(), usedByEnrollmentId: saved.id },
      });
    }
    if (force) {
      await tx.adminAuditLog.create({
        data: {
          adminId: userId,
          action: 'enrollment_forced',
          riderId,
          details: `Inscription forcée au cours « ${course.title} » du ${formatDateTime(course.startAt)}`,
        },
      });
    }
    return saved;
  });

  const detail =
    enrollment.entitlement === ENROLLMENT_ENTITLEMENTS.MAKEUP
      ? ' (rattrapage : 1 crédit utilisé)'
      : '';
  const body = `${rider.firstName} est inscrit(e) au cours « ${course.title} » du ${formatDateTime(course.startAt)}${detail}`;
  await dispatchNotification({
    userId: rider.family.userId,
    type: NOTIFICATION_TYPES.COURSE_ENROLLED,
    title: 'Inscription confirmée',
    body,
    linkUrl: '/app/planning',
    email: buildSimpleNotificationEmail({
      firstName: rider.family.user.firstName,
      subject: `Equime — Inscription confirmée : ${course.title}`,
      paragraphs: [body, 'Retrouvez le détail de la séance dans votre planning.'],
      ctaUrl: `${env.APP_URL}/app/planning`,
      ctaLabel: 'Voir le planning',
    }),
  });

  await invalidatePlanningCache();
  return enrollment;
}

/**
 * Annulation d'une inscription par la famille ou le secrétariat (ADR 011).
 * La place est libérée. Dans le délai du club, une séance du forfait devient un
 * crédit de rattrapage et un rattrapage rend son crédit ; après le délai, rien
 * n'est rendu. Une inscription forcée ne rend jamais de crédit.
 *
 * @param {{ id: string, role: string }} actor
 * @param {string} courseId
 * @param {string} enrollmentId
 */
export async function cancelEnrollment(actor, courseId, enrollmentId) {
  const enrollment = await prisma.courseEnrollment.findFirst({
    where: { id: enrollmentId, courseId },
    include: {
      rider: { include: RIDER_WITH_FAMILY },
      course: { select: { title: true, startAt: true, status: true } },
      creditUsed: { select: { id: true } },
    },
  });
  const isOwner = enrollment?.rider.family.userId === actor.id;
  if (!enrollment || (actor.role !== ROLES.ADMIN && !isOwner)) {
    throw AppError.notFound('Inscription introuvable');
  }
  if (enrollment.status === ENROLLMENT_STATUS.CANCELLED) {
    throw AppError.conflict('Cette inscription est déjà annulée');
  }
  if (enrollment.course.status === COURSE_STATUS.CANCELLED) {
    throw AppError.badRequest('Cette séance a été annulée par le club');
  }
  const now = new Date();
  if (enrollment.course.startAt <= now) {
    throw AppError.badRequest('Cette séance a déjà commencé');
  }

  const settings = await getClubSettings();
  const inTime = isCancelledInTime(
    enrollment.course.startAt,
    settings.cancellationDeadlineHours,
    now
  );

  const credit = await prisma.$transaction(async (tx) => {
    const { count } = await tx.courseEnrollment.updateMany({
      where: { id: enrollment.id, status: ENROLLMENT_STATUS.ACTIVE },
      data: {
        status: ENROLLMENT_STATUS.CANCELLED,
        cancelledAt: now,
        horseId: null,
        horseAssignedAt: null,
      },
    });
    if (count === 0) throw AppError.conflict('Cette inscription est déjà annulée');
    if (!inTime) return null;

    if (enrollment.entitlement === ENROLLMENT_ENTITLEMENTS.SUBSCRIPTION) {
      return tx.sessionCredit.create({
        data: {
          riderId: enrollment.riderId,
          source: 'cancelled_in_time',
          sourceEnrollmentId: enrollment.id,
          expiresAt: creditExpiry(enrollment.course.startAt, settings.makeupValidityDays),
        },
        select: { id: true, expiresAt: true },
      });
    }
    if (enrollment.entitlement === ENROLLMENT_ENTITLEMENTS.MAKEUP && enrollment.creditUsed) {
      return tx.sessionCredit.update({
        where: { id: enrollment.creditUsed.id },
        data: { usedAt: null, usedByEnrollmentId: null },
        select: { id: true, expiresAt: true },
      });
    }
    return null;
  });

  await invalidatePlanningCache();

  const { title, startAt } = enrollment.course;
  const outcome = credit
    ? `Un rattrapage est disponible jusqu'au ${formatDate(credit.expiresAt)}.`
    : inTime
      ? null
      : `L'annulation a lieu moins de ${settings.cancellationDeadlineHours} h avant la séance : elle ne donne pas droit à un rattrapage.`;
  const body = [
    `L'inscription de ${enrollment.rider.firstName} au cours « ${title} » du ${formatDateTime(startAt)} est annulée.`,
    outcome,
  ]
    .filter(Boolean)
    .join(' ');
  await dispatchNotification({
    userId: enrollment.rider.family.userId,
    type: NOTIFICATION_TYPES.RIDER_ABSENCE,
    title: 'Séance annulée',
    body,
    linkUrl: '/app/planning',
    email: buildSimpleNotificationEmail({
      firstName: enrollment.rider.family.user.firstName,
      subject: `Equime — Annulation : ${title}`,
      paragraphs: [body],
      ctaUrl: `${env.APP_URL}/app/planning`,
      ctaLabel: 'Voir le planning',
    }),
  });

  return { enrollmentId: enrollment.id, inTime, credit };
}

/**
 * @param {string} courseId
 */
export async function listEnrollments(courseId) {
  await getCourse(courseId);
  return prisma.courseEnrollment.findMany({
    where: { courseId, status: ENROLLMENT_STATUS.ACTIVE },
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
 */
export async function updateAttendance(courseId, enrollmentId, attendance) {
  const enrollment = await prisma.courseEnrollment.findFirst({
    where: { id: enrollmentId, courseId },
    include: {
      rider: {
        include: {
          family: {
            select: {
              userId: true,
              user: { select: { firstName: true } },
            },
          },
        },
      },
      course: { select: { title: true, startAt: true } },
    },
  });
  if (!enrollment || enrollment.status !== ENROLLMENT_STATUS.ACTIVE) {
    throw AppError.notFound('Inscription introuvable');
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

  if (attendance === 'absent' && previous !== 'absent') {
    const body = `${enrollment.rider.firstName} a été marqué(e) absent(e) au cours « ${enrollment.course.title} »`;
    await dispatchNotification({
      userId: enrollment.rider.family.userId,
      type: NOTIFICATION_TYPES.RIDER_ABSENCE,
      title: 'Absence signalée',
      body,
      linkUrl: '/app/planning',
      email: buildSimpleNotificationEmail({
        firstName: enrollment.rider.family.user.firstName,
        subject: `Equime — Absence signalée : ${enrollment.course.title}`,
        paragraphs: [body, 'Vous pouvez consulter le planning depuis votre espace Equime.'],
        ctaUrl: `${env.APP_URL}/app/planning`,
        ctaLabel: 'Voir le planning',
      }),
    });
  }

  return updated;
}

/**
 * Inscriptions à venir de la famille, avec la limite d'annulation avec rattrapage.
 * @param {string} userId
 */
export async function listFamilyUpcomingEnrollments(userId) {
  const familyId = await getFamilyIdForUser(userId);
  const { cancellationDeadlineHours } = await getClubSettings();
  const rows = await prisma.courseEnrollment.findMany({
    where: {
      status: ENROLLMENT_STATUS.ACTIVE,
      rider: { familyId },
      course: {
        startAt: { gt: new Date() },
        status: { notIn: [COURSE_STATUS.DRAFT, COURSE_STATUS.CANCELLED] },
      },
    },
    include: {
      rider: { select: { id: true, firstName: true, lastName: true } },
      horse: { select: { id: true, name: true } },
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
    entitlement: row.entitlement,
    cancellationDeadline: cancellationDeadline(row.course.startAt, cancellationDeadlineHours),
    horse: row.horse,
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

/** Fenêtre de réservation affichée à la famille. */
const ENROLLABLE_WINDOW_MS = 8 * 7 * 24 * 60 * 60 * 1000;

/**
 * Droit qui serait consommé pour chaque séance (indication, recalculée à l'inscription).
 * @param {string} riderId
 * @param {Array<{ startAt: Date }>} courses
 * @param {Date} now
 */
async function entitlementHints(riderId, courses, now) {
  if (courses.length === 0) return () => ({ entitlement: null, refusal: null });
  const windowStart = isoWeekRange(now).start;
  const windowEnd = courses[courses.length - 1].startAt;

  const [subscriptions, weekSessions, credits] = await Promise.all([
    prisma.riderSubscription.findMany({
      where: {
        riderId,
        seasonEnd: { gt: now },
        OR: [{ status: 'active' }, { endedAt: { gt: now } }],
      },
      select: {
        seasonStart: true,
        seasonEnd: true,
        endedAt: true,
        plan: { select: { sessionsPerWeek: true } },
      },
    }),
    prisma.courseEnrollment.findMany({
      where: {
        riderId,
        entitlement: ENROLLMENT_ENTITLEMENTS.SUBSCRIPTION,
        course: { startAt: { gte: windowStart, lte: windowEnd } },
      },
      select: { course: { select: { startAt: true } } },
    }),
    prisma.sessionCredit.findMany({
      where: { riderId, usedAt: null, expiresAt: { gt: now } },
      select: { expiresAt: true },
    }),
  ]);

  /** @type {Map<number, number>} */
  const usedByWeek = new Map();
  for (const { course } of weekSessions) {
    const key = isoWeekRange(course.startAt).start.getTime();
    usedByWeek.set(key, (usedByWeek.get(key) ?? 0) + 1);
  }

  /** @param {{ startAt: Date }} course */
  return (course) => {
    const subscription = subscriptions.find(
      (s) =>
        s.seasonStart <= course.startAt &&
        s.seasonEnd > course.startAt &&
        (!s.endedAt || s.endedAt > course.startAt)
    );
    const used = usedByWeek.get(isoWeekRange(course.startAt).start.getTime()) ?? 0;
    if (subscription && used < subscription.plan.sessionsPerWeek) {
      return { entitlement: ENROLLMENT_ENTITLEMENTS.SUBSCRIPTION, refusal: null };
    }
    if (credits.some((c) => c.expiresAt > course.startAt)) {
      return { entitlement: ENROLLMENT_ENTITLEMENTS.MAKEUP, refusal: null };
    }
    return { entitlement: null, refusal: subscription ? 'week_full' : 'no_subscription' };
  };
}

/**
 * Séances ouvertes à la réservation sur les 8 prochaines semaines (ADR 011).
 * Avec `riderId` : séances du niveau du cavalier, hors celles où il est déjà
 * inscrit, avec le droit qui serait consommé. Sans : toute la famille.
 *
 * @param {string} userId
 * @param {string} [riderId]
 */
export async function listEnrollableCourses(userId, riderId) {
  const familyId = await getFamilyIdForUser(userId);
  const riders = await prisma.rider.findMany({
    where: { familyId, ...(riderId ? { id: riderId } : {}) },
    select: { id: true, level: true },
  });
  if (riderId && riders.length === 0) throw AppError.notFound('Cavalier introuvable');
  if (riders.length === 0) return [];

  const now = new Date();
  const courses = await prisma.course.findMany({
    where: {
      status: COURSE_STATUS.SCHEDULED,
      startAt: { gt: now, lt: new Date(now.getTime() + ENROLLABLE_WINDOW_MS) },
      ...(riderId ? { enrollments: { none: { riderId, status: ENROLLMENT_STATUS.ACTIVE } } } : {}),
    },
    include: {
      ...SEAT_COUNT,
      space: { select: { name: true } },
      instructor: { select: { firstName: true, lastName: true } },
    },
    orderBy: { startAt: 'asc' },
  });

  const open = courses.filter(
    (c) =>
      c._count.enrollments < c.capacity &&
      riders.some((r) => isLevelInRange(r.level, c.minLevel, c.maxLevel))
  );
  const hint = riderId ? await entitlementHints(riderId, open, now) : null;

  return open.map((c) => ({
    id: c.id,
    title: c.title,
    startAt: c.startAt,
    endAt: c.endAt,
    minLevel: c.minLevel,
    maxLevel: c.maxLevel,
    capacity: c.capacity,
    enrolledCount: c._count.enrollments,
    remainingSpots: c.capacity - c._count.enrollments,
    spaceName: c.space.name,
    instructorName: `${c.instructor.firstName} ${c.instructor.lastName}`,
    // Lundi de la semaine (heure de Paris) : regroupement par semaine côté famille
    weekStart: isoWeekRange(c.startAt).start,
    ...(hint ? hint(c) : {}),
  }));
}
