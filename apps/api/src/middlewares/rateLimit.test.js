/**
 * Fail-closed (auth) vs fail-open (newsletter) lorsque Redis est indisponible.
 */
import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { redis } from '../lib/redis.js';

import { errorHandler } from './errorHandler.js';
import { rateLimit } from './rateLimit.js';

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * @param {import('express').RequestHandler} middleware
 */
function appWith(middleware) {
  const app = express();
  app.use(express.json());
  app.post('/x', middleware, (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  return app;
}

describe('rateLimit Redis indisponible', () => {
  it('renvoie 503 sur les routes d’auth (fail-closed)', async () => {
    vi.spyOn(redis, 'incr').mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await request(
      appWith(rateLimit({ keyPrefix: 'login', max: 10, windowSec: 60, failClosed: true }))
    ).post('/x');

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('laisse passer la newsletter (fail-open)', async () => {
    vi.spyOn(redis, 'incr').mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await request(
      appWith(rateLimit({ keyPrefix: 'newsletter', max: 5, windowSec: 3600 }))
    ).post('/x');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
