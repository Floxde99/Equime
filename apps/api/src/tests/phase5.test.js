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
import { createSentInvoiceForEventRegistration } from '../services/billingService.js';

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

async function createClientRider(overrides = {}) {
  return prisma.rider.create({
    data: {
      familyId: clientFamilyId,
      firstName: 'Emma',
      lastName: 'Martin',
      birthdate: new Date('2012-01-10T00:00:00.000Z'),
      level: 'galop_3',
      medicalCertificateStatus: 'approved',
      licenseStatus: 'approved',
      ...overrides,
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

  it('refuse l’inscription événement sans documents validés et autorise le force admin', async () => {
    const event = await prisma.event.create({
      data: {
        title: 'Stage documents',
        type: 'stage',
        startAt: new Date('2026-12-01T09:00:00.000Z'),
        endAt: new Date('2026-12-01T17:00:00.000Z'),
        capacity: 4,
      },
    });
    const rider = await createClientRider({
      medicalCertificateStatus: 'missing',
      licenseStatus: 'pending',
    });

    const blocked = await request(app)
      .post(`/api/v1/events/${event.id}/registrations`)
      .set(authHeader(clientToken))
      .send({ riderId: rider.id, force: true });
    expect(blocked.status).toBe(400);
    expect(blocked.body.error.message).toMatch(/certificat médical et la licence/i);

    const forced = await request(app)
      .post(`/api/v1/events/${event.id}/registrations`)
      .set(authHeader(adminToken))
      .send({ riderId: rider.id, force: true });
    expect(forced.status).toBe(201);
    expect(forced.body.registration.status).toBe('confirmed');
  });

  it('crée une facture envoyée à l’inscription si le stage est tarifé (Excel 12.1)', async () => {
    const event = await prisma.event.create({
      data: {
        title: 'Stage Galop 4',
        type: 'stage',
        startAt: new Date('2026-10-20T09:00:00.000Z'),
        endAt: new Date('2026-10-20T17:00:00.000Z'),
        capacity: 8,
        priceCents: 4500,
      },
    });
    const rider = await createClientRider();

    const registerRes = await request(app)
      .post(`/api/v1/events/${event.id}/registrations`)
      .set(authHeader(clientToken))
      .send({ riderId: rider.id });
    expect(registerRes.status).toBe(201);

    const invoicesRes = await request(app)
      .get('/api/v1/client/invoices')
      .set(authHeader(clientToken));
    expect(invoicesRes.status).toBe(200);
    expect(invoicesRes.body.invoices).toHaveLength(1);
    const invoice = invoicesRes.body.invoices[0];
    expect(invoice.status).toBe('sent');
    expect(invoice.totalCents).toBe(4500);
    expect(invoice.items).toHaveLength(1);
    expect(invoice.items[0].label).toMatch(/Emma/);
    expect(invoice.items[0].label).toMatch(/Stage Galop 4/);

    const item = await prisma.invoiceItem.findUnique({
      where: { eventRegistrationId: registerRes.body.registration.id },
    });
    expect(item).not.toBeNull();
    expect(item.totalCents).toBe(4500);

    const duplicate = await request(app)
      .post(`/api/v1/events/${event.id}/registrations`)
      .set(authHeader(clientToken))
      .send({ riderId: rider.id });
    expect(duplicate.status).toBe(409);
    expect(await prisma.invoice.count({ where: { familyId: clientFamilyId } })).toBe(1);
  });

  it('n’émet pas de facture si le prix du stage est 0', async () => {
    const event = await prisma.event.create({
      data: {
        title: 'Porte ouverte',
        type: 'stage',
        startAt: new Date('2026-11-02T09:00:00.000Z'),
        endAt: new Date('2026-11-02T12:00:00.000Z'),
        capacity: 20,
        priceCents: 0,
      },
    });
    const rider = await createClientRider();

    const registerRes = await request(app)
      .post(`/api/v1/events/${event.id}/registrations`)
      .set(authHeader(clientToken))
      .send({ riderId: rider.id });
    expect(registerRes.status).toBe(201);
    expect(await prisma.invoice.count({ where: { familyId: clientFamilyId } })).toBe(0);
  });

  it('reste idempotente si la facture stage est demandée deux fois', async () => {
    const rider = await createClientRider();
    const event = await prisma.event.create({
      data: {
        title: 'Stage idempotent',
        type: 'stage',
        startAt: new Date('2026-12-10T09:00:00.000Z'),
        endAt: new Date('2026-12-10T12:00:00.000Z'),
        capacity: 4,
        priceCents: 2000,
      },
    });
    const registration = await prisma.eventRegistration.create({
      data: { eventId: event.id, riderId: rider.id, status: 'confirmed' },
    });

    const first = await createSentInvoiceForEventRegistration({
      familyId: clientFamilyId,
      registrationId: registration.id,
      riderName: 'Emma Martin',
      eventTitle: event.title,
      priceCents: event.priceCents,
      dueAt: event.startAt,
    });
    const second = await createSentInvoiceForEventRegistration({
      familyId: clientFamilyId,
      registrationId: registration.id,
      riderName: 'Emma Martin',
      eventTitle: event.title,
      priceCents: event.priceCents,
      dueAt: event.startAt,
    });

    expect(first.id).toBe(second.id);
    expect(await prisma.invoice.count({ where: { familyId: clientFamilyId } })).toBe(1);
    expect(
      await prisma.invoiceItem.count({ where: { eventRegistrationId: registration.id } })
    ).toBe(1);
  });

  it('attribue un cheval fit sous charge max et incrémente la charge (Excel 11.2)', async () => {
    const horse = await prisma.horse.create({
      data: {
        name: 'Indigo',
        status: 'fit',
        minLevel: 'initiation',
        maxLevel: 'galop_7',
        weeklyLoadHours: 1,
        maxWeeklyLoadHours: 12,
      },
    });
    const event = await prisma.event.create({
      data: {
        title: 'Stage charge',
        type: 'stage',
        startAt: new Date('2026-10-12T09:00:00.000Z'),
        endAt: new Date('2026-10-12T11:00:00.000Z'),
        capacity: 4,
      },
    });
    const rider = await createClientRider();

    const registerRes = await request(app)
      .post(`/api/v1/events/${event.id}/registrations`)
      .set(authHeader(clientToken))
      .send({ riderId: rider.id });
    expect(registerRes.status).toBe(201);
    expect(registerRes.body.registration.horse.id).toBe(horse.id);

    const refreshed = await prisma.horse.findUniqueOrThrow({ where: { id: horse.id } });
    expect(refreshed.weeklyLoadHours).toBe(3);

    const adminList = await request(app).get('/api/v1/events/admin').set(authHeader(adminToken));
    expect(adminList.status).toBe(200);
    const listed = adminList.body.events.find((entry) => entry.id === event.id);
    expect(listed.registrations[0].horse.id).toBe(horse.id);
  });

  it('n’attribue pas un cheval non fit ou déjà au max de charge', async () => {
    await prisma.horse.create({
      data: {
        name: 'Repos',
        status: 'rest',
        minLevel: 'initiation',
        maxLevel: 'galop_7',
        weeklyLoadHours: 0,
        maxWeeklyLoadHours: 12,
      },
    });
    await prisma.horse.create({
      data: {
        name: 'Saturé',
        status: 'fit',
        minLevel: 'initiation',
        maxLevel: 'galop_7',
        weeklyLoadHours: 12,
        maxWeeklyLoadHours: 12,
      },
    });
    const event = await prisma.event.create({
      data: {
        title: 'Stage saturé',
        type: 'stage',
        startAt: new Date('2026-10-13T09:00:00.000Z'),
        endAt: new Date('2026-10-13T11:00:00.000Z'),
        capacity: 4,
      },
    });
    const rider = await createClientRider();

    const registerRes = await request(app)
      .post(`/api/v1/events/${event.id}/registrations`)
      .set(authHeader(clientToken))
      .send({ riderId: rider.id });
    expect(registerRes.status).toBe(201);
    expect(registerRes.body.registration.horse).toBeNull();
    expect(await prisma.horse.findFirst({ where: { name: 'Repos' } })).toMatchObject({
      weeklyLoadHours: 0,
    });
    expect(await prisma.horse.findFirst({ where: { name: 'Saturé' } })).toMatchObject({
      weeklyLoadHours: 12,
    });
  });

  it('retire la charge à l’annulation et permet un override admin', async () => {
    const horseA = await prisma.horse.create({
      data: {
        name: 'Astre',
        status: 'fit',
        minLevel: 'initiation',
        maxLevel: 'galop_7',
        weeklyLoadHours: 0,
        maxWeeklyLoadHours: 12,
      },
    });
    const horseB = await prisma.horse.create({
      data: {
        name: 'Bella',
        status: 'fit',
        minLevel: 'initiation',
        maxLevel: 'galop_7',
        weeklyLoadHours: 0,
        maxWeeklyLoadHours: 12,
      },
    });
    const event = await prisma.event.create({
      data: {
        title: 'Stage override',
        type: 'stage',
        startAt: new Date('2026-10-14T09:00:00.000Z'),
        endAt: new Date('2026-10-14T12:00:00.000Z'),
        capacity: 4,
      },
    });
    const rider = await createClientRider();

    const registerRes = await request(app)
      .post(`/api/v1/events/${event.id}/registrations`)
      .set(authHeader(clientToken))
      .send({ riderId: rider.id });
    expect(registerRes.status).toBe(201);
    const registrationId = registerRes.body.registration.id;
    expect(registerRes.body.registration.horse.name).toBe('Astre');

    const overrideRes = await request(app)
      .patch(`/api/v1/events/${event.id}/registrations/${registrationId}/horse`)
      .set(authHeader(adminToken))
      .send({ horseId: horseB.id });
    expect(overrideRes.status).toBe(200);
    expect(overrideRes.body.registration.horse.id).toBe(horseB.id);

    const [afterA, afterB] = await Promise.all([
      prisma.horse.findUniqueOrThrow({ where: { id: horseA.id } }),
      prisma.horse.findUniqueOrThrow({ where: { id: horseB.id } }),
    ]);
    expect(afterA.weeklyLoadHours).toBe(0);
    expect(afterB.weeklyLoadHours).toBe(3);

    const cancelRes = await request(app)
      .post(`/api/v1/events/${event.id}/registrations/${registrationId}/cancel`)
      .set(authHeader(clientToken))
      .send({});
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.registration.status).toBe('cancelled');
    expect(cancelRes.body.registration.horse).toBeNull();

    const afterCancel = await prisma.horse.findUniqueOrThrow({ where: { id: horseB.id } });
    expect(afterCancel.weeklyLoadHours).toBe(0);
  });

  it('attribue les chevaux restants via le bouton admin', async () => {
    const horse = await prisma.horse.create({
      data: {
        name: 'Jazz',
        status: 'fit',
        minLevel: 'initiation',
        maxLevel: 'galop_7',
        weeklyLoadHours: 0,
        maxWeeklyLoadHours: 12,
      },
    });
    const event = await prisma.event.create({
      data: {
        title: 'Stage batch',
        type: 'stage',
        startAt: new Date('2026-10-15T09:00:00.000Z'),
        endAt: new Date('2026-10-15T10:00:00.000Z'),
        capacity: 4,
      },
    });
    const rider = await createClientRider();
    const registration = await prisma.eventRegistration.create({
      data: { eventId: event.id, riderId: rider.id, status: 'confirmed' },
    });

    const assignRes = await request(app)
      .post(`/api/v1/events/${event.id}/assign-horses`)
      .set(authHeader(adminToken))
      .send({});
    expect(assignRes.status).toBe(200);
    expect(assignRes.body.assignments).toHaveLength(1);
    expect(assignRes.body.assignments[0].horse.id).toBe(horse.id);

    const updated = await prisma.eventRegistration.findUniqueOrThrow({
      where: { id: registration.id },
    });
    expect(updated.horseId).toBe(horse.id);
    const refreshedHorse = await prisma.horse.findUniqueOrThrow({ where: { id: horse.id } });
    expect(refreshedHorse.weeklyLoadHours).toBe(1);
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

  it('liste les contacts autorisés pour les trois rôles', async () => {
    const otherInstructor = await createUser({
      email: 'coach2-phase5@test.fr',
      role: 'instructor',
      firstName: 'Léa',
    });

    const clientContacts = await request(app)
      .get('/api/v1/messages/contacts')
      .set(authHeader(clientToken));
    expect(clientContacts.status).toBe(200);
    const clientIds = clientContacts.body.contacts.map((contact) => contact.id);
    expect(clientIds).toEqual(
      expect.arrayContaining([admin.id, instructor.id, otherInstructor.id])
    );
    expect(clientIds).not.toContain(otherClient.id);
    expect(clientIds).not.toContain(client.id);

    const instructorContacts = await request(app)
      .get('/api/v1/messages/contacts')
      .set(authHeader(instructorToken));
    expect(instructorContacts.status).toBe(200);
    const instructorIds = instructorContacts.body.contacts.map((contact) => contact.id);
    expect(instructorIds).toEqual(expect.arrayContaining([admin.id, client.id, otherClient.id]));
    expect(instructorIds).not.toContain(otherInstructor.id);
    expect(instructorIds).not.toContain(instructor.id);

    const adminContacts = await request(app)
      .get('/api/v1/messages/contacts')
      .set(authHeader(adminToken));
    expect(adminContacts.status).toBe(200);
    const adminIds = adminContacts.body.contacts.map((contact) => contact.id);
    expect(adminIds).toEqual(
      expect.arrayContaining([instructor.id, otherInstructor.id, client.id, otherClient.id])
    );
    expect(adminIds).not.toContain(admin.id);
  });

  it('refuse une conversation d’un client vers un autre client', async () => {
    const res = await request(app)
      .post('/api/v1/messages/conversations')
      .set(authHeader(clientToken))
      .send({ participantId: otherClient.id, subject: 'Non autorisé' });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/contact n’est pas autorisé/i);
  });

  it('réutilise une conversation, liste les messages et refuse un non-participant', async () => {
    const first = await request(app)
      .post('/api/v1/messages/conversations')
      .set(authHeader(clientToken))
      .send({ participantId: instructor.id, subject: 'Planning' });
    expect(first.status).toBe(201);
    const conversationId = first.body.conversation.id;

    const reused = await request(app)
      .post('/api/v1/messages/conversations')
      .set(authHeader(clientToken))
      .send({ participantId: instructor.id, subject: 'Autre sujet' });
    expect(reused.status).toBe(201);
    expect(reused.body.conversation.id).toBe(conversationId);

    const emptyList = await request(app)
      .get('/api/v1/messages/conversations')
      .set(authHeader(instructorToken));
    expect(emptyList.status).toBe(200);
    expect(emptyList.body.conversations).toHaveLength(1);
    expect(emptyList.body.conversations[0].lastMessage).toBeNull();
    expect(emptyList.body.conversations[0].hasUnread).toBe(false);

    const messageRes = await request(app)
      .post(`/api/v1/messages/conversations/${conversationId}/messages`)
      .set(authHeader(clientToken))
      .send({ body: 'Peut-on avancer la séance ?' });
    expect(messageRes.status).toBe(201);

    const unreadList = await request(app)
      .get('/api/v1/messages/conversations')
      .set(authHeader(instructorToken));
    expect(unreadList.body.conversations[0].hasUnread).toBe(true);
    expect(unreadList.body.conversations[0].lastMessage.body).toMatch(/avancer/);

    const ownList = await request(app)
      .get('/api/v1/messages/conversations')
      .set(authHeader(clientToken));
    expect(ownList.body.conversations[0].hasUnread).toBe(false);

    const messages = await request(app)
      .get(`/api/v1/messages/conversations/${conversationId}/messages`)
      .set(authHeader(clientToken));
    expect(messages.status).toBe(200);
    expect(messages.body.messages).toHaveLength(1);

    const readRes = await request(app)
      .post(`/api/v1/messages/conversations/${conversationId}/read`)
      .set(authHeader(instructorToken))
      .send({});
    expect(readRes.status).toBe(200);

    const afterRead = await request(app)
      .get('/api/v1/messages/conversations')
      .set(authHeader(instructorToken));
    expect(afterRead.body.conversations[0].hasUnread).toBe(false);

    const forbiddenRead = await request(app)
      .post(`/api/v1/messages/conversations/${conversationId}/read`)
      .set(authHeader(otherClientToken))
      .send({});
    expect(forbiddenRead.status).toBe(404);

    const forbiddenMessages = await request(app)
      .get(`/api/v1/messages/conversations/${conversationId}/messages`)
      .set(authHeader(otherClientToken));
    expect(forbiddenMessages.status).toBe(404);
  });
});
