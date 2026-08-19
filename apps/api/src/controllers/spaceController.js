// @ts-check
import * as spaceService from '../services/spaceService.js';

/** @param {import('express').Request} _req @param {import('express').Response} res */
export async function listSpaces(_req, res) {
  const spaces = await spaceService.listSpaces();
  res.json({ spaces });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function createSpace(req, res) {
  const space = await spaceService.createSpace(req.body);
  res.status(201).json({ space });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function getSpace(req, res) {
  const space = await spaceService.getSpace(req.params.id);
  res.json({ space });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function updateSpace(req, res) {
  const space = await spaceService.updateSpace(req.params.id, req.body);
  res.json({ space });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function deleteSpace(req, res) {
  await spaceService.deleteSpace(req.params.id);
  res.status(204).send();
}
