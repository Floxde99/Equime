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
    const createRes = await request(app).post('/api/v1/riders').set(authHeader(clientToken)).send({
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

    const conflict = await request(app).post('/api/v1/courses').set(authHeader(adminToken)).send({
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

  it('accepte un box (stall) et refuse d’y placer un cours', async () => {
    const spaceRes = await request(app)
      .post('/api/v1/spaces')
      .set(authHeader(adminToken))
      .send({ name: 'Écurie test', type: 'stall', capacity: 8 });
    expect(spaceRes.status).toBe(201);
    expect(spaceRes.body.space.type).toBe('stall');

    const courseRes = await request(app)
      .post('/api/v1/courses')
      .set(authHeader(adminToken))
      .send({
        title: 'Cours en box',
        instructorId,
        spaceId: spaceRes.body.space.id,
        startAt: new Date(Date.now() + 86400000).toISOString(),
        endAt: new Date(Date.now() + 90000000).toISOString(),
        capacity: 4,
        status: 'scheduled',
      });
    expect(courseRes.status).toBe(400);
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
        medicalCertificateStatus: 'approved',
        licenseStatus: 'approved',
      },
    });

    const startAt = new Date('2026-09-01T14:00:00.000Z');
    const endAt = new Date('2026-09-01T15:00:00.000Z');
    const recurrenceEndDate = new Date('2026-09-22T14:00:00.000Z');

    const courseRes = await request(app).post('/api/v1/courses').set(authHeader(adminToken)).send({
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
      .field('expiresAt', '2027-12-31')
      .attach('file', pdfBuffer, { filename: 'certificat.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(200);
    expect(res.body.rider.medicalCertificateStatus).toBe('pending');
    expect(res.body.rider.medicalCertificateExpiresAt).toBe('2027-12-31T00:00:00.000Z');
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
      .field('expiresAt', '2027-12-31')
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
      .field('expiresAt', '2027-06-01')
      .attach('file', exeBuffer, { filename: 'licence.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(400);
  });
});

async function createScheduledCourse() {
  const space = await prisma.space.create({
    data: { name: `Manège ${crypto.randomUUID().slice(0, 8)}`, type: 'indoor', capacity: 12 },
  });
  return prisma.course.create({
    data: {
      title: 'Galop 2 soir',
      instructorId,
      spaceId: space.id,
      startAt: new Date('2026-09-20T16:00:00.000Z'),
      endAt: new Date('2026-09-20T17:00:00.000Z'),
      capacity: 6,
      minLevel: 'galop_1',
      maxLevel: 'galop_3',
      status: 'scheduled',
    },
  });
}

describe('Documents bloquants à l’inscription (Excel 7.2 / 10.4)', () => {
  it('refuse l’inscription client si certificat ou licence n’est pas approuvé', async () => {
    const course = await createScheduledCourse();
    const rider = await prisma.rider.create({
      data: {
        familyId,
        firstName: 'Léa',
        lastName: 'Docs',
        birthdate: new Date('2012-04-01'),
        level: 'galop_2',
      },
    });

    const res = await request(app)
      .post(`/api/v1/courses/${course.id}/enrollments`)
      .set(authHeader(clientToken))
      .send({ riderId: rider.id });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/certificat médical et la licence/i);

    const withForce = await request(app)
      .post(`/api/v1/courses/${course.id}/enrollments`)
      .set(authHeader(clientToken))
      .send({ riderId: rider.id, force: true });

    expect(withForce.status).toBe(400);
    expect(await prisma.courseEnrollment.count({ where: { courseId: course.id } })).toBe(0);
  });

  it('autorise l’admin à forcer l’inscription malgré des documents manquants', async () => {
    const course = await createScheduledCourse();
    await prisma.family.update({ where: { id: familyId }, data: { sessionQuota: 0 } });
    const rider = await prisma.rider.create({
      data: {
        familyId,
        firstName: 'Tom',
        lastName: 'Force',
        birthdate: new Date('2011-02-02'),
        level: 'galop_2',
        medicalCertificateStatus: 'pending',
        licenseStatus: 'missing',
      },
    });

    const blocked = await request(app)
      .post(`/api/v1/courses/${course.id}/enrollments`)
      .set(authHeader(adminToken))
      .send({ riderId: rider.id });
    expect(blocked.status).toBe(400);

    const forced = await request(app)
      .post(`/api/v1/courses/${course.id}/enrollments`)
      .query({ force: 'true' })
      .set(authHeader(adminToken))
      .send({ riderId: rider.id, force: true });

    expect(forced.status).toBe(201);
    expect(forced.body.enrollment.rider.firstName).toBe('Tom');

    const family = await prisma.family.findUnique({ where: { id: familyId } });
    expect(family?.sessionQuota).toBe(0);
  });

  it('refuse l’inscription si un document approuvé est expiré (Excel 7.2)', async () => {
    const course = await createScheduledCourse();
    const rider = await prisma.rider.create({
      data: {
        familyId,
        firstName: 'Léa',
        lastName: 'Expiré',
        birthdate: new Date('2012-03-03'),
        level: 'galop_2',
        medicalCertificateStatus: 'approved',
        licenseStatus: 'approved',
        medicalCertificateExpiresAt: new Date('2020-01-01T00:00:00.000Z'),
        licenseExpiresAt: new Date('2028-01-01T00:00:00.000Z'),
      },
    });

    const blocked = await request(app)
      .post(`/api/v1/courses/${course.id}/enrollments`)
      .set(authHeader(clientToken))
      .send({ riderId: rider.id });
    expect(blocked.status).toBe(400);
    expect(blocked.body.error.message).toMatch(/validité/i);

    const forced = await request(app)
      .post(`/api/v1/courses/${course.id}/enrollments`)
      .query({ force: 'true' })
      .set(authHeader(adminToken))
      .send({ riderId: rider.id, force: true });
    expect(forced.status).toBe(201);
  });
});

describe('Absence famille (Excel 3.7)', () => {
  it('permet au client d’excuser une séance à venir et notifie rider_absence', async () => {
    const course = await createScheduledCourse();
    const rider = await prisma.rider.create({
      data: {
        familyId,
        firstName: 'Nina',
        lastName: 'Martin',
        birthdate: new Date('2012-06-01'),
        level: 'galop_2',
        medicalCertificateStatus: 'approved',
        licenseStatus: 'approved',
      },
    });
    const enrollment = await prisma.courseEnrollment.create({
      data: { courseId: course.id, riderId: rider.id },
    });

    const listRes = await request(app)
      .get('/api/v1/courses/my-enrollments')
      .set(authHeader(clientToken));
    expect(listRes.status).toBe(200);
    expect(listRes.body.enrollments).toHaveLength(1);
    expect(listRes.body.enrollments[0].id).toBe(enrollment.id);

    const presentRes = await request(app)
      .patch(`/api/v1/courses/${course.id}/enrollments/${enrollment.id}/attendance`)
      .set(authHeader(clientToken))
      .send({ attendance: 'present' });
    expect(presentRes.status).toBe(403);

    const excuseRes = await request(app)
      .patch(`/api/v1/courses/${course.id}/enrollments/${enrollment.id}/attendance`)
      .set(authHeader(clientToken))
      .send({ attendance: 'excused' });

    expect(excuseRes.status).toBe(200);
    expect(excuseRes.body.enrollment.attendance).toBe('excused');

    const notification = await prisma.notification.findFirst({
      where: { userId: clientId, type: 'rider_absence' },
    });
    expect(notification).not.toBeNull();
    expect(notification?.body).toContain('Nina');
  });

  it('refuse d’excuser une séance passée ou une inscription d’une autre famille', async () => {
    const space = await prisma.space.create({
      data: { name: 'Carrière passée', type: 'outdoor', capacity: 8 },
    });
    const pastCourse = await prisma.course.create({
      data: {
        title: 'Cours passé',
        instructorId,
        spaceId: space.id,
        startAt: new Date('2026-01-10T10:00:00.000Z'),
        endAt: new Date('2026-01-10T11:00:00.000Z'),
        capacity: 6,
        status: 'scheduled',
      },
    });
    const rider = await prisma.rider.create({
      data: {
        familyId,
        firstName: 'Léo',
        lastName: 'Past',
        birthdate: new Date('2013-01-01'),
        level: 'galop_1',
      },
    });
    const pastEnrollment = await prisma.courseEnrollment.create({
      data: { courseId: pastCourse.id, riderId: rider.id },
    });

    const pastRes = await request(app)
      .patch(`/api/v1/courses/${pastCourse.id}/enrollments/${pastEnrollment.id}/attendance`)
      .set(authHeader(clientToken))
      .send({ attendance: 'excused' });
    expect(pastRes.status).toBe(400);

    const otherClient = await createUser({ email: 'other-absence@test.fr', role: 'client' });
    const otherToken = await accessTokenFor(otherClient);
    const otherFamilyId = await familyIdOf(otherClient.id);
    const otherRider = await prisma.rider.create({
      data: {
        familyId: otherFamilyId,
        firstName: 'Ada',
        lastName: 'Autre',
        birthdate: new Date('2012-08-08'),
        level: 'galop_2',
      },
    });
    const futureCourse = await createScheduledCourse();
    const otherEnrollment = await prisma.courseEnrollment.create({
      data: { courseId: futureCourse.id, riderId: otherRider.id },
    });

    const foreignRes = await request(app)
      .patch(`/api/v1/courses/${futureCourse.id}/enrollments/${otherEnrollment.id}/attendance`)
      .set(authHeader(clientToken))
      .send({ attendance: 'excused' });
    expect(foreignRes.status).toBe(404);

    const otherList = await request(app)
      .get('/api/v1/courses/my-enrollments')
      .set(authHeader(otherToken));
    expect(otherList.body.enrollments).toHaveLength(1);
  });
});
