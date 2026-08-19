// @ts-check
/**
 * Notifications unifiées — préférences, in-app et email.
 */
import { NOTIFICATION_TYPE_VALUES } from '@equime/shared';

import { AppError } from '../lib/appError.js';
import { sendTransactionalEmail } from '../lib/mailer.js';
import { prisma } from '../lib/prisma.js';

const NOTIFICATION_SELECT = {
  id: true,
  type: true,
  title: true,
  body: true,
  linkUrl: true,
  readAt: true,
  createdAt: true,
  updatedAt: true,
};

/**
 * @param {string} userId
 */
export async function ensureNotificationPreferences(userId) {
  const existing = await prisma.notificationPreference.findMany({
    where: { userId },
    select: { type: true },
  });
  const existingTypes = new Set(existing.map((item) => item.type));
  const missingTypes = NOTIFICATION_TYPE_VALUES.filter((type) => !existingTypes.has(type));

  if (missingTypes.length > 0) {
    await prisma.notificationPreference.createMany({
      data: missingTypes.map((type) => ({
        userId,
        type,
        emailEnabled: true,
        inAppEnabled: true,
      })),
    });
  }
}

/**
 * @param {string} userId
 */
export async function listNotificationPreferences(userId) {
  await ensureNotificationPreferences(userId);
  return prisma.notificationPreference.findMany({
    where: { userId },
    orderBy: { type: 'asc' },
  });
}

/**
 * @param {string} userId
 * @param {string} type
 * @param {{ emailEnabled?: boolean, inAppEnabled?: boolean }} input
 */
export async function updateNotificationPreference(userId, type, input) {
  await ensureNotificationPreferences(userId);
  return prisma.notificationPreference.update({
    where: { userId_type: { userId, type } },
    data: input,
  });
}

/**
 * @param {string} userId
 */
export async function listNotifications(userId) {
  return prisma.notification.findMany({
    where: { userId },
    select: NOTIFICATION_SELECT,
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * @param {string} userId
 * @param {string} notificationId
 */
export async function markNotificationRead(userId, notificationId) {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
    select: { id: true },
  });
  if (!notification) {
    throw AppError.notFound('Notification introuvable');
  }
  return prisma.notification.update({
    where: { id: notification.id },
    data: { readAt: new Date() },
    select: NOTIFICATION_SELECT,
  });
}

/**
 * @param {string} userId
 */
export async function markAllNotificationsRead(userId) {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}

/**
 * @param {string} userId
 * @param {string} type
 */
async function getPreference(userId, type) {
  await ensureNotificationPreferences(userId);
  return prisma.notificationPreference.findUniqueOrThrow({
    where: { userId_type: { userId, type } },
  });
}

/**
 * @param {{
 *   userId: string,
 *   type: string,
 *   title: string,
 *   body?: string,
 *   linkUrl?: string,
 *   email?: { subject: string, text: string, html: string }
 * }} input
 */
export async function dispatchNotification(input) {
  const [pref, user] = await Promise.all([
    getPreference(input.userId, input.type),
    prisma.user.findUniqueOrThrow({
      where: { id: input.userId },
      select: { email: true, firstName: true },
    }),
  ]);

  let notification = null;

  if (pref.inAppEnabled) {
    notification = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        linkUrl: input.linkUrl ?? null,
      },
      select: NOTIFICATION_SELECT,
    });
  }

  if (pref.emailEnabled && input.email) {
    await sendTransactionalEmail({
      to: user.email,
      subject: input.email.subject,
      text: input.email.text,
      html: input.email.html,
    });
  }

  return notification;
}

/**
 * Compatibilité ascendante Phase 3.
 * @param {{ userId: string, type: string, title: string, body?: string, linkUrl?: string }} input
 */
export function createNotification(input) {
  return dispatchNotification(input);
}
