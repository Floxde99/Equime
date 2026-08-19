/**
 * Rédaction pino : les jetons d'accès et cookies ne doivent jamais apparaître
 * en clair, y compris via les bindings des loggers enfants (pino-http).
 */
import { Writable } from 'node:stream';

import pino from 'pino';
import { describe, expect, it } from 'vitest';

import { LOGGER_REDACT } from './logger.js';

/**
 * @param {(log: import('pino').Logger) => void} write
 * @returns {Promise<object>}
 */
function captureChildLog(write) {
  return new Promise((resolve, reject) => {
    const stream = new Writable({
      write(chunk, _enc, cb) {
        try {
          resolve(JSON.parse(chunk.toString()));
        } catch (err) {
          reject(err);
        }
        cb();
      },
    });
    const log = pino({ level: 'info', redact: LOGGER_REDACT }, stream);
    write(log);
  });
}

describe('logger redact', () => {
  it('masque Authorization sur un logger enfant ([Redacted])', async () => {
    const payload = await captureChildLog((log) => {
      log
        .child({
          req: { headers: { authorization: 'Bearer super-secret-token' } },
        })
        .info('request');
    });

    expect(payload.req.headers.authorization).toBe('[Redacted]');
    expect(JSON.stringify(payload)).not.toContain('super-secret-token');
  });

  it('masque le cookie sur un logger enfant ([Redacted])', async () => {
    const payload = await captureChildLog((log) => {
      log
        .child({
          req: { headers: { cookie: 'equime_refresh=stolen-refresh-token' } },
        })
        .info('request');
    });

    expect(payload.req.headers.cookie).toBe('[Redacted]');
    expect(JSON.stringify(payload)).not.toContain('stolen-refresh-token');
  });
});
