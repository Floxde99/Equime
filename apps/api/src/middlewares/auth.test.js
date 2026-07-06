/**
 * Tests d'intégration des middlewares requireAuth + requireRole (T-1.8) :
 * montés sur une mini-app Express, comme le seront les routes métier
 * des phases suivantes (ex. routes admin).
 */
import { ROLES } from '@equime/shared';
import express from 'express';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';

import { redis } from '../lib/redis.js';
import { signAccessToken } from '../services/tokenService.js';

import { requireAuth, requireRole } from './auth.js';
import { errorHandler } from './errorHandler.js';

function buildApp() {
  const app = express();
  app.get('/admin-only', requireAuth, requireRole(ROLES.ADMIN), (_req, res) => {
    res.json({ ok: true });
  });
  app.get('/staff', requireAuth, requireRole(ROLES.ADMIN, ROLES.INSTRUCTOR), (_req, res) =>
    res.json({ ok: true })
  );
  app.use(errorHandler);
  return app;
}

const app = buildApp();

/** @param {string} role */
function tokenFor(role) {
  return signAccessToken({ id: `user_${role}`, role }).token;
}

describe('requireRole', () => {
  it('refuse sans token (401)', async () => {
    const res = await request(app).get('/admin-only');
    expect(res.status).toBe(401);
  });

  it("refuse un client sur une route admin (403, pas d'info sur la ressource)", async () => {
    const res = await request(app)
      .get('/admin-only')
      .set('Authorization', `Bearer ${tokenFor(ROLES.CLIENT)}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('accepte un admin sur une route admin', async () => {
    const res = await request(app)
      .get('/admin-only')
      .set('Authorization', `Bearer ${tokenFor(ROLES.ADMIN)}`);

    expect(res.status).toBe(200);
  });

  it('accepte chacun des rôles listés (admin OU moniteur)', async () => {
    const admin = await request(app)
      .get('/staff')
      .set('Authorization', `Bearer ${tokenFor(ROLES.ADMIN)}`);
    const instructor = await request(app)
      .get('/staff')
      .set('Authorization', `Bearer ${tokenFor(ROLES.INSTRUCTOR)}`);
    const client = await request(app)
      .get('/staff')
      .set('Authorization', `Bearer ${tokenFor(ROLES.CLIENT)}`);

    expect(admin.status).toBe(200);
    expect(instructor.status).toBe(200);
    expect(client.status).toBe(403);
  });
});

afterAll(() => {
  redis.disconnect();
});
