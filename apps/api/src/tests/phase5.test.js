/**
 * Tests d'intégration — Phase 5 : notifications, événements, incidents,
 * bénévolat et messagerie.
 */
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../app.js';
import * as mailer from '../lib/mailer.js';
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

let admin;
let instructor;
let client;
let otherClient;
let adminToken;
let instructorToken;
let clientToken;
let otherClientToken;
let clientFamilyId;
let otherFamilyId;

async function resetPhase5Tables() {
  await prisma.eventRegistration.deleteMany();
  await prisma.event.deleteMany();
  await prisma.volunteerSignup.deleteMany();
  await prisma.volunteerMission.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.notificationPreference.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.discountRule.deleteMany();
  await prisma.subscriptionPlan.deleteMany();
  await resetCoreTables();
}

beforeEach(async () => {
  vi.restoreAllMocks();
  await resetPhase5Tables();
  await resetAuthTables();
  await resetRateLimits();

  admin = await createUser({ email: 'admin-phase5@test.fr', role: 'admin', firstName: 'Alice' });
  instructor = await createUser({
    email: 'coach-phase5@test.fr',
    role: 'instructor',
    firstName: 'Marc',
  });
  client = await createUser({
    email: 'client-phase5@test.fr',
    role: 'client',
    firstName: 'Lina',
  });
  otherClient = await createUser({
    email: 'other-phase5@test.fr',
    role: 'client',
    firstName: 'Alex',
  });

  adminToken = await accessTokenFor(admin);
  instructorToken = await accessTokenFor(instructor);
  clientToken = await accessTokenFor(client);
  otherClientToken = await accessTokenFor(otherClient);
  clientFamilyId = await familyIdOf(client.id);
  otherFamilyId = await familyIdOf(otherClient.id);

  await prisma.subscriptionPlan.create({
    data: {
      name: 'Classique',
      description: '2 séances par semaine',
      priceCents: 8900,
      sessionsPerWeek: 2,
    },
  });
});

afterAll(async () => {
  vi.restoreAllMocks();
  await resetPhase5Tables();
  await resetAuthTables();
  await prisma.$disconnect();
  redis.disconnect();
});

async function createClientRider() {
  return prisma.rider.create({
    data: {
      familyId: clientFamilyId,
      firstName: 'Emma',
      lastName: 'Martin',
      birthdate: new Date('2012-01-10T00:00:00.000Z'),
      level: 'galop_3',
    },
  });
}

describe('Phase 5 — notifications & préférences', () => {
  it('lit, met à jour et respecte les préférences de notification par canal', async () => {
    const prefRes = await request(app)
      .get('/api/v1/notifications/preferences')
      .set(authHeader(clientToken));

    expect(prefRes.status).toBe(200);
    expect(prefRes.body.preferences).toHaveLength(8);

    const updateRes = await request(app)
      .put('/api/v1/notifications/preferences/invoice_created')
      .set(authHeader(clientToken))
      .send({ emailEnabled: false, inAppEnabled: true });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.preference.emailEnabled).toBe(false);

    const plan = await prisma.subscriptionPlan.findFirstOrThrow({ where: { name: 'Classique' } });
    await prisma.family.update({
      where: { id: clientFamilyId },
      data: { subscriptionPlanId: plan.id },
    });

    const invoice = await prisma.invoice.create({
      data: {
        familyId: clientFamilyId,
        number: 'FAC-2026-0500',
        totalCents: 8900,
        items: {
          create: [{ label: 'Abonnement', quantity: 1, unitCents: 8900, totalCents: 8900 }],
        },
      },
    });

    const emailSpy = vi.spyOn(mailer, 'sendTransactionalEmail').mockResolvedValue(undefined);

    const sendRes = await request(app)
      .post(`/api/v1/admin/invoices/${invoice.id}/send`)
      .set(authHeader(adminToken))
      .send({});

    expect(sendRes.status).toBe(200);
    expect(emailSpy).not.toHaveBeenCalled();

    const notificationsRes = await request(app)
      .get('/api/v1/notifications')
      .set(authHeader(clientToken));

    expect(notificationsRes.status).toBe(200);
    expect(notificationsRes.body.notifications[0].type).toBe('invoice_created');

    const markReadRes = await request(app)
      .post(`/api/v1/notifications/${notificationsRes.body.notifications[0].id}/read`)
      .set(authHeader(clientToken))
      .send({});

    expect(markReadRes.status).toBe(200);
    expect(markReadRes.body.notification.readAt).toBeTruthy();
  });
});

describe('Phase 5 — événements', () => {
  it('publie les événements à venir et permet une inscription client avec notification', async () => {
    const pastEvent = await prisma.event.create({
      data: {
        title: 'Stage passé',
        type: 'stage',
        startAt: new Date('2026-01-10T09:00:00.000Z'),
        endAt: new Date('2026-01-10T17:00:00.000Z'),
        capacity: 8,
      },
    });
    await prisma.event.create({
      data: {
        title: 'Stage été',
        description: 'Préparation Galop 4',
        type: 'stage',
        startAt: new Date('2026-10-10T09:00:00.000Z'),
        endAt: new Date('2026-10-10T17:00:00.000Z'),
        capacity: 2,
        priceCents: 3500,
        location: 'Grand manège',
      },
    });

    const publicRes = await request(app).get('/api/v1/events');
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.events).toHaveLength(1);
    expect(publicRes.body.events[0].title).toBe('Stage été');
    expect(publicRes.body.events[0].id).not.toBe(pastEvent.id);

    const rider = await createClientRider();
    const eventId = publicRes.body.events[0].id;

    const registerRes = await request(app)
      .post(`/api/v1/events/${eventId}/registrations`)
      .set(authHeader(clientToken))
      .send({ riderId: rider.id });

    expect(registerRes.status).toBe(201);
    expect(registerRes.body.registration.status).toBe('confirmed');

    const notification = await prisma.notification.findFirst({
      where: { userId: client.id, type: 'registration_confirmed' },
    });
    expect(notification).not.toBeNull();
  });

  it('refuse les inscriptions si la capacité est atteinte', async () => {
    const event = await prisma.event.create({
      data: {
        title: 'Concours interne',
        type: 'competition_internal',
        startAt: new Date('2026-11-15T08:00:00.000Z'),
        endAt: new Date('2026-11-15T18:00:00.000Z'),
        capacity: 1,
      },
    });

    const rider = await createClientRider();
    const otherRider = await prisma.rider.create({
      data: {
        familyId: otherFamilyId,
        firstName: 'Tom',
        lastName: 'Durand',
        birthdate: new Date('2011-03-18T00:00:00.000Z'),
        level: 'galop_2',
      },
    });

    await prisma.eventRegistration.create({
      data: { eventId: event.id, riderId: otherRider.id, status: 'confirmed' },
    });

    const res = await request(app)
      .post(`/api/v1/events/${event.id}/registrations`)
      .set(authHeader(clientToken))
      .send({ riderId: rider.id });

    expect(res.status).toBe(409);
  });
});

describe('Phase 5 — incidents', () => {
  it('permet au moniteur de déclarer un incident critique puis à l’admin de le résoudre', async () => {
    const rider = await createClientRider();

    const createRes = await request(app)
      .post('/api/v1/incidents')
      .set(authHeader(instructorToken))
      .send({
        riderId: rider.id,
        severity: 'critical',
        occurredAt: '2026-10-12T16:10:00.000Z',
        description: 'Chute avec suspicion de fracture.',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.incident.status).toBe('open');

    const listRes = await request(app)
      .get('/api/v1/incidents?status=open&severity=critical')
      .set(authHeader(adminToken));

    expect(listRes.status).toBe(200);
    expect(listRes.body.incidents).toHaveLength(1);

    const resolveRes = await request(app)
      .post(`/api/v1/incidents/${createRes.body.incident.id}/resolve`)
      .set(authHeader(adminToken))
      .send({});

    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.incident.status).toBe('resolved');
    expect(resolveRes.body.incident.resolvedAt).toBeTruthy();
  });
});

describe('Phase 5 — bénévolat', () => {
  it('gère le CRUD admin et bloque les inscriptions doublons / mission complète', async () => {
    const createRes = await request(app)
      .post('/api/v1/volunteer-missions')
      .set(authHeader(adminToken))
      .send({
        title: 'Buvette concours',
        description: 'Tenue de la buvette samedi matin',
        startAt: '2026-11-20T08:00:00.000Z',
        endAt: '2026-11-20T12:00:00.000Z',
        slots: 1,
      });

    expect(createRes.status).toBe(201);

    const missionId = createRes.body.mission.id;

    const signupRes = await request(app)
      .post(`/api/v1/volunteer-missions/${missionId}/signups`)
      .set(authHeader(clientToken))
      .send({});

    expect(signupRes.status).toBe(201);

    const duplicateRes = await request(app)
      .post(`/api/v1/volunteer-missions/${missionId}/signups`)
      .set(authHeader(clientToken))
      .send({});

    expect(duplicateRes.status).toBe(409);

    const fullRes = await request(app)
      .post(`/api/v1/volunteer-missions/${missionId}/signups`)
      .set(authHeader(otherClientToken))
      .send({});

    expect(fullRes.status).toBe(409);
  });
});

describe('Phase 5 — messagerie', () => {
  it('filtre les contacts, sécurise les conversations et marque la lecture', async () => {
    const contactsRes = await request(app)
      .get('/api/v1/messages/contacts')
      .set(authHeader(clientToken));

    expect(contactsRes.status).toBe(200);
    expect(contactsRes.body.contacts.map((contact) => contact.id)).toContain(admin.id);
    expect(contactsRes.body.contacts.map((contact) => contact.id)).toContain(instructor.id);
    expect(contactsRes.body.contacts.map((contact) => contact.id)).not.toContain(otherClient.id);

    const conversationRes = await request(app)
      .post('/api/v1/messages/conversations')
      .set(authHeader(clientToken))
      .send({ participantId: instructor.id, subject: 'Question reprise' });

    expect(conversationRes.status).toBe(201);
    const conversationId = conversationRes.body.conversation.id;

    const messageRes = await request(app)
      .post(`/api/v1/messages/conversations/${conversationId}/messages`)
      .set(authHeader(clientToken))
      .send({ body: '<script>alert("xss")</script> Bonjour coach' });

    expect(messageRes.status).toBe(201);
    expect(messageRes.body.message.body).toContain('<script>alert("xss")</script>');

    const listMessagesRes = await request(app)
      .get(`/api/v1/messages/conversations/${conversationId}/messages`)
      .set(authHeader(instructorToken));

    expect(listMessagesRes.status).toBe(200);
    expect(listMessagesRes.body.messages).toHaveLength(1);

    const forbiddenRes = await request(app)
      .get(`/api/v1/messages/conversations/${conversationId}/messages`)
      .set(authHeader(otherClientToken));

    expect(forbiddenRes.status).toBe(404);

    const readRes = await request(app)
      .post(`/api/v1/messages/conversations/${conversationId}/read`)
      .set(authHeader(instructorToken))
      .send({});

    expect(readRes.status).toBe(200);
    expect(readRes.body.participant.lastReadAt).toBeTruthy();
  });
});
