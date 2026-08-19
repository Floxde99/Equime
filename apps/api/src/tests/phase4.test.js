/**
 * Tests d'intégration — attribution des chevaux et facturation (Phase 4).
 */
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { assignmentWriter } from '../services/horseAssignment.js';

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
let clientFamilyId;
let otherClientToken;
let _otherClientId;
let _otherFamilyId;

async function resetPhase4Tables() {
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.discountRule.deleteMany();
  await prisma.subscriptionPlan.deleteMany();
  await resetCoreTables();
}

beforeEach(async () => {
  await resetPhase4Tables();
  await resetAuthTables();
  await resetRateLimits();

  const admin = await createUser({ email: 'admin-phase4@test.fr', role: 'admin', firstName: 'Ada' });
  const instructor = await createUser({
    email: 'coach-phase4@test.fr',
    role: 'instructor',
    firstName: 'Marc',
  });
  const client = await createUser({
    email: 'client-phase4@test.fr',
    role: 'client',
    firstName: 'Lina',
  });
  const otherClient = await createUser({
    email: 'other-phase4@test.fr',
    role: 'client',
    firstName: 'Alex',
  });

  adminToken = await accessTokenFor(admin);
  instructorToken = await accessTokenFor(instructor);
  clientToken = await accessTokenFor(client);
  otherClientToken = await accessTokenFor(otherClient);
  instructorId = instructor.id;
  clientId = client.id;
  _otherClientId = otherClient.id;
  clientFamilyId = await familyIdOf(client.id);
  _otherFamilyId = await familyIdOf(otherClient.id);

  await prisma.subscriptionPlan.createMany({
    data: [
      { name: 'Découverte', priceCents: 4900, sessionsPerWeek: 1, description: '1 séance par semaine' },
      { name: 'Classique', priceCents: 8900, sessionsPerWeek: 2, description: '2 séances par semaine' },
    ],
  });
  await prisma.discountRule.createMany({
    data: [
      { label: 'Famille nombreuse', percentage: 10, minRiders: 2 },
      { label: 'Tribu', percentage: 15, minRiders: 3 },
    ],
  });
});

afterAll(async () => {
  vi.restoreAllMocks();
  await resetPhase4Tables();
  await resetAuthTables();
  await prisma.$disconnect();
  redis.disconnect();
});

async function createCourseSetup() {
  const space = await prisma.space.create({
    data: { name: 'Manège phase4', type: 'indoor', capacity: 12 },
  });
  const course = await prisma.course.create({
    data: {
      title: 'Cours phase 4',
      instructorId,
      spaceId: space.id,
      startAt: new Date('2026-10-01T09:00:00.000Z'),
      endAt: new Date('2026-10-01T10:00:00.000Z'),
      capacity: 8,
      minLevel: 'galop_1',
      maxLevel: 'galop_4',
      status: 'scheduled',
    },
  });

  return { space, course };
}

describe('EPIC 5 — attribution des chevaux', () => {
  it('rollback complètement si une erreur survient pendant une attribution', async () => {
    const { course } = await createCourseSetup();
    const rider = await prisma.rider.create({
      data: {
        familyId: clientFamilyId,
        firstName: 'Emma',
        lastName: 'Martin',
        birthdate: new Date('2012-01-10'),
        level: 'galop_2',
      },
    });
    const horse = await prisma.horse.create({
      data: {
        name: 'Indigo',
        status: 'fit',
        minLevel: 'initiation',
        maxLevel: 'galop_7',
        weeklyLoadHours: 0,
        maxWeeklyLoadHours: 12,
      },
    });

    await prisma.courseEnrollment.create({ data: { courseId: course.id, riderId: rider.id } });

    const spy = vi.spyOn(assignmentWriter, 'apply').mockRejectedValueOnce(new Error('boom during assignment'));

    const res = await request(app)
      .post(`/api/v1/courses/${course.id}/assign-horses`)
      .set(authHeader(instructorToken))
      .send({});

    expect(res.status).toBe(500);

    const enrollment = await prisma.courseEnrollment.findUniqueOrThrow({
      where: { courseId_riderId: { courseId: course.id, riderId: rider.id } },
    });
    const refreshedHorse = await prisma.horse.findUniqueOrThrow({ where: { id: horse.id } });

    expect(enrollment.horseId).toBeNull();
    expect(refreshedHorse.weeklyLoadHours).toBe(0);
    spy.mockRestore();
  });

  it('réajuste les charges lors de l’override manuel', async () => {
    const { course } = await createCourseSetup();
    const rider = await prisma.rider.create({
      data: {
        familyId: clientFamilyId,
        firstName: 'Emma',
        lastName: 'Martin',
        birthdate: new Date('2012-01-10'),
        level: 'galop_2',
      },
    });
    const horseA = await prisma.horse.create({
      data: {
        name: 'Indigo',
        status: 'fit',
        minLevel: 'initiation',
        maxLevel: 'galop_7',
        weeklyLoadHours: 1,
        maxWeeklyLoadHours: 12,
      },
    });
    const horseB = await prisma.horse.create({
      data: {
        name: 'Jazz',
        status: 'fit',
        minLevel: 'initiation',
        maxLevel: 'galop_7',
        weeklyLoadHours: 2,
        maxWeeklyLoadHours: 12,
      },
    });

    const enrollment = await prisma.courseEnrollment.create({
      data: {
        courseId: course.id,
        riderId: rider.id,
        horseId: horseA.id,
        horseAssignedAt: new Date('2026-10-01T08:00:00.000Z'),
      },
    });

    const res = await request(app)
      .patch(`/api/v1/courses/${course.id}/enrollments/${enrollment.id}/horse`)
      .set(authHeader(instructorToken))
      .send({ horseId: horseB.id });

    expect(res.status).toBe(200);
    expect(res.body.enrollment.horse.id).toBe(horseB.id);

    const [updatedA, updatedB] = await Promise.all([
      prisma.horse.findUniqueOrThrow({ where: { id: horseA.id } }),
      prisma.horse.findUniqueOrThrow({ where: { id: horseB.id } }),
    ]);
    expect(updatedA.weeklyLoadHours).toBe(0);
    expect(updatedB.weeklyLoadHours).toBe(3);
  });

  it('produit un audit batch sans écriture', async () => {
    const { course } = await createCourseSetup();
    const rider = await prisma.rider.create({
      data: {
        familyId: clientFamilyId,
        firstName: 'Emma',
        lastName: 'Martin',
        birthdate: new Date('2012-01-10'),
        level: 'galop_2',
      },
    });
    await prisma.horse.create({
      data: {
        name: 'Indigo',
        status: 'fit',
        minLevel: 'initiation',
        maxLevel: 'galop_7',
        weeklyLoadHours: 0,
        maxWeeklyLoadHours: 12,
      },
    });
    await prisma.courseEnrollment.create({ data: { courseId: course.id, riderId: rider.id } });

    const beforeHorse = await prisma.horse.findFirstOrThrow();

    const res = await request(app)
      .post('/api/v1/admin/compatibility-audit')
      .set(authHeader(adminToken))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.report).toHaveLength(1);
    expect(res.body.report[0].courseId).toBe(course.id);

    const afterHorse = await prisma.horse.findFirstOrThrow();
    const enrollment = await prisma.courseEnrollment.findFirstOrThrow();

    expect(afterHorse.weeklyLoadHours).toBe(beforeHorse.weeklyLoadHours);
    expect(enrollment.horseId).toBeNull();
  });
});

describe('EPIC 6 — facturation & abonnements', () => {
  it('crée, envoie puis paie une facture avec notifications', async () => {
    await prisma.rider.createMany({
      data: [
        {
          familyId: clientFamilyId,
          firstName: 'Emma',
          lastName: 'Martin',
          birthdate: new Date('2012-01-10'),
          level: 'galop_2',
        },
        {
          familyId: clientFamilyId,
          firstName: 'Tom',
          lastName: 'Martin',
          birthdate: new Date('2010-06-10'),
          level: 'galop_1',
        },
      ],
    });
    const plan = await prisma.subscriptionPlan.findFirstOrThrow({ where: { name: 'Classique' } });
    await prisma.family.update({
      where: { id: clientFamilyId },
      data: { subscriptionPlanId: plan.id },
    });

    const createRes = await request(app)
      .post('/api/v1/admin/invoices')
      .set(authHeader(adminToken))
      .send({ familyId: clientFamilyId });

    expect(createRes.status).toBe(201);
    expect(createRes.body.invoice.number).toMatch(/^FAC-2026-\d{4}$/);
    expect(createRes.body.invoice.totalCents).toBe(8010);

    const sendRes = await request(app)
      .post(`/api/v1/admin/invoices/${createRes.body.invoice.id}/send`)
      .set(authHeader(adminToken))
      .send({});

    expect(sendRes.status).toBe(200);
    expect(sendRes.body.invoice.status).toBe('sent');

    const payRes = await request(app)
      .post(`/api/v1/client/invoices/${createRes.body.invoice.id}/pay`)
      .set(authHeader(clientToken))
      .send({});

    expect(payRes.status).toBe(200);
    expect(payRes.body.invoice.status).toBe('paid');

    const notifications = await prisma.notification.findMany({
      where: { userId: clientId },
      orderBy: { createdAt: 'asc' },
    });
    expect(notifications.map((n) => n.type)).toEqual(['invoice_created', 'payment_confirmed']);
  });

  it('relance une facture impayée et isole la consultation/paiement à la famille', async () => {
    const invoice = await prisma.invoice.create({
      data: {
        familyId: clientFamilyId,
        number: 'FAC-2026-9999',
        status: 'overdue',
        issuedAt: new Date('2026-09-01T00:00:00.000Z'),
        dueAt: new Date('2026-09-15T00:00:00.000Z'),
        totalCents: 4900,
        items: {
          create: [{ label: 'Abonnement', quantity: 1, unitCents: 4900, totalCents: 4900 }],
        },
      },
    });

    const remindRes = await request(app)
      .post(`/api/v1/admin/invoices/${invoice.id}/remind`)
      .set(authHeader(adminToken))
      .send({});
    expect(remindRes.status).toBe(200);

    const notification = await prisma.notification.findFirst({
      where: { userId: clientId, type: 'invoice_reminder' },
    });
    expect(notification).not.toBeNull();

    const listMine = await request(app)
      .get('/api/v1/client/invoices')
      .set(authHeader(clientToken));
    expect(listMine.status).toBe(200);
    expect(listMine.body.invoices).toHaveLength(1);

    const listOther = await request(app)
      .get('/api/v1/client/invoices')
      .set(authHeader(otherClientToken));
    expect(listOther.status).toBe(200);
    expect(listOther.body.invoices).toHaveLength(0);

    await request(app)
      .post(`/api/v1/client/invoices/${invoice.id}/pay`)
      .set(authHeader(otherClientToken))
      .send({})
      .expect(404);
  });
});
