/**
 * Tests d'intégration — administration (US-9.1 à US-9.3).
 */
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { issueTokenPair } from '../services/tokenService.js';

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
let clientId;
let familyId;

beforeEach(async () => {
  await resetCoreTables();
  await resetAuthTables();
  await resetRateLimits();

  const admin = await createUser({ email: 'admin@test.fr', role: 'admin' });
  const client = await createUser({ email: 'client@test.fr', role: 'client', firstName: 'Lina' });

  adminToken = await accessTokenFor(admin);
  clientId = client.id;
  familyId = await familyIdOf(clientId);
});

afterAll(async () => {
  await resetCoreTables();
  await resetAuthTables();
  await prisma.$disconnect();
  redis.disconnect();
});

describe('Dashboard KPIs (T-9.1)', () => {
  it('renvoie occupation, CA et alertes cohérents', async () => {
    const instructor = await createUser({ email: 'coach@test.fr', role: 'instructor' });
    const space = await prisma.space.create({
      data: { name: 'Manège', type: 'indoor', capacity: 10 },
    });
    const startAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const course = await prisma.course.create({
      data: {
        title: 'Cours test',
        instructorId: instructor.id,
        spaceId: space.id,
        startAt,
        endAt: new Date(startAt.getTime() + 60 * 60 * 1000),
        capacity: 4,
        status: 'scheduled',
      },
    });
    const rider = await prisma.rider.create({
      data: {
        familyId,
        firstName: 'Emma',
        lastName: 'Test',
        birthdate: new Date('2012-01-01'),
        level: 'galop_2',
      },
    });
    await prisma.courseEnrollment.create({ data: { courseId: course.id, riderId: rider.id } });
    await prisma.invoice.create({
      data: {
        familyId,
        number: 'FAC-TEST-001',
        status: 'paid',
        totalCents: 5000,
        paidAt: new Date(),
        items: { create: [{ label: 'Test', quantity: 1, unitCents: 5000, totalCents: 5000 }] },
      },
    });
    await prisma.horse.create({
      data: { name: 'Orion', weeklyLoadHours: 11, alertThresholdHours: 10, maxWeeklyLoadHours: 12 },
    });

    const res = await request(app)
      .get('/api/v1/admin/dashboard-kpis')
      .set(authHeader(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.kpis.courseOccupancyPercent).toBe(25);
    expect(res.body.kpis.revenueCents).toBe(5000);
    expect(res.body.kpis.horsesInLoadAlert).toBe(1);
    expect(res.body.kpis.upcomingCoursesCount).toBe(1);
  });
});

describe('Gestion membres (T-9.2)', () => {
  it('bannit un client et révoque sa session active', async () => {
    const { accessToken } = await issueTokenPair({ id: clientId, role: 'client' });

    const banRes = await request(app)
      .post(`/api/v1/admin/members/${clientId}/ban`)
      .set(authHeader(adminToken));
    expect(banRes.status).toBe(204);

    const me = await request(app).get('/api/v1/auth/me').set(authHeader(accessToken));
    expect(me.status).toBe(401);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'client@test.fr', password: 'MotDePasse123' });
    expect(login.status).toBe(403);
  });

  it('débannit un client banni', async () => {
    await request(app)
      .post(`/api/v1/admin/members/${clientId}/ban`)
      .set(authHeader(adminToken));

    const unbanRes = await request(app)
      .post(`/api/v1/admin/members/${clientId}/unban`)
      .set(authHeader(adminToken));
    expect(unbanRes.status).toBe(204);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'client@test.fr', password: 'MotDePasse123' });
    expect(login.status).toBe(200);
  });
});

describe('Validation documents (T-9.3)', () => {
  it('approuve un certificat en attente', async () => {
    const rider = await prisma.rider.create({
      data: {
        familyId,
        firstName: 'Lucas',
        lastName: 'Test',
        birthdate: new Date('2015-01-01'),
        level: 'initiation',
        medicalCertificateStatus: 'pending',
      },
    });

    const res = await request(app)
      .post(`/api/v1/admin/riders/${rider.id}/review-document`)
      .set(authHeader(adminToken))
      .send({ docType: 'medical_certificate', decision: 'approved' });

    expect(res.status).toBe(200);
    expect(res.body.rider.medicalCertificateStatus).toBe('approved');

    const audit = await prisma.adminAuditLog.findFirst({
      where: { riderId: rider.id, action: 'medical_document_reviewed' },
    });
    expect(audit).not.toBeNull();
  });

  it('refuse une licence avec motif obligatoire', async () => {
    const rider = await prisma.rider.create({
      data: {
        familyId,
        firstName: 'Chloé',
        lastName: 'Test',
        birthdate: new Date('2010-01-01'),
        level: 'galop_4',
        licenseStatus: 'pending',
      },
    });

    const missingReason = await request(app)
      .post(`/api/v1/admin/riders/${rider.id}/review-document`)
      .set(authHeader(adminToken))
      .send({ docType: 'license', decision: 'rejected' });
    expect(missingReason.status).toBe(400);

    const res = await request(app)
      .post(`/api/v1/admin/riders/${rider.id}/review-document`)
      .set(authHeader(adminToken))
      .send({
        docType: 'license',
        decision: 'rejected',
        rejectionReason: 'Document illisible',
      });

    expect(res.status).toBe(200);
    expect(res.body.rider.licenseStatus).toBe('rejected');
    expect(res.body.rider.licenseRejectionReason).toBe('Document illisible');
  });
});
