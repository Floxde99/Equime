import { describe, expect, it } from 'vitest';

import { convertImageToWebp } from './imageConvert.js';

/** PNG 1×1 opaque, magic bytes valides. */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

describe('convertImageToWebp', () => {
  it('produit un buffer WebP (RIFF/WEBP) à partir d’un PNG', async () => {
    const output = await convertImageToWebp(TINY_PNG);

    expect(Buffer.isBuffer(output)).toBe(true);
    expect(output.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(output.subarray(8, 12).toString('ascii')).toBe('WEBP');
  });
});
