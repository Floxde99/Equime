// @ts-check
import { ROLES } from '@equime/shared';

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
  const force = req.user.role === ROLES.ADMIN && (req.body.force === true || req.query.force === true);
  const registration = await eventService.registerRider(req.user.id, req.params.id, req.body.riderId, {
    role: req.user.role,
    force,
  });
  res.status(201).json({ registration });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function assignHorses(req, res) {
  const result = await eventService.assignHorses(req.params.id);
  res.json(result);
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function listHorseOptions(req, res) {
  const options = await eventService.listHorseOptions(req.params.id, req.params.registrationId);
  res.json({ options });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function overrideHorse(req, res) {
  const registration = await eventService.overrideHorse(
    req.params.id,
    req.params.registrationId,
    req.body.horseId
  );
  res.json({ registration });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function cancelRegistration(req, res) {
  const registration = await eventService.cancelRegistration(
    req.user.id,
    req.params.id,
    req.params.registrationId,
    { role: req.user.role }
  );
  res.json({ registration });
}
