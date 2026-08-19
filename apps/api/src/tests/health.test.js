import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { redis } from '../lib/redis.js';

describe('GET /health', () => {
  it('répond 200 avec le statut du service', async () => {
    const res = await request(createApp()).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(['up', 'down']).toContain(res.body.redis);
    expect(res.body.timestamp).toBeDefined();
  });

  it("interdit le framing (CSP frame-ancestors 'none')", async () => {
    const res = await request(createApp()).get('/health');
    expect(res.headers['content-security-policy']).toMatch(/frame-ancestors 'none'/);
  });

  it('ne fait pas confiance au proxy hors production', () => {
    expect(createApp().get('trust proxy')).toBe(false);
  });

  it('répond 404 avec une erreur structurée sur une route inconnue', async () => {
    const res = await request(createApp()).get('/nope');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

afterAll(() => {
  redis.disconnect();
});
