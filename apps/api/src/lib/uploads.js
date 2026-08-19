// @ts-check
/**
 * Téléversement de documents cavaliers — volume local, contrôle MIME réel.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { fileTypeFromBuffer } from 'file-type';
import multer from 'multer';

import { env } from '../config/env.js';

import { AppError } from './appError.js';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png']);

const storage = multer.memoryStorage();

export const riderDocumentUpload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

/**
 * @param {Express.Multer.File} file
 * @param {'medical_certificate' | 'license'} docType
 */
export async function persistRiderDocument(file, docType) {
  if (!file?.buffer) throw AppError.badRequest('Fichier manquant');

  const detected = await fileTypeFromBuffer(file.buffer);
  const mime = detected?.mime ?? file.mimetype;
  if (!ALLOWED_MIME.has(mime)) {
    throw AppError.badRequest('Format non autorisé (PDF, JPG ou PNG uniquement)');
  }

  const ext = detected?.ext ?? (mime === 'application/pdf' ? 'pdf' : mime === 'image/png' ? 'png' : 'jpg');
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
 * @param {string | null | undefined} relativePath
 */
export async function deleteStoredFile(relativePath) {
  if (!relativePath) return;
  const absolutePath = path.join(env.UPLOAD_DIR, relativePath);
  try {
    await unlink(absolutePath);
  } catch {
    // Fichier déjà absent — pas bloquant
  }
}

/**
 * @param {string} relativePath
 */
export function resolveStoredFilePath(relativePath) {
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
  return path.join(env.UPLOAD_DIR, normalized);
}
