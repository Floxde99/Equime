/**
 * Tests d'intégration — droits aux séances (ADR 011) : droit hebdomadaire du forfait,
 * rattrapages, annulations (famille et club), capacité et chevauchements.
 */
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { isoWeekRange } from '../lib/weeks.js';
import { chooseEntitlement, isCancelledInTime } from '../services/entitlementService.js';
import { getWeeklyLoads } from '../services/horseLoad.js';

import {
  accessTokenFor,
  authHeader,
  createUser,
  familyIdOf,
  giveSubscription,
  resetAuthTables,
  resetBillingTables,
  resetCoreTables,
  resetRateLimits,
} from './coreHelpers.js';

const app = createApp();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

let adminToken;
let clientToken;
let clientId;
let familyId;
let instructorId;
let spaceId;
let courseSeq = 0;

beforeEach(async () => {
  await resetBillingTables();
  await resetCoreTables();
  await resetAuthTables();
  await prisma.clubSettings.deleteMany();
  await resetRateLimits();

  const admin = await createUser({ email: 'admin-droits@test.fr', role: 'admin' });
  const instructor = await createUser({ email: 'coach-droits@test.fr', role: 'instructor' });
  const client = await createUser({
    email: 'client-droits@test.fr',
    role: 'client',
    firstName: 'Lina',
  });
  adminToken = await accessTokenFor(admin);
  clientToken = await accessTokenFor(client);
  clientId = client.id;
  familyId = await familyIdOf(client.id);
  instructorId = instructor.id;
  const space = await prisma.space.create({ data: { name: 'Manège droits', type: 'indoor' } });
  spaceId = space.id;
});

afterAll(async () => {
  await resetBillingTables();
  await resetCoreTables();
  await resetAuthTables();
  await prisma.$disconnect();
  redis.disconnect();
});

/** Mardi de la semaine prochaine à 10 h (heure de Paris), + `days` jours. */
function nextWeekDay(days = 0) {
  const nextMonday = isoWeekRange(new Date(Date.now() + 7 * DAY)).start;
  return new Date(nextMonday.getTime() + (1 + days) * DAY + 10 * HOUR);
}

/** @param {{ startAt: Date, capacity?: number, durationHours?: number }} input */
function createCourse({ startAt, capacity = 6, durationHours = 1 }) {
  courseSeq += 1;
  return prisma.course.create({
    data: {
      title: `Galop 2 n°${courseSeq}`,
      instructorId,
      spaceId,
      startAt,
      endAt: new Date(startAt.getTime() + durationHours * HOUR),
      capacity,
      minLevel: 'galop_1',
      maxLevel: 'galop_3',
      status: 'scheduled',
    },
  });
}

/** @param {{ firstName?: string, sessionsPerWeek?: number | null }} [input] */
async function createRider({ firstName = 'Emma', sessionsPerWeek = 1 } = {}) {
  const rider = await prisma.rider.create({
    data: {
      familyId,
      firstName,
      lastName: 'Martin',
      birthdate: new Date('2013-05-05'),
      level: 'galop_2',
      medicalCertificateStatus: 'approved',
      licenseStatus: 'approved',
    },
  });
  if (sessionsPerWeek) await giveSubscription({ riderId: rider.id, sessionsPerWeek });
  return rider;
}

/** @param {string} courseId @param {string} riderId @param {string} [token] */
function enroll(courseId, riderId, token = clientToken) {
  return request(app)
    .post(`/api/v1/courses/${courseId}/enrollments`)
    .set(authHeader(token))
    .send({ riderId });
}

/** @param {string} courseId @param {string} enrollmentId */
function cancel(courseId, enrollmentId) {
  return request(app)
    .delete(`/api/v1/courses/${courseId}/enrollments/${enrollmentId}`)
    .set(authHeader(clientToken));
}

/** @param {string} riderId */
function openCredits(riderId) {
  return prisma.sessionCredit.findMany({ where: { riderId, usedAt: null } });
}

describe('Règles pures', () => {
  it('choisit la séance du forfait, puis un rattrapage, sinon refuse', () => {
    expect(chooseEntitlement({ sessionsPerWeek: 1, usedThisWeek: 0, creditId: 'c1' })).toEqual({
      entitlement: 'subscription',
    });
    expect(chooseEntitlement({ sessionsPerWeek: 1, usedThisWeek: 1, creditId: 'c1' })).toEqual({
      entitlement: 'makeup',
      creditId: 'c1',
    });
    expect(chooseEntitlement({ sessionsPerWeek: 1, usedThisWeek: 1, creditId: null })).toEqual({
      refusal: 'week_full',
    });
    expect(chooseEntitlement({ sessionsPerWeek: null, usedThisWeek: 0, creditId: null })).toEqual({
      refusal: 'no_subscription',
    });
  });

  it('mesure le délai d’annulation à l’heure près', () => {
    const startAt = new Date('2026-10-10T10:00:00.000Z');
    expect(isCancelledInTime(startAt, 24, new Date('2026-10-09T10:00:00.000Z'))).toBe(true);
    expect(isCancelledInTime(startAt, 24, new Date('2026-10-09T10:00:01.000Z'))).toBe(false);
  });
});

describe('Droit hebdomadaire du forfait', () => {
  it('une séance par semaine : la deuxième de la semaine est refusée sans rattrapage', async () => {
    const emma = await createRider();
    const tuesday = await createCourse({ startAt: nextWeekDay(0) });
    const thursday = await createCourse({ startAt: nextWeekDay(2) });
    const nextTuesday = await createCourse({ startAt: nextWeekDay(7) });

    const first = await enroll(tuesday.id, emma.id);
    expect(first.status).toBe(201);
    expect(first.body.enrollment.entitlement).toBe('subscription');

    const second = await enroll(thursday.id, emma.id);
    expect(second.status).toBe(400);
    expect(second.body.error.message).toBe(
      "Emma a déjà pris sa séance de la semaine et n'a pas de crédit de rattrapage."
    );

    const following = await enroll(nextTuesday.id, emma.id);
    expect(following.status).toBe(201);
    expect(following.body.enrollment.entitlement).toBe('subscription');
  });

  it('refuse un cavalier sans forfait, une séance commencée et un créneau déjà pris', async () => {
    const noPlan = await createRider({ firstName: 'Zoé', sessionsPerWeek: null });
    const course = await createCourse({ startAt: nextWeekDay(0) });
    const res = await enroll(course.id, noPlan.id);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Zoé n'a pas de forfait pour cette saison/);

    const emma = await createRider({ sessionsPerWeek: 3 });
    const started = await createCourse({ startAt: new Date(Date.now() - 10 * 60 * 1000) });
    expect((await enroll(started.id, emma.id)).status).toBe(400);

    const overlap = await createCourse({
      startAt: new Date(nextWeekDay(0).getTime() + 30 * 60 * 1000),
    });
    expect((await enroll(course.id, emma.id)).status).toBe(201);
    const clash = await enroll(overlap.id, emma.id);
    expect(clash.status).toBe(409);
    expect(clash.body.error.message).toMatch(/Emma est déjà inscrit\(e\) sur ce créneau/);
  });

  it('indique pour chaque séance réservable le droit qui sera consommé', async () => {
    const emma = await createRider();
    const tuesday = await createCourse({ startAt: nextWeekDay(0) });
    const thursday = await createCourse({ startAt: nextWeekDay(2) });
    const nextTuesday = await createCourse({ startAt: nextWeekDay(7) });
    await enroll(tuesday.id, emma.id);

    const res = await request(app)
      .get('/api/v1/courses/enrollable')
      .query({ riderId: emma.id })
      .set(authHeader(clientToken));

    expect(res.status).toBe(200);
    const byId = Object.fromEntries(res.body.courses.map((c) => [c.id, c]));
    expect(byId[tuesday.id]).toBeUndefined();
    expect(byId[thursday.id]).toMatchObject({ entitlement: null, refusal: 'week_full' });
    expect(byId[nextTuesday.id]).toMatchObject({ entitlement: 'subscription', refusal: null });
    expect(byId[nextTuesday.id].instructorName).toBeTruthy();
  });
});

describe('Annulations et rattrapages', () => {
  it('annulation dans les délais : crédit, rattrapage la même semaine, crédit rendu', async () => {
    const emma = await createRider();
    const tuesday = await createCourse({ startAt: nextWeekDay(0) });
    const thursday = await createCourse({ startAt: nextWeekDay(2) });
    const saturday = await createCourse({ startAt: nextWeekDay(4) });

    const booked = await enroll(tuesday.id, emma.id);
    const cancelled = await cancel(tuesday.id, booked.body.enrollment.id);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.inTime).toBe(true);
    expect(await openCredits(emma.id)).toHaveLength(1);

    // La séance annulée reste comptée dans la semaine : c'est le crédit qui la remplace.
    const makeup = await enroll(thursday.id, emma.id);
    expect(makeup.status).toBe(201);
    expect(makeup.body.enrollment.entitlement).toBe('makeup');
    const [credit] = await prisma.sessionCredit.findMany({ where: { riderId: emma.id } });
    expect(credit.usedByEnrollmentId).toBe(makeup.body.enrollment.id);
    expect(credit.source).toBe('cancelled_in_time');

    const noMore = await enroll(saturday.id, emma.id);
    expect(noMore.status).toBe(400);

    // Annuler le rattrapage à temps rend le crédit (sans en créer un second)
    const cancelMakeup = await cancel(thursday.id, makeup.body.enrollment.id);
    expect(cancelMakeup.body.credit.id).toBe(credit.id);
    expect(await openCredits(emma.id)).toHaveLength(1);
    expect(await prisma.sessionCredit.count({ where: { riderId: emma.id } })).toBe(1);
  });

  it('annulation tardive : la place est libérée, sans rattrapage', async () => {
    await prisma.clubSettings.create({ data: { id: 1, cancellationDeadlineHours: 48 } });
    const emma = await createRider();
    const soon = await createCourse({ startAt: new Date(Date.now() + 30 * HOUR), capacity: 1 });

    const booked = await enroll(soon.id, emma.id);
    const res = await cancel(soon.id, booked.body.enrollment.id);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ inTime: false, credit: null });
    expect(await openCredits(emma.id)).toHaveLength(0);
    const notification = await prisma.notification.findFirst({
      where: { userId: clientId, type: 'rider_absence' },
    });
    expect(notification?.body).toMatch(/moins de 48 h avant la séance/);

    // Place libérée pour un autre cavalier
    const lucas = await createRider({ firstName: 'Lucas' });
    expect((await enroll(soon.id, lucas.id)).status).toBe(201);

    // La place a été reprise : Emma ne peut plus revenir
    const back = await enroll(soon.id, emma.id);
    expect(back.status).toBe(409);
    expect(back.body.error.message).toBe('Ce cours est complet');
  });

  it('se réinscrire à la séance annulée à temps retire le crédit accordé', async () => {
    const emma = await createRider();
    const tuesday = await createCourse({ startAt: nextWeekDay(0) });

    const booked = await enroll(tuesday.id, emma.id);
    await cancel(tuesday.id, booked.body.enrollment.id);
    expect(await openCredits(emma.id)).toHaveLength(1);

    const again = await enroll(tuesday.id, emma.id);
    expect(again.status).toBe(201);
    expect(again.body.enrollment.id).toBe(booked.body.enrollment.id);
    expect(again.body.enrollment.entitlement).toBe('subscription');
    expect(await prisma.sessionCredit.count({ where: { riderId: emma.id } })).toBe(0);

    const twice = await cancel(tuesday.id, booked.body.enrollment.id);
    expect(twice.status).toBe(200);
    const stillOnce = await cancel(tuesday.id, booked.body.enrollment.id);
    expect(stillOnce.status).toBe(409);
  });

  it('séance annulée par le club : un rattrapage par inscrit, pas pour une inscription forcée', async () => {
    const emma = await createRider();
    const lucas = await createRider({ firstName: 'Lucas', sessionsPerWeek: null });
    const course = await createCourse({ startAt: nextWeekDay(0) });

    expect((await enroll(course.id, emma.id)).status).toBe(201);
    const forced = await request(app)
      .post(`/api/v1/courses/${course.id}/enrollments`)
      .set(authHeader(adminToken))
      .send({ riderId: lucas.id, force: true });
    expect(forced.body.enrollment.entitlement).toBe('forced');

    const res = await request(app)
      .post(`/api/v1/courses/${course.id}/cancel`)
      .set(authHeader(adminToken))
      .send({});
    expect(res.status).toBe(204);

    const emmaCredits = await openCredits(emma.id);
    expect(emmaCredits).toHaveLength(1);
    expect(emmaCredits[0].source).toBe('club_cancellation');
    expect(emmaCredits[0].expiresAt.getTime()).toBe(course.startAt.getTime() + 60 * DAY);
    expect(await openCredits(lucas.id)).toHaveLength(0);

    const notification = await prisma.notification.findFirst({
      where: { userId: clientId, type: 'course_cancelled', body: { contains: 'Emma' } },
    });
    expect(notification?.body).toMatch(/Un rattrapage est offert à Emma/);
  });

  it('une inscription annulée ne compte ni dans la capacité ni dans la charge du cheval', async () => {
    const emma = await createRider();
    const horse = await prisma.horse.create({ data: { name: 'Indigo' } });
    const course = await createCourse({ startAt: nextWeekDay(0), capacity: 1, durationHours: 2 });

    const booked = await enroll(course.id, emma.id);
    await prisma.courseEnrollment.update({
      where: { id: booked.body.enrollment.id },
      data: { horseId: horse.id },
    });
    const before = await getWeeklyLoads({ referenceDate: course.startAt, horseIds: [horse.id] });
    expect(before.get(horse.id)).toBe(2);

    await cancel(course.id, booked.body.enrollment.id);
    const after = await getWeeklyLoads({ referenceDate: course.startAt, horseIds: [horse.id] });
    expect(after.get(horse.id) ?? 0).toBe(0);

    const detail = await request(app)
      .get(`/api/v1/courses/${course.id}`)
      .set(authHeader(adminToken));
    expect(detail.body.course._count.enrollments).toBe(0);
  });
});

describe('Concurrence', () => {
  it('deux familles sur la dernière place : une seule inscription', async () => {
    const course = await createCourse({ startAt: nextWeekDay(0), capacity: 1 });
    const emma = await createRider();
    const other = await createUser({ email: 'autre-droits@test.fr', role: 'client' });
    const otherToken = await accessTokenFor(other);
    const otherRider = await prisma.rider.create({
      data: {
        familyId: await familyIdOf(other.id),
        firstName: 'Léo',
        lastName: 'Autre',
        birthdate: new Date('2013-01-01'),
        level: 'galop_2',
        medicalCertificateStatus: 'approved',
        licenseStatus: 'approved',
      },
    });
    await giveSubscription({ riderId: otherRider.id, sessionsPerWeek: 1 });

    const results = await Promise.all([
      enroll(course.id, emma.id),
      enroll(course.id, otherRider.id, otherToken),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.courseEnrollment.count({ where: { courseId: course.id } })).toBe(1);
  });

  it('deux réservations simultanées du même cavalier : une seule séance du forfait', async () => {
    const emma = await createRider();
    const tuesday = await createCourse({ startAt: nextWeekDay(0) });
    const thursday = await createCourse({ startAt: nextWeekDay(2) });

    const results = await Promise.all([enroll(tuesday.id, emma.id), enroll(thursday.id, emma.id)]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
  });
});
