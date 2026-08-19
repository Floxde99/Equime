// @ts-check
/**
 * Service événements — vitrine publique, CRUD admin et inscriptions client.
 */
import { NOTIFICATION_TYPES, ROLES } from '@equime/shared';

import { AppError } from '../lib/appError.js';
import { getFamilyIdForUser } from '../lib/family.js';
import { prisma } from '../lib/prisma.js';
import { assertRiderDocumentsApproved } from '../lib/riderDocuments.js';

import { createSentInvoiceForEventRegistration } from './billingService.js';
import {
  assignHorsesForEvent,
  durationHoursFromRange,
  listEventHorseOverrideOptions,
  overrideEventAssignedHorse,
} from './horseAssignment.js';
import { dispatchNotification } from './notificationService.js';

const EVENT_SELECT = {
  id: true,
  title: true,
  description: true,
  type: true,
  startAt: true,
  endAt: true,
  capacity: true,
  priceCents: true,
  location: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { registrations: { where: { status: { not: 'cancelled' } } } } },
};

function formatEvent(event) {
  return {
    ...event,
    registeredCount: event._count.registrations,
  };
}

const REGISTRATION_LIST_INCLUDE = {
  rider: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      family: { select: { userId: true } },
    },
  },
  horse: { select: { id: true, name: true } },
};

const ADMIN_EVENT_SELECT = {
  ...EVENT_SELECT,
  registrations: {
    where: { status: { not: 'cancelled' } },
    select: {
      id: true,
      status: true,
      horseId: true,
      rider: { select: { id: true, firstName: true, lastName: true } },
      horse: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  },
};

export async function listPublicEvents() {
  const events = await prisma.event.findMany({
    where: { startAt: { gt: new Date() } },
    select: EVENT_SELECT,
    orderBy: { startAt: 'asc' },
  });
  return events.map(formatEvent);
}

export async function listAdminEvents() {
  const events = await prisma.event.findMany({
    select: ADMIN_EVENT_SELECT,
    orderBy: { startAt: 'asc' },
  });
  return events.map(formatEvent);
}

/** @param {object} input */
export async function createEvent(input) {
  const event = await prisma.event.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      type: input.type,
      startAt: input.startAt,
      endAt: input.endAt,
      capacity: input.capacity,
      priceCents: input.priceCents ?? 0,
      location: input.location ?? null,
    },
    select: EVENT_SELECT,
  });
  return formatEvent(event);
}

/** @param {string} eventId @param {Partial<object>} input */
export async function updateEvent(eventId, input) {
  await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
  const event = await prisma.event.update({
    where: { id: eventId },
    data: input,
    select: EVENT_SELECT,
  });
  return formatEvent(event);
}

/** @param {string} eventId */
export async function deleteEvent(eventId) {
  await prisma.event.delete({ where: { id: eventId } });
}

/** @param {string} eventId */
export async function listEventRegistrations(eventId) {
  await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
  return prisma.eventRegistration.findMany({
    where: { eventId },
    include: REGISTRATION_LIST_INCLUDE,
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * @param {string} userId
 * @param {string} eventId
 * @param {string} riderId
 * @param {{ role: string, force?: boolean }} [options] `force` n'est honoré que pour un admin (Excel 10.4).
 */
export async function registerRider(userId, eventId, riderId, options = {}) {
  const force = options.role === ROLES.ADMIN && options.force === true;
  const riderSelect = {
    id: true,
    firstName: true,
    lastName: true,
    medicalCertificateStatus: true,
    licenseStatus: true,
    medicalCertificateExpiresAt: true,
    licenseExpiresAt: true,
    family: { select: { id: true, userId: true } },
  };

  const rider =
    options.role === ROLES.ADMIN
      ? await prisma.rider.findUnique({
          where: { id: riderId },
          select: riderSelect,
        })
      : await prisma.rider.findFirst({
          where: { id: riderId, familyId: await getFamilyIdForUser(userId) },
          select: riderSelect,
        });
  if (!rider) throw AppError.notFound('Cavalier introuvable');

  if (!force) {
    assertRiderDocumentsApproved(rider);
  }

  const existing = await prisma.eventRegistration.findUnique({
    where: { eventId_riderId: { eventId, riderId } },
  });
  if (existing && existing.status !== 'cancelled') {
    throw AppError.conflict('Ce cavalier est déjà inscrit à cet événement');
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { _count: { select: { registrations: { where: { status: { not: 'cancelled' } } } } } },
  });
  if (!event || event.startAt <= new Date()) {
    throw AppError.notFound('Événement introuvable');
  }

  if (event._count.registrations >= event.capacity) {
    throw AppError.conflict('Cet événement est complet');
  }

  const registration = await prisma.eventRegistration.upsert({
    where: { eventId_riderId: { eventId, riderId } },
    create: {
      eventId,
      riderId,
      status: 'confirmed',
    },
    update: {
      status: 'confirmed',
    },
    include: {
      rider: { select: { id: true, firstName: true, lastName: true } },
      event: { select: { id: true, title: true, startAt: true } },
      horse: { select: { id: true, name: true } },
    },
  });

  await createSentInvoiceForEventRegistration({
    familyId: rider.family.id,
    registrationId: registration.id,
    riderName: `${rider.firstName} ${rider.lastName}`,
    eventTitle: event.title,
    priceCents: event.priceCents,
    dueAt: event.startAt,
  });

  await dispatchNotification({
    userId: rider.family.userId,
    type: NOTIFICATION_TYPES.REGISTRATION_CONFIRMED,
    title: 'Inscription à l’événement confirmée',
    body: `${rider.firstName} est inscrit(e) à « ${event.title} »`,
    linkUrl: '/app/evenements',
    email: {
      subject: 'Equime — Inscription événement confirmée',
      text: [
        `Bonjour,`,
        '',
        `${rider.firstName} ${rider.lastName} est inscrit(e) à l'événement « ${event.title} ».`,
        `Début : ${event.startAt.toLocaleString('fr-FR')}.`,
      ].join('\n'),
      html: [
        '<p>Bonjour,</p>',
        `<p>${rider.firstName} ${rider.lastName} est inscrit(e) à l'événement <strong>${event.title}</strong>.</p>`,
        `<p>Début : ${event.startAt.toLocaleString('fr-FR')}</p>`,
      ].join('\n'),
    },
  });

  await assignHorsesForEvent(eventId);

  return prisma.eventRegistration.findUniqueOrThrow({
    where: { id: registration.id },
    include: {
      rider: { select: { id: true, firstName: true, lastName: true } },
      event: { select: { id: true, title: true, startAt: true } },
      horse: { select: { id: true, name: true } },
    },
  });
}

/**
 * @param {string} eventId
 */
export async function assignHorses(eventId) {
  return assignHorsesForEvent(eventId);
}

/**
 * @param {string} eventId
 * @param {string} registrationId
 */
export async function listHorseOptions(eventId, registrationId) {
  return listEventHorseOverrideOptions(eventId, registrationId);
}

/**
 * @param {string} eventId
 * @param {string} registrationId
 * @param {string} horseId
 */
export async function overrideHorse(eventId, registrationId, horseId) {
  return overrideEventAssignedHorse(eventId, registrationId, horseId);
}

/**
 * Annule une inscription et retire la charge cheval (Excel 11.2).
 *
 * @param {string} userId
 * @param {string} eventId
 * @param {string} registrationId
 * @param {{ role: string }} options
 */
export async function cancelRegistration(userId, eventId, registrationId, options = {}) {
  const registration = await prisma.eventRegistration.findFirst({
    where: { id: registrationId, eventId },
    include: {
      rider: { select: { familyId: true } },
      event: { select: { startAt: true, endAt: true } },
    },
  });
  if (!registration) throw AppError.notFound('Inscription introuvable');

  if (options.role !== ROLES.ADMIN) {
    const familyId = await getFamilyIdForUser(userId);
    if (registration.rider.familyId !== familyId) {
      throw AppError.notFound('Inscription introuvable');
    }
  }

  if (registration.status === 'cancelled') {
    return prisma.eventRegistration.findUniqueOrThrow({
      where: { id: registrationId },
      include: REGISTRATION_LIST_INCLUDE,
    });
  }

  return prisma.$transaction(async (tx) => {
    if (registration.horseId) {
      const durationHours = durationHoursFromRange(registration.event.startAt, registration.event.endAt);
      await tx.horse.update({
        where: { id: registration.horseId },
        data: { weeklyLoadHours: { decrement: durationHours } },
      });
    }

    return tx.eventRegistration.update({
      where: { id: registrationId },
      data: { status: 'cancelled', horseId: null },
      include: REGISTRATION_LIST_INCLUDE,
    });
  });
}
