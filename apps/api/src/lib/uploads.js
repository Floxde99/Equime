// @ts-check
/**
 * Téléversement de documents cavaliers et photos de chevaux — volume local, contrôle MIME réel.
 */
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { fileTypeFromBuffer } from 'file-type';
import multer from 'multer';

import { env } from '../config/env.js';

import { AppError } from './appError.js';
import { convertImageToWebp } from './imageConvert.js';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const HORSE_PHOTO_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const STREAM_CONTENT_TYPES = {
  webp: 'image/webp',
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

const storage = multer.memoryStorage();

export const riderDocumentUpload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

export const horsePhotoUpload = riderDocumentUpload;

/**
 * @param {Express.Multer.File} file
 * @param {'medical_certificate' | 'license'} docType
 */
export async function persistRiderDocument(file, docType) {
  if (!file?.buffer) throw AppError.badRequest('Fichier manquant');

  // Contrôle MIME réel : on se fonde UNIQUEMENT sur les octets (magic bytes),
  // jamais sur le Content-Type déclaré par le client (falsifiable). Si le
  // format n'est pas détectable, il n'est pas un PDF/JPEG/PNG valide → rejet.
  const detected = await fileTypeFromBuffer(file.buffer);
  if (!detected || !ALLOWED_MIME.has(detected.mime)) {
    throw AppError.badRequest('Format non autorisé (PDF, JPG ou PNG uniquement)');
  }

  const ext = detected.ext;
  const dir = path.join(env.UPLOAD_DIR, 'riders', docType);
  await mkdir(dir, { recursive: true });

  const filename = `${randomUUID()}.${ext}`;
  const absolutePath = path.join(dir, filename);
  await writeFile(absolutePath, file.buffer);

  return {
    relativePath: path.posix.join('riders', docType, filename),
    absolutePath,
  };
}

/**
 * Persiste une photo de cheval : contrôle MIME réel, conversion WebP, stockage local.
 *
 * @param {Express.Multer.File} file
 * @returns {Promise<{ relativePath: string, absolutePath: string }>}
 */
export async function persistHorsePhoto(file) {
  if (!file?.buffer) throw AppError.badRequest('Fichier manquant');

  const detected = await fileTypeFromBuffer(file.buffer);
  if (!detected || !HORSE_PHOTO_MIME.has(detected.mime)) {
    throw AppError.badRequest('Format non autorisé (JPG, PNG ou WebP uniquement)');
  }

  const webp = await convertImageToWebp(file.buffer);
  const dir = path.join(env.UPLOAD_DIR, 'horses');
  await mkdir(dir, { recursive: true });

  const filename = `${randomUUID()}.webp`;
  const absolutePath = path.join(dir, filename);
  await writeFile(absolutePath, webp);

  return {
    relativePath: path.posix.join('horses', filename),
    absolutePath,
  };
}

/**
 * @param {string | null | undefined} relativePath
 */
export async function deleteStoredFile(relativePath) {
  if (!relativePath) return;
  try {
    await unlink(resolveStoredFilePath(relativePath));
  } catch {
    // Fichier déjà absent ou chemin invalide — pas bloquant
  }
}

/**
 * @param {string} relativePath
 */
export function resolveStoredFilePath(relativePath) {
  if (!relativePath || typeof relativePath !== 'string') {
    throw AppError.badRequest('Chemin de fichier invalide');
  }
  const root = path.resolve(env.UPLOAD_DIR);
  const resolved = path.resolve(root, relativePath);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw AppError.forbidden('Chemin de fichier invalide');
  }
  return resolved;
}

/**
 * Sert un fichier stocké, 404 si absent.
 * @param {string} relativePath
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function streamStoredFile(relativePath, res, next) {
  let absolutePath;
  try {
    absolutePath = resolveStoredFilePath(relativePath);
  } catch (err) {
    next(err);
    return;
  }
  const stream = createReadStream(absolutePath);
  stream.on('error', (err) => {
    if (err.code === 'ENOENT') next(AppError.notFound('Fichier introuvable'));
    else next(err);
  });
  const ext = path.extname(absolutePath).slice(1).toLowerCase();
  const contentType = STREAM_CONTENT_TYPES[ext];
  if (contentType) res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', ext === 'pdf' ? 'attachment' : 'inline');
  stream.pipe(res);
}

/**
 * Mappe les erreurs Multer vers AppError (413 / 400).
 * @type {import('express').ErrorRequestHandler}
 */
export function handleMulterError(err, _req, _res, next) {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    next(AppError.payloadTooLarge('Fichier trop volumineux (5 Mo maximum)'));
    return;
  }
  if (err?.name === 'MulterError') {
    next(AppError.badRequest('Téléversement invalide'));
    return;
  }
  next(err);
}
