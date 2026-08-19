// @ts-check
/**
 * Service événements — vitrine publique, CRUD admin et inscriptions client.
 */
import { NOTIFICATION_TYPES } from '@equime/shared';

import { AppError } from '../lib/appError.js';
import { getFamilyIdForUser } from '../lib/family.js';
import { prisma } from '../lib/prisma.js';

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
    select: EVENT_SELECT,
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
    include: {
      rider: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          family: { select: { userId: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * @param {string} userId
 * @param {string} eventId
 * @param {string} riderId
 */
export async function registerRider(userId, eventId, riderId) {
  const familyId = await getFamilyIdForUser(userId);
  const rider = await prisma.rider.findFirst({
    where: { id: riderId, familyId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!rider) throw AppError.notFound('Cavalier introuvable');

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
    },
  });

  await dispatchNotification({
    userId,
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

  return registration;
}
