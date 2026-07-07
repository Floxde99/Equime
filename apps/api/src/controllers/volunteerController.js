// @ts-check
import * as volunteerService from '../services/volunteerService.js';

/** @param {import('express').Request} _req @param {import('express').Response} res */
export async function listMissions(_req, res) {
  const missions = await volunteerService.listVolunteerMissions();
  res.json({ missions });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function createMission(req, res) {
  const mission = await volunteerService.createVolunteerMission(req.body);
  res.status(201).json({ mission });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function updateMission(req, res) {
  const mission = await volunteerService.updateVolunteerMission(req.params.id, req.body);
  res.json({ mission });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function deleteMission(req, res) {
  await volunteerService.deleteVolunteerMission(req.params.id);
  res.status(204).send();
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function signup(req, res) {
  const signup = await volunteerService.signupVolunteerMission(req.params.id, req.user.id);
  res.status(201).json({ signup });
}
