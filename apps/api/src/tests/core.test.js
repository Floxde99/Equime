/**
 * Tests d'intégration — modules cœur Phase 3 (cavaliers, espaces, cours, planning).
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
let instructorToken;
let instructorId;
let clientId;
let familyId;

beforeEach(async () => {
  await resetCoreTables();
  await resetAuthTables();
  await resetRateLimits();

  const admin = await createUser({ email: 'admin@test.fr', role: 'admin', firstName: 'Ada' });
  const instructor = await createUser({
    email: 'coach@test.fr',
    role: 'instructor',
    firstName: 'Marc',
  });
  const client = await createUser({ email: 'client@test.fr', role: 'client', firstName: 'Lina' });

  adminToken = await accessTokenFor(admin);
  instructorToken = await accessTokenFor(instructor);
  clientToken = await accessTokenFor(client);
  instructorId = instructor.id;
  clientId = client.id;
  familyId = await familyIdOf(clientId);
});

afterAll(async () => {
  await resetCoreTables();
  await resetAuthTables();
  await prisma.$disconnect();
  redis.disconnect();
});

describe('Cavaliers (famille)', () => {
  it('CRUD limité à la famille du client', async () => {
    const createRes = await request(app)
      .post('/api/v1/riders')
      .set(authHeader(clientToken))
      .send({
        firstName: 'Léa',
        lastName: 'Martin',
        birthdate: '2012-05-10',
        level: 'galop_2',
      });

    expect(createRes.status).toBe(201);
    const riderId = createRes.body.rider.id;

    const listRes = await request(app).get('/api/v1/riders').set(authHeader(clientToken));
    expect(listRes.body.riders).toHaveLength(1);

    const patchRes = await request(app)
      .patch(`/api/v1/riders/${riderId}`)
      .set(authHeader(clientToken))
      .send({ level: 'galop_3' });
    expect(patchRes.body.rider.level).toBe('galop_3');

    await request(app).delete(`/api/v1/riders/${riderId}`).set(authHeader(clientToken)).expect(204);
  });
});

describe('Espaces et conflits', () => {
  it('refuse deux cours simultanés dans le même espace', async () => {
    const spaceRes = await request(app)
      .post('/api/v1/spaces')
      .set(authHeader(adminToken))
      .send({ name: 'Manège A', type: 'indoor', capacity: 12 });
    const spaceId = spaceRes.body.space.id;

    const startAt = new Date(Date.now() + 86400000).toISOString();
    const endAt = new Date(Date.now() + 90000000).toISOString();

    await request(app)
      .post('/api/v1/courses')
      .set(authHeader(adminToken))
      .send({
        title: 'Cours 1',
        instructorId,
        spaceId,
        startAt,
        endAt,
        capacity: 8,
        status: 'scheduled',
      })
      .expect(201);

    const conflict = await request(app)
      .post('/api/v1/courses')
      .set(authHeader(adminToken))
      .send({
        title: 'Cours 2',
        instructorId,
        spaceId,
        startAt,
        endAt,
        capacity: 8,
        status: 'scheduled',
      });

    expect(conflict.status).toBe(409);
  });
});

describe('Cours récurrents et inscriptions', () => {
  it('génère les occurrences hebdomadaires et inscrit un cavalier compatible', async () => {
    const space = await prisma.space.create({
      data: { name: 'Carrière', type: 'outdoor', capacity: 20 },
    });

    const rider = await prisma.rider.create({
      data: {
        familyId,
        firstName: 'Tom',
        lastName: 'Durand',
        birthdate: new Date('2010-01-01'),
        level: 'galop_2',
      },
    });

    const startAt = new Date('2026-09-01T14:00:00.000Z');
    const endAt = new Date('2026-09-01T15:00:00.000Z');
    const recurrenceEndDate = new Date('2026-09-22T14:00:00.000Z');

    const courseRes = await request(app)
      .post('/api/v1/courses')
      .set(authHeader(adminToken))
      .send({
        title: 'Galop 2',
        instructorId,
        spaceId: space.id,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        capacity: 6,
        minLevel: 'galop_1',
        maxLevel: 'galop_3',
        status: 'scheduled',
        recurrenceRule: 'weekly',
        recurrenceEndDate: recurrenceEndDate.toISOString(),
      });

    expect(courseRes.status).toBe(201);
    const parentId = courseRes.body.course.id;

    const children = await prisma.course.count({ where: { parentCourseId: parentId } });
    expect(children).toBe(3);

    const enrollRes = await request(app)
      .post(`/api/v1/courses/${parentId}/enrollments`)
      .set(authHeader(clientToken))
      .send({ riderId: rider.id });

    expect(enrollRes.status).toBe(201);

    const family = await prisma.family.findUnique({ where: { id: familyId } });
    expect(family?.sessionQuota).toBe(9);
  });
});

describe('Planning cache', () => {
  it('retourne les événements calendrier pour le moniteur', async () => {
    const space = await prisma.space.create({
      data: { name: 'Paddock', type: 'paddock', capacity: 5 },
    });

    await prisma.course.create({
      data: {
        title: 'Séance test',
        instructorId,
        spaceId: space.id,
        startAt: new Date('2026-10-01T09:00:00.000Z'),
        endAt: new Date('2026-10-01T10:00:00.000Z'),
        capacity: 4,
        status: 'scheduled',
      },
    });

    const res = await request(app)
      .get('/api/v1/courses/planning')
      .query({
        from: '2026-10-01T00:00:00.000Z',
        to: '2026-10-08T00:00:00.000Z',
        scope: 'mine',
      })
      .set(authHeader(instructorToken));

    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(1);
    expect(res.body.events[0].title).toBe('Séance test');
  });

  it('invalide le cache Redis après mutation de cours (T-4.7)', async () => {
    const space = await prisma.space.create({
      data: { name: 'Cache Arena', type: 'indoor', capacity: 10 },
    });

    const query = {
      from: '2026-11-01T00:00:00.000Z',
      to: '2026-11-15T00:00:00.000Z',
      scope: 'all',
    };

    await request(app)
      .get('/api/v1/courses/planning')
      .query(query)
      .set(authHeader(adminToken))
      .expect(200);

    const keysAfterRead = await redis.keys('planning:*');
    expect(keysAfterRead.length).toBeGreaterThan(0);

    await request(app)
      .post('/api/v1/courses')
      .set(authHeader(adminToken))
      .send({
        title: 'Nouveau cours cache',
        instructorId,
        spaceId: space.id,
        startAt: '2026-11-05T10:00:00.000Z',
        endAt: '2026-11-05T11:00:00.000Z',
        capacity: 6,
        status: 'scheduled',
      })
      .expect(201);

    const keysAfterMutation = await redis.keys('planning:*');
    expect(keysAfterMutation).toHaveLength(0);

    const after = await request(app)
      .get('/api/v1/courses/planning')
      .query(query)
      .set(authHeader(adminToken));
    expect(after.body.events.some((e) => e.title === 'Nouveau cours cache')).toBe(true);
  });
});

describe('Annulation de séance (T-4.2)', () => {
  it('annule une séance et notifie les inscrits', async () => {
    const space = await prisma.space.create({
      data: { name: 'Manège B', type: 'indoor', capacity: 8 },
    });
    const rider = await prisma.rider.create({
      data: {
        familyId,
        firstName: 'Nina',
        lastName: 'Test',
        birthdate: new Date('2011-01-01'),
        level: 'galop_2',
      },
    });
    const course = await prisma.course.create({
      data: {
        title: 'Séance à annuler',
        instructorId,
        spaceId: space.id,
        startAt: new Date('2026-12-01T14:00:00.000Z'),
        endAt: new Date('2026-12-01T15:00:00.000Z'),
        capacity: 6,
        status: 'scheduled',
      },
    });
    await prisma.courseEnrollment.create({ data: { courseId: course.id, riderId: rider.id } });

    const cancelRes = await request(app)
      .post(`/api/v1/courses/${course.id}/cancel`)
      .set(authHeader(adminToken))
      .send({ cancelSeries: false });
    expect(cancelRes.status).toBe(204);

    const updated = await prisma.course.findUnique({ where: { id: course.id } });
    expect(updated?.status).toBe('cancelled');

    const notifications = await prisma.notification.findMany({
      where: { userId: clientId, type: 'course_cancelled' },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].body).toContain('Séance à annuler');
  });
});

describe('Upload documents cavaliers (T-2.3 à T-2.5)', () => {
  it('accepte un PDF avec consentement médical', async () => {
    const rider = await prisma.rider.create({
      data: {
        familyId,
        firstName: 'Eva',
        lastName: 'Test',
        birthdate: new Date('2012-01-01'),
        level: 'initiation',
      },
    });

    const pdfBuffer = Buffer.from('%PDF-1.4 minimal test content');

    const res = await request(app)
      .post(`/api/v1/riders/${rider.id}/documents/medical_certificate`)
      .set(authHeader(clientToken))
      .field('medicalConsent', 'true')
      .attach('file', pdfBuffer, { filename: 'certificat.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(200);
    expect(res.body.rider.medicalCertificateStatus).toBe('pending');
  });

  it('refuse un upload sans consentement médical (T-2.5)', async () => {
    const rider = await prisma.rider.create({
      data: {
        familyId,
        firstName: 'Noa',
        lastName: 'Test',
        birthdate: new Date('2012-01-01'),
        level: 'initiation',
      },
    });

    const pdfBuffer = Buffer.from('%PDF-1.4 test');

    const res = await request(app)
      .post(`/api/v1/riders/${rider.id}/documents/medical_certificate`)
      .set(authHeader(clientToken))
      .attach('file', pdfBuffer, { filename: 'certificat.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(400);
  });

  it('refuse un fichier au MIME invalide (T-2.4)', async () => {
    const rider = await prisma.rider.create({
      data: {
        familyId,
        firstName: 'Zoé',
        lastName: 'Test',
        birthdate: new Date('2012-01-01'),
        level: 'initiation',
      },
    });

    const exeBuffer = Buffer.from('MZ fake executable');

    const res = await request(app)
      .post(`/api/v1/riders/${rider.id}/documents/license`)
      .set(authHeader(clientToken))
      .attach('file', exeBuffer, { filename: 'licence.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(400);
  });
});
