// @ts-check
import * as riderService from '../services/riderService.js';

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function listRiders(req, res) {
  const riders = await riderService.listFamilyRiders(req.user.id);
  res.json({ riders });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function createRider(req, res) {
  const rider = await riderService.createRider(req.user.id, req.body);
  res.status(201).json({ rider });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function updateRider(req, res) {
  const rider = await riderService.updateRider(req.user.id, req.params.id, req.body);
  res.json({ rider });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function deleteRider(req, res) {
  await riderService.deleteRider(req.user.id, req.params.id);
  res.status(204).send();
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function uploadDocument(req, res) {
  const rider = await riderService.uploadRiderDocument(
    req.user.id,
    req.params.id,
    req.params.docType,
    req.file,
    req.body
  );
  res.json({ rider });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function downloadDocument(req, res) {
  const { createReadStream } = await import('node:fs');
  const path = await riderService.getRiderDocumentPath(
    req.user.id,
    req.params.id,
    req.params.docType,
    req.user.role
  );
  const { resolveStoredFilePath } = await import('../lib/uploads.js');
  const absolutePath = resolveStoredFilePath(path);
  res.setHeader('Content-Disposition', 'inline');
  createReadStream(absolutePath).pipe(res);
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function listAffinities(req, res) {
  const affinities = await riderService.listRiderAffinities(req.user.id, req.params.id);
  res.json({ affinities });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function upsertAffinity(req, res) {
  const affinity = await riderService.upsertRiderAffinity(
    req.user.id,
    req.params.id,
    req.params.horseId,
    req.body.affinity
  );
  res.json({ affinity });
}
