/**
 * Tests d'intégration — administration (US-9.1 à US-9.3).
 */
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import * as adminService from '../services/adminService.js';
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

    const res = await request(app).get('/api/v1/admin/dashboard-kpis').set(authHeader(adminToken));

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
    await request(app).post(`/api/v1/admin/members/${clientId}/ban`).set(authHeader(adminToken));

    const unbanRes = await request(app)
      .post(`/api/v1/admin/members/${clientId}/unban`)
      .set(authHeader(adminToken));
    expect(unbanRes.status).toBe(204);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'client@test.fr', password: 'MotDePasse123' });
    expect(login.status).toBe(200);
  });

  it('refuse de bannir un administrateur', async () => {
    const otherAdmin = await createUser({ email: 'admin2@test.fr', role: 'admin' });
    const res = await request(app)
      .post(`/api/v1/admin/members/${otherAdmin.id}/ban`)
      .set(authHeader(adminToken));
    expect(res.status).toBe(403);
  });

  it('crée un compte moniteur avec mot de passe temporaire', async () => {
    const res = await request(app).post('/api/v1/admin/members').set(authHeader(adminToken)).send({
      email: 'nouveau-moniteur@test.fr',
      password: 'MotDePasse123',
      firstName: 'Camille',
      lastName: 'Coach',
      phone: '0612345678',
    });

    expect(res.status).toBe(201);
    expect(res.body.member).toMatchObject({
      email: 'nouveau-moniteur@test.fr',
      firstName: 'Camille',
      lastName: 'Coach',
      role: 'instructor',
    });
    expect(res.body.member.passwordHash).toBeUndefined();
    expect(res.body.accessToken).toBeUndefined();

    const stored = await prisma.user.findUnique({ where: { id: res.body.member.id } });
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    expect(stored.role).toBe('instructor');

    const family = await prisma.family.findUnique({ where: { userId: res.body.member.id } });
    expect(family).toBeNull();

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nouveau-moniteur@test.fr', password: 'MotDePasse123' });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe('instructor');
  });

  it('refuse un mot de passe trop court et un email déjà utilisé', async () => {
    const weak = await request(app).post('/api/v1/admin/members').set(authHeader(adminToken)).send({
      email: 'faible@test.fr',
      password: 'court',
      firstName: 'Camille',
      lastName: 'Coach',
    });
    expect(weak.status).toBe(400);

    const duplicate = await request(app)
      .post('/api/v1/admin/members')
      .set(authHeader(adminToken))
      .send({
        email: 'client@test.fr',
        password: 'MotDePasse123',
        firstName: 'Camille',
        lastName: 'Coach',
      });
    expect(duplicate.status).toBe(409);
  });

  it('interdit à un client de créer un moniteur', async () => {
    const { accessToken } = await issueTokenPair({ id: clientId, role: 'client' });
    const res = await request(app).post('/api/v1/admin/members').set(authHeader(accessToken)).send({
      email: 'intrus@test.fr',
      password: 'MotDePasse123',
      firstName: 'Intrus',
      lastName: 'Client',
    });
    expect(res.status).toBe(403);
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

  it('permet à l’admin de corriger la date d’expiration à la validation', async () => {
    const rider = await prisma.rider.create({
      data: {
        familyId,
        firstName: 'Inès',
        lastName: 'Test',
        birthdate: new Date('2014-06-01'),
        level: 'initiation',
        medicalCertificateStatus: 'pending',
        medicalCertificateExpiresAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    });

    const res = await request(app)
      .post(`/api/v1/admin/riders/${rider.id}/review-document`)
      .set(authHeader(adminToken))
      .send({
        docType: 'medical_certificate',
        decision: 'approved',
        expiresAt: '2028-06-30',
      });

    expect(res.status).toBe(200);
    expect(res.body.rider.medicalCertificateStatus).toBe('approved');
    expect(res.body.rider.medicalCertificateExpiresAt).toBe('2028-06-30T00:00:00.000Z');
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

  it('renvoie 404 si le cavalier n’existe pas', async () => {
    const res = await request(app)
      .post('/api/v1/admin/riders/missing-rider-id/review-document')
      .set(authHeader(adminToken))
      .send({ docType: 'license', decision: 'approved' });
    expect(res.status).toBe(404);
    expect(res.body.error.message).toMatch(/cavalier introuvable/i);
  });

  it('refuse de valider un document qui n’est pas en attente', async () => {
    const rider = await prisma.rider.create({
      data: {
        familyId,
        firstName: 'Hugo',
        lastName: 'Test',
        birthdate: new Date('2013-01-01'),
        level: 'galop_1',
        licenseStatus: 'approved',
      },
    });

    const res = await request(app)
      .post(`/api/v1/admin/riders/${rider.id}/review-document`)
      .set(authHeader(adminToken))
      .send({ docType: 'license', decision: 'approved' });
    expect(res.status).toBe(409);
  });
});

describe('Chemins d’erreur membres (entités introuvables)', () => {
  const unknownUserId = 'missing-user-id';

  it('renvoie 404 pour ban, unban et mise à jour d’un membre inexistant', async () => {
    const ban = await request(app)
      .post(`/api/v1/admin/members/${unknownUserId}/ban`)
      .set(authHeader(adminToken));
    expect(ban.status).toBe(404);

    const unban = await request(app)
      .post(`/api/v1/admin/members/${unknownUserId}/unban`)
      .set(authHeader(adminToken));
    expect(unban.status).toBe(404);

    const patch = await request(app)
      .patch(`/api/v1/admin/members/${unknownUserId}`)
      .set(authHeader(adminToken))
      .send({ firstName: 'Inconnu', lastName: 'Membre' });
    expect(patch.status).toBe(404);
  });

  it('refuse de débannir un compte anonymisé', async () => {
    await prisma.user.update({
      where: { id: clientId },
      data: { anonymizedAt: new Date() },
    });

    const res = await request(app)
      .post(`/api/v1/admin/members/${clientId}/unban`)
      .set(authHeader(adminToken));
    expect(res.status).toBe(409);
  });

  it('refuse de modifier un administrateur', async () => {
    const otherAdmin = await createUser({ email: 'admin-edit@test.fr', role: 'admin' });
    const res = await request(app)
      .patch(`/api/v1/admin/members/${otherAdmin.id}`)
      .set(authHeader(adminToken))
      .send({ firstName: 'Nope', lastName: 'Admin' });
    expect(res.status).toBe(403);
  });
});

describe('Listes admin et KPI vides', () => {
  it('renvoie des KPI à zéro sans cours ni factures', async () => {
    const res = await request(app).get('/api/v1/admin/dashboard-kpis').set(authHeader(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.kpis).toMatchObject({
      courseOccupancyPercent: 0,
      upcomingCoursesCount: 0,
      revenueCents: 0,
      paidInvoicesCount: 0,
      horsesInLoadAlert: 0,
      pendingDocumentsCount: 0,
    });
  });

  it('liste membres, moniteurs, documents en attente et journal d’audit', async () => {
    const instructor = await createUser({
      email: 'coach-list@test.fr',
      role: 'instructor',
      firstName: 'Marc',
      lastName: 'Coach',
    });
    const rider = await prisma.rider.create({
      data: {
        familyId,
        firstName: 'Emma',
        lastName: 'Pending',
        birthdate: new Date('2012-01-01'),
        level: 'galop_2',
        medicalCertificateStatus: 'pending',
      },
    });

    await request(app)
      .post(`/api/v1/admin/riders/${rider.id}/review-document`)
      .set(authHeader(adminToken))
      .send({ docType: 'medical_certificate', decision: 'approved' })
      .expect(200);

    const members = await request(app).get('/api/v1/admin/members').set(authHeader(adminToken));
    expect(members.status).toBe(200);
    expect(members.body.members.map((member) => member.id)).toEqual(
      expect.arrayContaining([clientId, instructor.id])
    );

    const instructors = await request(app)
      .get('/api/v1/admin/instructors')
      .set(authHeader(adminToken));
    expect(instructors.status).toBe(200);
    expect(instructors.body.instructors).toHaveLength(1);
    expect(instructors.body.instructors[0].id).toBe(instructor.id);

    const pending = await request(app)
      .get('/api/v1/admin/pending-documents')
      .set(authHeader(adminToken));
    expect(pending.status).toBe(200);
    expect(pending.body.riders).toHaveLength(0);

    const logs = await request(app).get('/api/v1/admin/audit-logs').set(authHeader(adminToken));
    expect(logs.status).toBe(200);
    expect(logs.body.logs.length).toBeGreaterThan(0);
    expect(logs.body.logs[0].action).toBe('medical_document_reviewed');

    const adminUser = await prisma.user.findFirstOrThrow({ where: { role: 'admin' } });
    await adminService.logAdminAudit({
      adminId: adminUser.id,
      action: 'medical_document_viewed',
      riderId: rider.id,
    });
    const limited = await adminService.listAuditLogs(1);
    expect(limited).toHaveLength(1);
    expect(limited[0].details).toBeNull();
  });

  it('renvoie 404 pour un document cavalier absent', async () => {
    const rider = await prisma.rider.create({
      data: {
        familyId,
        firstName: 'Noa',
        lastName: 'Doc',
        birthdate: new Date('2012-01-01'),
        level: 'initiation',
      },
    });

    const res = await request(app)
      .get(`/api/v1/admin/riders/${rider.id}/documents/medical_certificate`)
      .set(authHeader(adminToken));
    expect(res.status).toBe(404);
  });
});
