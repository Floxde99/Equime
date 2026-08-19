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

/**
 * Accumulateur binaire pour SuperTest (PDF).
 * @param {import('http').IncomingMessage} res
 * @param {(err: Error | null, body?: Buffer) => void} callback
 */
function collectBuffer(res, callback) {
  /** @type {Buffer[]} */
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
  res.on('error', callback);
}

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

  const admin = await createUser({
    email: 'admin-phase4@test.fr',
    role: 'admin',
    firstName: 'Ada',
  });
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
      {
        name: 'Découverte',
        priceCents: 4900,
        sessionsPerWeek: 1,
        description: '1 séance par semaine',
      },
      {
        name: 'Classique',
        priceCents: 8900,
        sessionsPerWeek: 2,
        description: '2 séances par semaine',
      },
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

describe('EPIC 3 — fiches chevaux', () => {
  it('permet à l’admin de changer le statut d’un cheval', async () => {
    const created = await request(app)
      .post('/api/v1/horses')
      .set(authHeader(adminToken))
      .send({ name: 'Ouragan' });
    expect(created.status).toBe(201);
    expect(created.body.horse.status).toBe('fit');

    const patched = await request(app)
      .patch(`/api/v1/horses/${created.body.horse.id}`)
      .set(authHeader(adminToken))
      .send({ status: 'injured' });
    expect(patched.status).toBe(200);
    expect(patched.body.horse.status).toBe('injured');
    expect(patched.body.horse.name).toBe('Ouragan');

    const forbidden = await request(app)
      .patch(`/api/v1/horses/${created.body.horse.id}`)
      .set(authHeader(instructorToken))
      .send({ status: 'rest' });
    expect(forbidden.status).toBe(403);
  });
});

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

    const spy = vi
      .spyOn(assignmentWriter, 'apply')
      .mockRejectedValueOnce(new Error('boom during assignment'));

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

    const listMine = await request(app).get('/api/v1/client/invoices').set(authHeader(clientToken));
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

  it('refuse de payer une facture encore en brouillon', async () => {
    const invoice = await prisma.invoice.create({
      data: {
        familyId: clientFamilyId,
        number: 'FAC-2026-8888',
        status: 'draft',
        dueAt: new Date('2026-09-15T00:00:00.000Z'),
        totalCents: 4900,
        items: {
          create: [{ label: 'Abonnement', quantity: 1, unitCents: 4900, totalCents: 4900 }],
        },
      },
    });

    const payRes = await request(app)
      .post(`/api/v1/client/invoices/${invoice.id}/pay`)
      .set(authHeader(clientToken))
      .send({});
    expect(payRes.status).toBe(400);
  });

  it("génère les factures d'abonnement du mois sans doublon", async () => {
    const plan = await prisma.subscriptionPlan.findFirstOrThrow({ where: { name: 'Découverte' } });
    await prisma.family.update({
      where: { id: clientFamilyId },
      data: { subscriptionPlanId: plan.id },
    });

    const first = await request(app)
      .post('/api/v1/admin/invoices/generate-subscriptions')
      .set(authHeader(adminToken))
      .send({});

    expect(first.status).toBe(200);
    expect(first.body.createdCount).toBe(1);
    expect(first.body.skippedCount).toBe(0);
    expect(first.body.invoices).toHaveLength(1);
    expect(first.body.invoices[0].family.id).toBe(clientFamilyId);
    expect(first.body.invoices[0].status).toBe('draft');
    expect(first.body.invoices[0].totalCents).toBe(4900);

    await prisma.family.update({
      where: { id: _otherFamilyId },
      data: { subscriptionPlanId: plan.id },
    });

    const second = await request(app)
      .post('/api/v1/admin/invoices/generate-subscriptions')
      .set(authHeader(adminToken))
      .send({});

    expect(second.status).toBe(200);
    expect(second.body.createdCount).toBe(1);
    expect(second.body.skippedCount).toBe(1);
    expect(second.body.invoices[0].family.id).toBe(_otherFamilyId);

    const third = await request(app)
      .post('/api/v1/admin/invoices/generate-subscriptions')
      .set(authHeader(adminToken))
      .send({});

    expect(third.status).toBe(200);
    expect(third.body.createdCount).toBe(0);
    expect(third.body.skippedCount).toBe(2);

    const invoices = await prisma.invoice.findMany();
    expect(invoices).toHaveLength(2);
  });

  it('liste les brouillons côté admin et les masque au client', async () => {
    const invoice = await prisma.invoice.create({
      data: {
        familyId: clientFamilyId,
        number: 'FAC-2026-DRAFT',
        status: 'draft',
        dueAt: new Date('2026-09-15T00:00:00.000Z'),
        totalCents: 4900,
        items: {
          create: [{ label: 'Abonnement', quantity: 1, unitCents: 4900, totalCents: 4900 }],
        },
      },
    });

    const adminList = await request(app).get('/api/v1/admin/invoices').set(authHeader(adminToken));
    expect(adminList.status).toBe(200);
    expect(
      adminList.body.invoices.some((item) => item.id === invoice.id && item.status === 'draft')
    ).toBe(true);

    const clientList = await request(app)
      .get('/api/v1/client/invoices')
      .set(authHeader(clientToken));
    expect(clientList.status).toBe(200);
    expect(clientList.body.invoices.some((item) => item.id === invoice.id)).toBe(false);
  });

  it('retourne une facture admin par id avec ses lignes', async () => {
    const invoice = await prisma.invoice.create({
      data: {
        familyId: clientFamilyId,
        number: 'FAC-2026-DETAIL',
        status: 'draft',
        dueAt: new Date('2026-09-15T00:00:00.000Z'),
        totalCents: 4900,
        items: {
          create: [{ label: 'Abonnement', quantity: 1, unitCents: 4900, totalCents: 4900 }],
        },
      },
    });

    const res = await request(app)
      .get(`/api/v1/admin/invoices/${invoice.id}`)
      .set(authHeader(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.invoice.id).toBe(invoice.id);
    expect(res.body.invoice.number).toBe('FAC-2026-DETAIL');
    expect(res.body.invoice.status).toBe('draft');
    expect(res.body.invoice.totalCents).toBe(4900);
    expect(res.body.invoice.family.id).toBe(clientFamilyId);
    expect(res.body.invoice.family.user.firstName).toBe('Lina');
    expect(res.body.invoice.items).toHaveLength(1);
    expect(res.body.invoice.items[0]).toMatchObject({
      label: 'Abonnement',
      quantity: 1,
      unitCents: 4900,
      totalCents: 4900,
    });

    const missing = await request(app)
      .get('/api/v1/admin/invoices/does-not-exist')
      .set(authHeader(adminToken));
    expect(missing.status).toBe(404);

    const forbidden = await request(app)
      .get(`/api/v1/admin/invoices/${invoice.id}`)
      .set(authHeader(clientToken));
    expect(forbidden.status).toBe(403);
  });

  it('génère un PDF admin (y compris brouillon) et le refuse au client', async () => {
    const invoice = await prisma.invoice.create({
      data: {
        familyId: clientFamilyId,
        number: 'FAC-2026-PDF-DRAFT',
        status: 'draft',
        dueAt: new Date('2026-09-15T00:00:00.000Z'),
        totalCents: 4900,
        items: {
          create: [{ label: 'Abonnement', quantity: 1, unitCents: 4900, totalCents: 4900 }],
        },
      },
    });

    const adminPdf = await request(app)
      .get(`/api/v1/admin/invoices/${invoice.id}/pdf`)
      .set(authHeader(adminToken))
      .buffer(true)
      .parse(collectBuffer);
    expect(adminPdf.status).toBe(200);
    expect(adminPdf.headers['content-type']).toMatch(/application\/pdf/);
    expect(adminPdf.headers['content-disposition']).toMatch(/facture-FAC-2026-PDF-DRAFT\.pdf/);
    expect(adminPdf.body.subarray(0, 4).toString('latin1')).toBe('%PDF');

    const clientDraft = await request(app)
      .get(`/api/v1/client/invoices/${invoice.id}/pdf`)
      .set(authHeader(clientToken));
    expect(clientDraft.status).toBe(404);

    const instructorForbidden = await request(app)
      .get(`/api/v1/admin/invoices/${invoice.id}/pdf`)
      .set(authHeader(instructorToken));
    expect(instructorForbidden.status).toBe(403);
  });

  it('sert le PDF client après envoi et isole les familles', async () => {
    const created = await request(app)
      .post('/api/v1/admin/invoices')
      .set(authHeader(adminToken))
      .send({
        familyId: clientFamilyId,
        dueAt: '2026-09-15T00:00:00.000Z',
        items: [{ label: 'Cours', quantity: 1, unitCents: 2500 }],
      });
    expect(created.status).toBe(201);
    const invoiceId = created.body.invoice.id;

    await request(app).post(`/api/v1/admin/invoices/${invoiceId}/send`).set(authHeader(adminToken));

    const clientPdf = await request(app)
      .get(`/api/v1/client/invoices/${invoiceId}/pdf`)
      .set(authHeader(clientToken))
      .buffer(true)
      .parse(collectBuffer);
    expect(clientPdf.status).toBe(200);
    expect(clientPdf.body.subarray(0, 4).toString('latin1')).toBe('%PDF');

    const otherPdf = await request(app)
      .get(`/api/v1/client/invoices/${invoiceId}/pdf`)
      .set(authHeader(otherClientToken));
    expect(otherPdf.status).toBe(404);
  });

  it('interdit la génération batch aux non-admins', async () => {
    const res = await request(app)
      .post('/api/v1/admin/invoices/generate-subscriptions')
      .set(authHeader(clientToken))
      .send({});
    expect(res.status).toBe(403);
  });
});
