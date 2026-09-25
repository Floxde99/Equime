/**
 * Tests d'intégration — paramètres du club et recherche de familles (US-10.8).
 */
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

import {
  accessTokenFor,
  authHeader,
  createUser,
  familyIdOf,
  resetAuthTables,
  resetCoreTables,
  resetRateLimits,
} from './coreHelpers.js';

const app = createApp();

let adminToken;
let clientToken;

beforeEach(async () => {
  await resetCoreTables();
  await resetAuthTables();
  await resetRateLimits();
  await prisma.clubSettings.deleteMany();

  const admin = await createUser({ email: 'admin-search@test.fr', role: 'admin' });
  const client = await createUser({
    email: 'helene.martin@test.fr',
    role: 'client',
    firstName: 'Hélène',
    lastName: 'Martin',
  });
  adminToken = await accessTokenFor(admin);
  clientToken = await accessTokenFor(client);

  const familyId = await familyIdOf(client.id);
  await prisma.rider.create({
    data: { familyId, firstName: 'Zoé', lastName: 'Martin', birthdate: new Date('2014-03-02') },
  });
});

afterAll(async () => {
  await resetCoreTables();
  await resetAuthTables();
  await prisma.clubSettings.deleteMany();
  await prisma.$disconnect();
  redis.disconnect();
});

describe('Paramètres du club', () => {
  it('crée les valeurs par défaut et les expose à tout utilisateur connecté', async () => {
    const res = await request(app).get('/api/v1/settings').set(authHeader(clientToken));

    expect(res.status).toBe(200);
    expect(res.body.settings).toMatchObject({
      cancellationDeadlineHours: 24,
      makeupValidityDays: 60,
      seasonStart: '09-01',
      seasonEnd: '06-30',
      installmentDay: 5,
      quarterDueDates: ['09-05', '01-05', '04-05'],
      proRataOnLateJoin: true,
      minorHealthQuestionnaire: true,
    });
  });

  it('laisse l’admin modifier les réglages, avec validation', async () => {
    const ok = await request(app)
      .patch('/api/v1/settings')
      .set(authHeader(adminToken))
      .send({ cancellationDeadlineHours: 12, quarterDueDates: ['09-10', '01-10', '04-10'] });
    expect(ok.status).toBe(200);
    expect(ok.body.settings.cancellationDeadlineHours).toBe(12);
    expect(ok.body.settings.quarterDueDates).toEqual(['09-10', '01-10', '04-10']);

    const invalid = await request(app)
      .patch('/api/v1/settings')
      .set(authHeader(adminToken))
      .send({ seasonStart: '02-30', installmentDay: 31 });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.details.map((d) => d.field).sort()).toEqual([
      'installmentDay',
      'seasonStart',
    ]);
  });

  it('refuse la modification à un client', async () => {
    const res = await request(app)
      .patch('/api/v1/settings')
      .set(authHeader(clientToken))
      .send({ cancellationDeadlineHours: 1 });
    expect(res.status).toBe(403);
  });
});

describe('Recherche de familles', () => {
  /** @param {string} q */
  const search = (q, token = adminToken) =>
    request(app).get('/api/v1/admin/families').query({ q }).set(authHeader(token));

  it('trouve une famille sans tenir compte des accents ni de la casse', async () => {
    const res = await search('HELENE');
    expect(res.status).toBe(200);
    expect(res.body.families).toHaveLength(1);
    expect(res.body.families[0].user).toMatchObject({ firstName: 'Hélène', lastName: 'Martin' });
    expect(res.body.families[0].riders).toEqual([expect.objectContaining({ firstName: 'Zoé' })]);
  });

  it('trouve par prénom de cavalier, par e-mail et par plusieurs mots', async () => {
    expect((await search('zoe')).body.families).toHaveLength(1);
    expect((await search('helene.martin@')).body.families).toHaveLength(1);
    expect((await search('martin zoe')).body.families).toHaveLength(1);
    expect((await search('martin lucas')).body.families).toHaveLength(0);
  });

  it('traite % et _ comme des caractères littéraux', async () => {
    expect((await search('%%')).body.families).toHaveLength(0);
    expect((await search('__')).body.families).toHaveLength(0);
  });

  it('exclut les comptes anonymisés (RGPD)', async () => {
    await prisma.user.updateMany({
      where: { email: 'helene.martin@test.fr' },
      data: { anonymizedAt: new Date() },
    });
    expect((await search('martin')).body.families).toHaveLength(0);
  });

  it('exige 2 caractères et le rôle admin', async () => {
    expect((await search('m')).status).toBe(400);
    expect((await search('martin', clientToken)).status).toBe(403);
  });
});
