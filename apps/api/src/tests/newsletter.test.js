/**
 * Tests d'intégration — inscription newsletter publique.
 */
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

import { resetRateLimits } from './helpers.js';

const app = createApp();

beforeEach(async () => {
  await prisma.newsletterSubscription.deleteMany();
  await resetRateLimits();
});

afterAll(async () => {
  await prisma.newsletterSubscription.deleteMany();
  await prisma.$disconnect();
  redis.disconnect();
});

describe('POST /api/v1/public/newsletter', () => {
  it('refuse un email invalide (400)', async () => {
    const res = await request(app).post('/api/v1/public/newsletter').send({ email: 'pas-un-email' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('refuse un corps sans email (400)', async () => {
    const res = await request(app).post('/api/v1/public/newsletter').send({});

    expect(res.status).toBe(400);
  });

  it("enregistre le consentement et confirme l'inscription", async () => {
    const res = await request(app)
      .post('/api/v1/public/newsletter')
      .send({ email: '  Claire@Club.fr  ' });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);

    const stored = await prisma.newsletterSubscription.findUnique({
      where: { email: 'claire@club.fr' },
    });
    expect(stored).not.toBeNull();
    expect(stored?.consentedAt).toBeInstanceOf(Date);
  });

  it('est idempotente sans second enregistrement', async () => {
    await request(app).post('/api/v1/public/newsletter').send({ email: 'deja@club.fr' });
    const second = await request(app).post('/api/v1/public/newsletter').send({ email: 'deja@club.fr' });

    expect(second.status).toBe(200);
    expect(await prisma.newsletterSubscription.count()).toBe(1);
  });
});
