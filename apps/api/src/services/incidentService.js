// @ts-check
/**
 * Service incidents — déclaration moniteur, suivi admin.
 */
import { AppError } from '../lib/appError.js';
import { prisma } from '../lib/prisma.js';

const INCIDENT_SELECT = {
  id: true,
  reportedById: true,
  courseId: true,
  horseId: true,
  riderId: true,
  severity: true,
  description: true,
  status: true,
  occurredAt: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
  reportedBy: { select: { id: true, firstName: true, lastName: true } },
  horse: { select: { id: true, name: true } },
  rider: { select: { id: true, firstName: true, lastName: true } },
  course: { select: { id: true, title: true } },
};

/**
 * @param {string} reporterId
 * @param {{ courseId?: string, horseId?: string, riderId?: string, severity: string, description: string, occurredAt: Date }} input
 */
export async function createIncident(reporterId, input) {
  const [course, horse, rider] = await Promise.all([
    input.courseId ? prisma.course.findUnique({ where: { id: input.courseId }, select: { id: true } }) : null,
    input.horseId ? prisma.horse.findUnique({ where: { id: input.horseId }, select: { id: true } }) : null,
    input.riderId ? prisma.rider.findUnique({ where: { id: input.riderId }, select: { id: true } }) : null,
  ]);

  if (input.courseId && !course) throw AppError.notFound('Cours introuvable');
  if (input.horseId && !horse) throw AppError.notFound('Cheval introuvable');
  if (input.riderId && !rider) throw AppError.notFound('Cavalier introuvable');

  return prisma.incident.create({
    data: {
      reportedById: reporterId,
      courseId: input.courseId ?? null,
      horseId: input.horseId ?? null,
      riderId: input.riderId ?? null,
      severity: input.severity,
      description: input.description,
      occurredAt: input.occurredAt,
    },
    select: INCIDENT_SELECT,
  });
}

/** @param {{ status?: string, severity?: string }} filters */
export function listIncidents(filters = {}) {
  return prisma.incident.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.severity ? { severity: filters.severity } : {}),
    },
    select: INCIDENT_SELECT,
    orderBy: [{ status: 'asc' }, { occurredAt: 'desc' }],
  });
}

export async function countCriticalOpenIncidents() {
  return prisma.incident.count({
    where: { status: 'open', severity: 'critical' },
  });
}

/** @param {string} incidentId */
export async function resolveIncident(incidentId) {
  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  if (!incident) throw AppError.notFound('Incident introuvable');
  if (incident.status === 'resolved') {
    return prisma.incident.findUniqueOrThrow({
      where: { id: incidentId },
      select: INCIDENT_SELECT,
    });
  }

  return prisma.incident.update({
    where: { id: incidentId },
    data: { status: 'resolved', resolvedAt: new Date() },
    select: INCIDENT_SELECT,
  });
}
