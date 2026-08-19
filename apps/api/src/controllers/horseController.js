// @ts-check
import * as horseService from '../services/horseService.js';

/** @param {import('express').Request} _req @param {import('express').Response} res */
export async function listHorses(_req, res) {
  const horses = await horseService.listHorses();
  res.json({ horses });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function createHorse(req, res) {
  const horse = await horseService.createHorse(req.body);
  res.status(201).json({ horse });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function getHorse(req, res) {
  const horse = await horseService.getHorse(req.params.id);
  res.json({ horse });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function updateHorse(req, res) {
  const horse = await horseService.updateHorse(req.params.id, req.body);
  res.json({ horse });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function deleteHorse(req, res) {
  await horseService.deleteHorse(req.params.id);
  res.status(204).send();
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function listHealthLogs(req, res) {
  const logs = await horseService.listHealthLogs(req.params.id);
  res.json({ logs });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function createHealthLog(req, res) {
  const log = await horseService.createHealthLog(req.params.id, req.user.id, req.body);
  res.status(201).json({ log });
}

/** @param {import('express').Request} _req @param {import('express').Response} res */
export async function listLoadAlerts(_req, res) {
  const horses = await horseService.listHorsesOverLoadThreshold();
  res.json({ horses });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function uploadPhoto(req, res) {
  const horse = await horseService.uploadHorsePhoto(req.params.id, req.file);
  res.json({ horse });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function deletePhoto(req, res) {
  const horse = await horseService.deleteHorsePhoto(req.params.id);
  res.json({ horse });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function downloadPhoto(req, res, next) {
  const photoPath = await horseService.getHorsePhotoPath(req.params.id);
  const { streamStoredFile } = await import('../lib/uploads.js');
  streamStoredFile(photoPath, res, next);
}
