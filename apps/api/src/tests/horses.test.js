/**
 * Tests d'intégration — cavalerie (fiches chevaux, photos, carnet de santé).
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
const UNKNOWN_HORSE_ID = 'missing-horse-id';

let adminToken;
let instructorToken;
let instructorId;
let familyId;

beforeEach(async () => {
  await resetCoreTables();
  await resetAuthTables();
  await resetRateLimits();

  const admin = await createUser({
    email: 'admin-horses@test.fr',
    role: 'admin',
    firstName: 'Ada',
  });
  const instructor = await createUser({
    email: 'coach-horses@test.fr',
    role: 'instructor',
    firstName: 'Marc',
  });
  const client = await createUser({
    email: 'client-horses@test.fr',
    role: 'client',
    firstName: 'Lina',
  });

  adminToken = await accessTokenFor(admin);
  instructorToken = await accessTokenFor(instructor);
  instructorId = instructor.id;
  familyId = await familyIdOf(client.id);
});

afterAll(async () => {
  await resetCoreTables();
  await resetAuthTables();
  await prisma.$disconnect();
  redis.disconnect();
});

/**
 * Corps de création de cheval, surchargeable par test.
 * @param {Record<string, unknown>} [overrides]
 */
function horsePayload(overrides = {}) {
  return {
    name: 'Orion',
    breed: 'Selle français',
    birthYear: 2014,
    status: 'fit',
    minLevel: 'initiation',
    maxLevel: 'galop_7',
    maxWeeklyLoadHours: 12,
    alertThresholdHours: 10,
    ...overrides,
  };
}

/**
 * Crée un cheval via l'API admin.
 * @param {Record<string, unknown>} [overrides]
 */
async function createHorseViaApi(overrides = {}) {
  const res = await request(app)
    .post('/api/v1/horses')
    .set(authHeader(adminToken))
    .send(horsePayload(overrides));
  expect(res.status).toBe(201);
  return res.body.horse;
}

describe('Cavalerie — lecture et mutations', () => {
  it('liste et crée un cheval', async () => {
    const created = await createHorseViaApi({ name: 'Bella' });
    expect(created.name).toBe('Bella');
    expect(created.status).toBe('fit');

    const listRes = await request(app).get('/api/v1/horses').set(authHeader(instructorToken));
    expect(listRes.status).toBe(200);
    expect(listRes.body.horses).toHaveLength(1);
    expect(listRes.body.horses[0].id).toBe(created.id);
  });

  it('renvoie 404 pour un cheval inexistant', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${UNKNOWN_HORSE_ID}`)
      .set(authHeader(adminToken));

    expect(res.status).toBe(404);
    expect(res.body.error.message).toMatch(/cheval introuvable/i);
  });

  it('met à jour un cheval et refuse un id inconnu', async () => {
    const horse = await createHorseViaApi();

    const patchRes = await request(app)
      .patch(`/api/v1/horses/${horse.id}`)
      .set(authHeader(adminToken))
      .send({ name: 'Orion II', status: 'rest' });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.horse.name).toBe('Orion II');
    expect(patchRes.body.horse.status).toBe('rest');

    const missing = await request(app)
      .patch(`/api/v1/horses/${UNKNOWN_HORSE_ID}`)
      .set(authHeader(adminToken))
      .send({ name: 'Fantôme' });
    expect(missing.status).toBe(404);
  });
});

describe('Cavalerie — suppression', () => {
  it('refuse de supprimer un cheval attribué puis accepte un cheval libre', async () => {
    const assigned = await prisma.horse.create({ data: { name: 'Attribué' } });
    const free = await prisma.horse.create({ data: { name: 'Libre' } });
    const space = await prisma.space.create({
      data: { name: 'Manège cavalerie', type: 'indoor', capacity: 8 },
    });
    const rider = await prisma.rider.create({
      data: {
        familyId,
        firstName: 'Léa',
        lastName: 'Test',
        birthdate: new Date('2012-01-01'),
        level: 'galop_2',
      },
    });
    const course = await prisma.course.create({
      data: {
        title: 'Cours cavalerie',
        instructorId,
        spaceId: space.id,
        startAt: new Date('2026-09-20T16:00:00.000Z'),
        endAt: new Date('2026-09-20T17:00:00.000Z'),
        capacity: 6,
        status: 'scheduled',
      },
    });
    await prisma.courseEnrollment.create({
      data: { courseId: course.id, riderId: rider.id, horseId: assigned.id },
    });

    const conflict = await request(app)
      .delete(`/api/v1/horses/${assigned.id}`)
      .set(authHeader(adminToken));
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.message).toMatch(/attribué/i);

    const deleted = await request(app)
      .delete(`/api/v1/horses/${free.id}`)
      .set(authHeader(adminToken));
    expect(deleted.status).toBe(204);
    expect(await prisma.horse.findUnique({ where: { id: free.id } })).toBeNull();
  });
});

describe('Cavalerie — photos', () => {
  it('renvoie 404 si le cheval n’a pas de photo', async () => {
    const horse = await createHorseViaApi({ name: 'Sans photo' });

    const download = await request(app)
      .get(`/api/v1/horses/${horse.id}/photo`)
      .set(authHeader(instructorToken));
    expect(download.status).toBe(404);
    expect(download.body.error.message).toMatch(/photo introuvable/i);

    const removed = await request(app)
      .delete(`/api/v1/horses/${horse.id}/photo`)
      .set(authHeader(adminToken));
    expect(removed.status).toBe(404);
    expect(removed.body.error.message).toMatch(/photo introuvable/i);
  });
});

describe('Cavalerie — carnet de santé', () => {
  it('crée et liste les logs, 404 si cheval inexistant', async () => {
    const horse = await createHorseViaApi({ name: 'Santé' });

    const createRes = await request(app)
      .post(`/api/v1/horses/${horse.id}/health-logs`)
      .set(authHeader(adminToken))
      .send({
        type: 'farrier',
        notes: 'Parage trimestriel',
        occurredAt: '2026-08-01T10:00:00.000Z',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.log.type).toBe('farrier');
    expect(createRes.body.log.notes).toMatch(/Parage/);

    const listRes = await request(app)
      .get(`/api/v1/horses/${horse.id}/health-logs`)
      .set(authHeader(instructorToken));
    expect(listRes.status).toBe(200);
    expect(listRes.body.logs).toHaveLength(1);
    expect(listRes.body.logs[0].id).toBe(createRes.body.log.id);

    const missingList = await request(app)
      .get(`/api/v1/horses/${UNKNOWN_HORSE_ID}/health-logs`)
      .set(authHeader(adminToken));
    expect(missingList.status).toBe(404);

    const missingCreate = await request(app)
      .post(`/api/v1/horses/${UNKNOWN_HORSE_ID}/health-logs`)
      .set(authHeader(adminToken))
      .send({
        type: 'observation',
        notes: 'Cheval fantôme',
        occurredAt: '2026-08-02T10:00:00.000Z',
      });
    expect(missingCreate.status).toBe(404);
  });
});

describe('Cavalerie — alertes de charge', () => {
  it('ne retourne que les chevaux au-dessus du seuil', async () => {
    await prisma.horse.create({
      data: {
        name: 'Saturé',
        weeklyLoadHours: 11,
        alertThresholdHours: 10,
        maxWeeklyLoadHours: 12,
      },
    });
    await prisma.horse.create({
      data: {
        name: 'Léger',
        weeklyLoadHours: 4,
        alertThresholdHours: 10,
        maxWeeklyLoadHours: 12,
      },
    });

    const res = await request(app).get('/api/v1/horses/load-alerts').set(authHeader(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.horses.map((horse) => horse.name)).toEqual(['Saturé']);
  });
});
