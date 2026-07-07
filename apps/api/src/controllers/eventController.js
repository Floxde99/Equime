// @ts-check
import * as eventService from '../services/eventService.js';

/** @param {import('express').Request} _req @param {import('express').Response} res */
export async function listPublicEvents(_req, res) {
  const events = await eventService.listPublicEvents();
  res.json({ events });
}

/** @param {import('express').Request} _req @param {import('express').Response} res */
export async function listAdminEvents(_req, res) {
  const events = await eventService.listAdminEvents();
  res.json({ events });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function createEvent(req, res) {
  const event = await eventService.createEvent(req.body);
  res.status(201).json({ event });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function updateEvent(req, res) {
  const event = await eventService.updateEvent(req.params.id, req.body);
  res.json({ event });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function deleteEvent(req, res) {
  await eventService.deleteEvent(req.params.id);
  res.status(204).send();
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function listRegistrations(req, res) {
  const registrations = await eventService.listEventRegistrations(req.params.id);
  res.json({ registrations });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function registerRider(req, res) {
  const registration = await eventService.registerRider(req.user.id, req.params.id, req.body.riderId);
  res.status(201).json({ registration });
}
