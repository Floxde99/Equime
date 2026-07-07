// @ts-check
import * as notificationService from '../services/notificationService.js';

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function listPreferences(req, res) {
  const preferences = await notificationService.listNotificationPreferences(req.user.id);
  res.json({ preferences });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function updatePreference(req, res) {
  const preference = await notificationService.updateNotificationPreference(
    req.user.id,
    req.params.type,
    req.body
  );
  res.json({ preference });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function listNotifications(req, res) {
  const notifications = await notificationService.listNotifications(req.user.id);
  res.json({ notifications });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function markRead(req, res) {
  const notification = await notificationService.markNotificationRead(req.user.id, req.params.id);
  res.json({ notification });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function markAllRead(req, res) {
  await notificationService.markAllNotificationsRead(req.user.id);
  res.status(204).send();
}
