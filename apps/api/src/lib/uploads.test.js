/**
 * Tests unitaires du stockage de fichiers (path traversal, photos chevaux).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PassThrough } from 'node:stream';

import { afterEach, describe, expect, it } from 'vitest';

import { AppError } from './appError.js';
import {
  deleteStoredFile,
  persistHorsePhoto,
  resolveStoredFilePath,
  streamStoredFile,
} from './uploads.js';

/** PNG 1×1 opaque. */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

describe('resolveStoredFilePath', () => {
  it('résout un chemin relatif dans UPLOAD_DIR', () => {
    const resolved = resolveStoredFilePath('riders/license/file.pdf');
    expect(resolved).toContain('riders');
    expect(resolved.endsWith(path.join('riders', 'license', 'file.pdf'))).toBe(true);
  });

  it('refuse une traversée ../ hors du répertoire', () => {
    expect(() => resolveStoredFilePath('riders/foo/../../../etc/passwd')).toThrow(AppError);
  });
});

describe('persistHorsePhoto', () => {
  /** @type {string[]} */
  const created = [];

  afterEach(async () => {
    await Promise.all(created.map((relativePath) => deleteStoredFile(relativePath)));
    created.length = 0;
  });

  it('refuse un MIME non image (même si l’extension est .jpg)', async () => {
    await expect(
      persistHorsePhoto({ buffer: Buffer.from('MZ fake executable'), originalname: 'cheval.jpg' })
    ).rejects.toBeInstanceOf(AppError);
  });

  it('stocke un PNG converti en WebP sous horses/', async () => {
    const result = await persistHorsePhoto({
      buffer: TINY_PNG,
      originalname: 'portrait.png',
      mimetype: 'image/png',
    });
    created.push(result.relativePath);

    expect(result.relativePath).toMatch(/^horses\/.+\.webp$/);
    const stored = await readFile(result.absolutePath);
    expect(stored.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(stored.subarray(8, 12).toString('ascii')).toBe('WEBP');
  });
});

describe('streamStoredFile Content-Disposition', () => {
  const relativePath = 'riders/license/disposition-test.pdf';

  afterEach(async () => {
    await deleteStoredFile(relativePath);
  });

  it('sert les PDF en attachment', async () => {
    const absolutePath = resolveStoredFilePath(relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, '%PDF-1.4');

    const headers = {};
    const res = new PassThrough();
    res.setHeader = (name, value) => {
      headers[name] = value;
    };

    await new Promise((resolve, reject) => {
      res.on('finish', resolve);
      res.on('error', reject);
      streamStoredFile(relativePath, /** @type {any} */ (res), reject);
      res.resume();
    });

    expect(headers['Content-Type']).toBe('application/pdf');
    expect(headers['Content-Disposition']).toBe('attachment');
  });
});
