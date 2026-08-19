// @ts-check
import * as incidentService from '../services/incidentService.js';

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function createIncident(req, res) {
  const incident = await incidentService.createIncident(req.user.id, req.body);
  res.status(201).json({ incident });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function listIncidents(req, res) {
  const incidents = await incidentService.listIncidents(req.query);
  res.json({ incidents });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function resolveIncident(req, res) {
  const incident = await incidentService.resolveIncident(req.params.id);
  res.json({ incident });
}

/** @param {import('express').Request} _req @param {import('express').Response} res */
export async function countCriticalOpen(_req, res) {
  const count = await incidentService.countCriticalOpenIncidents();
  res.json({ count });
}
