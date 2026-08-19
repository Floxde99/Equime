// @ts-check
/**
 * Attribution des chevaux — scoring pur + orchestration transactionnelle (EPIC 5).
 */
import { AppError } from '../lib/appError.js';
import { isLevelInRange } from '../lib/levels.js';
import { prisma } from '../lib/prisma.js';

import { invalidatePlanningCache } from './planningCache.js';

/**
 * Durée en heures d'un créneau (cours ou stage), jamais négative.
 * @param {Date} startAt
 * @param {Date} endAt
 */
export function durationHoursFromRange(startAt, endAt) {
  return Math.max(0, (endAt.getTime() - startAt.getTime()) / (60 * 60 * 1000));
}

/**
 * @param {{ rider: { level: string }, horse: { minLevel: string, maxLevel: string, weeklyLoadHours: number },
 * affinity?: string | null }} input
 */
export function scoreRiderHorse({ rider, horse, affinity }) {
  let score = 0;

  if (affinity === 'favorite') score += 10;
  if (affinity === 'avoid') score -= 15;
  if (isLevelInRange(rider.level, horse.minLevel, horse.maxLevel)) score += 5;

  score -= horse.weeklyLoadHours * 5;
  return score;
}

/** @param {{ status: string, weeklyLoadHours: number, maxWeeklyLoadHours: number }} horse */
function isEligibleHorse(horse) {
  return horse.status === 'fit' && horse.weeklyLoadHours < horse.maxWeeklyLoadHours;
}

/**
 * @param {{ rider: { level: string }, horses: Array<any>, affinitiesByHorseId: Map<string, string>, takenHorseIds: Set<string> }} input
 */
export function rankCandidateHorses({ rider, horses, affinitiesByHorseId, takenHorseIds }) {
  return horses
    .filter((horse) => isEligibleHorse(horse))
    .filter((horse) => !takenHorseIds.has(horse.id))
    .map((horse) => ({
      horse,
      affinity: affinitiesByHorseId.get(horse.id) ?? 'neutral',
      score: scoreRiderHorse({
        rider,
        horse,
        affinity: affinitiesByHorseId.get(horse.id) ?? 'neutral',
      }),
      levelCompatible: isLevelInRange(rider.level, horse.minLevel, horse.maxLevel),
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.horse.weeklyLoadHours - b.horse.weeklyLoadHours ||
        a.horse.name.localeCompare(b.horse.name, 'fr') ||
        a.horse.id.localeCompare(b.horse.id, 'fr')
    );
}

/**
 * @param {{ course: { startAt: Date, endAt: Date }, enrollments: Array<any>, horses: Array<any>, affinities: Array<any> }} input
 */
export function simulateHorseAssignments({ course, enrollments, horses, affinities }) {
  const durationHours = durationHoursFromRange(course.startAt, course.endAt);
  const takenHorseIds = new Set(
    enrollments.map((enrollment) => enrollment.horseId).filter(Boolean)
  );
  const assignments = [];
  const conflicts = [];

  for (const enrollment of enrollments) {
    if (enrollment.horseId) continue;

    const affinitiesByHorseId = new Map(
      affinities
        .filter((affinity) => affinity.riderId === enrollment.rider.id)
        .map((affinity) => [affinity.horseId, affinity.affinity])
    );
    const ranked = rankCandidateHorses({
      rider: enrollment.rider,
      horses,
      affinitiesByHorseId,
      takenHorseIds,
    });

    if (ranked.length === 0) {
      conflicts.push({
        enrollmentId: enrollment.id,
        riderId: enrollment.rider.id,
        riderName: `${enrollment.rider.firstName} ${enrollment.rider.lastName}`,
        reason: 'Aucun cheval eligible disponible',
      });
      continue;
    }

    const [selected] = ranked;
    takenHorseIds.add(selected.horse.id);
    assignments.push({
      enrollmentId: enrollment.id,
      riderId: enrollment.rider.id,
      riderName: `${enrollment.rider.firstName} ${enrollment.rider.lastName}`,
      horse: selected.horse,
      score: selected.score,
      affinity: selected.affinity,
      durationHours,
      candidates: ranked.map((entry) => ({
        horseId: entry.horse.id,
        horseName: entry.horse.name,
        score: entry.score,
        affinity: entry.affinity,
        warning: entry.affinity === 'avoid' ? 'Affinite a eviter' : null,
      })),
    });
  }

  return { assignments, conflicts, durationHours };
}

export const assignmentWriter = {
  /**
   * Persiste une attribution au sein d'une transaction Prisma.
   * @param {typeof prisma} tx
   * @param {{ enrollmentId: string, horse: { id: string } }} assignment
   * @param {number} durationHours
   */
  async apply(tx, assignment, durationHours) {
    await tx.courseEnrollment.update({
      where: { id: assignment.enrollmentId },
      data: {
        horseId: assignment.horse.id,
        horseAssignedAt: new Date(),
      },
    });
    await tx.horse.update({
      where: { id: assignment.horse.id },
      data: { weeklyLoadHours: { increment: durationHours } },
    });
  },
  /**
   * Persiste une attribution de stage (Excel 11.2).
   * @param {typeof prisma} tx
   * @param {{ enrollmentId: string, horse: { id: string } }} assignment
   * @param {number} durationHours
   */
  async applyEvent(tx, assignment, durationHours) {
    await tx.eventRegistration.update({
      where: { id: assignment.enrollmentId },
      data: { horseId: assignment.horse.id },
    });
    await tx.horse.update({
      where: { id: assignment.horse.id },
      data: { weeklyLoadHours: { increment: durationHours } },
    });
  },
};

async function loadAssignmentContext(courseId, db = prisma) {
  const course = await db.course.findUnique({
    where: { id: courseId },
    include: {
      enrollments: {
        include: {
          rider: { select: { id: true, firstName: true, lastName: true, level: true } },
          horse: { select: { id: true, name: true, photoUrl: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!course) throw AppError.notFound('Cours introuvable');

  const horses = await db.horse.findMany({
    select: {
      id: true,
      name: true,
      status: true,
      minLevel: true,
      maxLevel: true,
      weeklyLoadHours: true,
      maxWeeklyLoadHours: true,
    },
    orderBy: { name: 'asc' },
  });

  const riderIds = course.enrollments.map((enrollment) => enrollment.riderId);
  const affinities =
    riderIds.length === 0
      ? []
      : await db.horseAffinity.findMany({
          where: { riderId: { in: riderIds } },
          select: { riderId: true, horseId: true, affinity: true },
        });

  return { course, enrollments: course.enrollments, horses, affinities };
}

/**
 * @param {string} courseId
 */
export async function assignHorsesForSession(courseId) {
  const result = await prisma.$transaction(async (tx) => {
    const context = await loadAssignmentContext(courseId, tx);
    const simulation = simulateHorseAssignments(context);

    for (const assignment of simulation.assignments) {
      await assignmentWriter.apply(tx, assignment, simulation.durationHours);
    }

    return simulation;
  });

  await invalidatePlanningCache();
  return result;
}

/**
 * @param {string} courseId
 */
export async function runCompatibilityAudit(courseId = undefined) {
  const courses = await prisma.course.findMany({
    where: {
      status: 'scheduled',
      startAt: { gte: new Date() },
      ...(courseId ? { id: courseId } : {}),
    },
    select: { id: true },
    orderBy: { startAt: 'asc' },
  });

  const report = [];
  for (const course of courses) {
    const context = await loadAssignmentContext(course.id);
    const simulation = simulateHorseAssignments(context);
    report.push({
      courseId: context.course.id,
      courseTitle: context.course.title,
      startAt: context.course.startAt,
      endAt: context.course.endAt,
      assignments: simulation.assignments,
      conflicts: simulation.conflicts,
      missingHorseCount: simulation.conflicts.length,
    });
  }
  return report;
}

/**
 * @param {string} courseId
 * @param {string} enrollmentId
 */
export async function listHorseOverrideOptions(courseId, enrollmentId) {
  const context = await loadAssignmentContext(courseId);
  const enrollment = context.course.enrollments.find((entry) => entry.id === enrollmentId);
  if (!enrollment) throw AppError.notFound('Inscription introuvable');

  const takenHorseIds = new Set(
    context.course.enrollments
      .filter((entry) => entry.id !== enrollmentId)
      .map((entry) => entry.horseId)
      .filter(Boolean)
  );
  const affinitiesByHorseId = new Map(
    context.affinities
      .filter((affinity) => affinity.riderId === enrollment.rider.id)
      .map((affinity) => [affinity.horseId, affinity.affinity])
  );

  return rankCandidateHorses({
    rider: enrollment.rider,
    horses: context.horses,
    affinitiesByHorseId,
    takenHorseIds,
  }).map((entry) => ({
    horseId: entry.horse.id,
    horseName: entry.horse.name,
    score: entry.score,
    affinity: entry.affinity,
    warning: entry.affinity === 'avoid' ? 'Affinite a eviter' : null,
  }));
}

/**
 * @param {string} courseId
 * @param {string} enrollmentId
 * @param {string} horseId
 */
export async function overrideAssignedHorse(courseId, enrollmentId, horseId) {
  const updated = await prisma.$transaction(async (tx) => {
    const course = await tx.course.findUnique({
      where: { id: courseId },
      include: {
        enrollments: {
          include: {
            rider: { select: { id: true, firstName: true, lastName: true, level: true } },
          },
        },
      },
    });
    if (!course) throw AppError.notFound('Cours introuvable');

    const enrollment = course.enrollments.find((entry) => entry.id === enrollmentId);
    if (!enrollment) throw AppError.notFound('Inscription introuvable');

    const options = await listHorseOverrideOptions(courseId, enrollmentId);
    const selected = options.find((option) => option.horseId === horseId);
    if (!selected) throw AppError.badRequest('Cheval non disponible pour cet override');

    const durationHours = durationHoursFromRange(course.startAt, course.endAt);

    if (enrollment.horseId && enrollment.horseId !== horseId) {
      await tx.horse.update({
        where: { id: enrollment.horseId },
        data: { weeklyLoadHours: { decrement: durationHours } },
      });
    }

    if (enrollment.horseId !== horseId) {
      await tx.horse.update({
        where: { id: horseId },
        data: { weeklyLoadHours: { increment: durationHours } },
      });
    }

    return tx.courseEnrollment.update({
      where: { id: enrollmentId },
      data: { horseId, horseAssignedAt: new Date() },
      include: {
        rider: { select: { id: true, firstName: true, lastName: true, level: true } },
        horse: { select: { id: true, name: true, photoUrl: true } },
      },
    });
  });

  await invalidatePlanningCache();
  return updated;
}

const EVENT_HORSE_SELECT = {
  id: true,
  name: true,
  status: true,
  minLevel: true,
  maxLevel: true,
  weeklyLoadHours: true,
  maxWeeklyLoadHours: true,
};

async function loadEventAssignmentContext(eventId, db = prisma) {
  const event = await db.event.findUnique({
    where: { id: eventId },
    include: {
      registrations: {
        where: { status: { not: 'cancelled' } },
        include: {
          rider: { select: { id: true, firstName: true, lastName: true, level: true } },
          horse: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!event) throw AppError.notFound('Événement introuvable');

  const horses = await db.horse.findMany({
    select: EVENT_HORSE_SELECT,
    orderBy: { name: 'asc' },
  });

  const riderIds = event.registrations.map((registration) => registration.riderId);
  const affinities =
    riderIds.length === 0
      ? []
      : await db.horseAffinity.findMany({
          where: { riderId: { in: riderIds } },
          select: { riderId: true, horseId: true, affinity: true },
        });

  return {
    course: event,
    enrollments: event.registrations,
    horses,
    affinities,
  };
}

/**
 * Attribution automatique des chevaux d'un stage (Excel 11.2).
 * @param {string} eventId
 */
export async function assignHorsesForEvent(eventId) {
  return prisma.$transaction(async (tx) => {
    const context = await loadEventAssignmentContext(eventId, tx);
    const simulation = simulateHorseAssignments(context);

    for (const assignment of simulation.assignments) {
      await assignmentWriter.applyEvent(tx, assignment, simulation.durationHours);
    }

    return simulation;
  });
}

/**
 * @param {string} eventId
 * @param {string} registrationId
 */
export async function listEventHorseOverrideOptions(eventId, registrationId) {
  const context = await loadEventAssignmentContext(eventId);
  const enrollment = context.enrollments.find((entry) => entry.id === registrationId);
  if (!enrollment) throw AppError.notFound('Inscription introuvable');

  const takenHorseIds = new Set(
    context.enrollments
      .filter((entry) => entry.id !== registrationId)
      .map((entry) => entry.horseId)
      .filter(Boolean)
  );
  const affinitiesByHorseId = new Map(
    context.affinities
      .filter((affinity) => affinity.riderId === enrollment.rider.id)
      .map((affinity) => [affinity.horseId, affinity.affinity])
  );

  return rankCandidateHorses({
    rider: enrollment.rider,
    horses: context.horses,
    affinitiesByHorseId,
    takenHorseIds,
  }).map((entry) => ({
    horseId: entry.horse.id,
    horseName: entry.horse.name,
    score: entry.score,
    affinity: entry.affinity,
    warning: entry.affinity === 'avoid' ? 'Affinite a eviter' : null,
  }));
}

/**
 * Override admin d'une monture de stage (Excel 11.2 / 11.6).
 * @param {string} eventId
 * @param {string} registrationId
 * @param {string} horseId
 */
export async function overrideEventAssignedHorse(eventId, registrationId, horseId) {
  return prisma.$transaction(async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: eventId },
      include: {
        registrations: {
          where: { status: { not: 'cancelled' } },
          include: {
            rider: { select: { id: true, firstName: true, lastName: true, level: true } },
          },
        },
      },
    });
    if (!event) throw AppError.notFound('Événement introuvable');

    const registration = event.registrations.find((entry) => entry.id === registrationId);
    if (!registration) throw AppError.notFound('Inscription introuvable');

    const options = await listEventHorseOverrideOptions(eventId, registrationId);
    const selected = options.find((option) => option.horseId === horseId);
    if (!selected) throw AppError.badRequest('Cheval non disponible pour cet override');

    const durationHours = durationHoursFromRange(event.startAt, event.endAt);

    if (registration.horseId && registration.horseId !== horseId) {
      await tx.horse.update({
        where: { id: registration.horseId },
        data: { weeklyLoadHours: { decrement: durationHours } },
      });
    }

    if (registration.horseId !== horseId) {
      await tx.horse.update({
        where: { id: horseId },
        data: { weeklyLoadHours: { increment: durationHours } },
      });
    }

    return tx.eventRegistration.update({
      where: { id: registrationId },
      data: { horseId },
      include: {
        rider: { select: { id: true, firstName: true, lastName: true, level: true } },
        horse: { select: { id: true, name: true } },
      },
    });
  });
}
