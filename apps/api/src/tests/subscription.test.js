/**
 * Tests d'intégration — forfaits de saison par cavalier (ADR 011) et membres client (Excel 7.1).
 */
import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

import {
  accessTokenFor,
  authHeader,
  createUser,
  familyIdOf,
  resetAuthTables,
  resetBillingTables,
  resetCoreTables,
  resetRateLimits,
} from './coreHelpers.js';

const app = createApp();

let adminToken;
let clientToken;
let clientUser;
let clientId;
let familyId;
let classique;
let decouverte;
let archived;

/** Horloge figée (Date uniquement : les timers restent réels pour Prisma et Supertest). */
function freezeAt(iso) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(iso));
}

/** @param {{ firstName?: string, family?: string }} [input] */
function createRider({ firstName = 'Emma', family = familyId } = {}) {
  return prisma.rider.create({
    data: {
      familyId: family,
      firstName,
      lastName: 'Martin',
      birthdate: new Date('2014-03-12'),
      level: 'galop_2',
    },
  });
}

/** @param {string} riderId @param {object} body @param {string} [token] */
function subscribe(riderId, body, token = clientToken) {
  return request(app)
    .post(`/api/v1/riders/${riderId}/subscriptions`)
    .set(authHeader(token))
    .send(body);
}

/** @param {string} riderId @param {object} query */
function preview(riderId, query) {
  return request(app)
    .get(`/api/v1/riders/${riderId}/subscription-preview`)
    .query(query)
    .set(authHeader(clientToken));
}

beforeEach(async () => {
  await resetBillingTables();
  await resetCoreTables();
  await resetAuthTables();
  await prisma.discountRule.deleteMany();
  await prisma.subscriptionPlan.deleteMany();
  await prisma.clubSettings.deleteMany();
  await resetRateLimits();

  const admin = await createUser({ email: 'admin-abo@test.fr', role: 'admin' });
  const client = await createUser({
    email: 'client-abo@test.fr',
    role: 'client',
    firstName: 'Lina',
  });

  adminToken = await accessTokenFor(admin);
  clientToken = await accessTokenFor(client);
  clientUser = client;
  clientId = client.id;
  familyId = await familyIdOf(clientId);

  // Prix de la saison complète (ADR 011)
  decouverte = await prisma.subscriptionPlan.create({
    data: { name: 'Découverte', priceCents: 49_000, sessionsPerWeek: 1, active: true },
  });
  classique = await prisma.subscriptionPlan.create({
    data: { name: 'Classique', priceCents: 89_000, sessionsPerWeek: 2, active: true },
  });
  archived = await prisma.subscriptionPlan.create({
    data: { name: 'Archive', priceCents: 1_000, sessionsPerWeek: 1, active: false },
  });
  await prisma.discountRule.create({
    data: { label: 'Famille nombreuse', percentage: 10, minRiders: 2 },
  });
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  await resetBillingTables();
  await resetCoreTables();
  await resetAuthTables();
  await prisma.discountRule.deleteMany();
  await prisma.subscriptionPlan.deleteMany();
  await prisma.$disconnect();
  redis.disconnect();
});

describe('GET /api/v1/public/plans', () => {
  it('liste uniquement les forfaits actifs, sans authentification', async () => {
    const res = await request(app).get('/api/v1/public/plans');

    expect(res.status).toBe(200);
    expect(res.body.plans).toHaveLength(2);
    expect(res.body.plans.map((p) => p.name).sort()).toEqual(['Classique', 'Découverte']);
    expect(res.body.plans[0]).not.toHaveProperty('active');
  });
});

describe('Forfait de saison par cavalier (ADR 011)', () => {
  it('présente un aperçu en 10 fois avant la saison, sans rien enregistrer', async () => {
    freezeAt('2026-07-10T10:00:00.000Z');
    const emma = await createRider();

    const res = await preview(emma.id, {
      planId: classique.id,
      paymentSchedule: 'ten_installments',
    });

    expect(res.status).toBe(200);
    expect(res.body.preview).toMatchObject({
      season: { label: '2026-2027' },
      prorated: false,
      discount: null,
      totalCents: 89_000,
      alreadySubscribed: false,
    });
    expect(res.body.preview.installments).toHaveLength(10);
    expect(res.body.preview.installments.every((i) => i.amountCents === 8_900)).toBe(true);
    expect(res.body.preview.installments[0].dueAt).toBe('2026-09-04T22:00:00.000Z');
    expect(await prisma.invoice.count()).toBe(0);
  });

  it('souscrit : facture émise, échéancier et droits du cavalier', async () => {
    freezeAt('2026-07-10T10:00:00.000Z');
    const emma = await createRider();

    const res = await subscribe(emma.id, {
      planId: classique.id,
      paymentSchedule: 'ten_installments',
    });

    expect(res.status).toBe(201);
    expect(res.body.subscription).toMatchObject({
      paymentSchedule: 'ten_installments',
      priceCents: 89_000,
      discountPercent: 0,
      status: 'active',
      plan: { name: 'Classique', sessionsPerWeek: 2 },
    });
    expect(res.body.invoice.status).toBe('sent');
    expect(res.body.invoice.totalCents).toBe(89_000);
    expect(res.body.invoice.items[0].label).toBe(
      'Forfait Classique — Emma Martin — saison 2026-2027'
    );
    expect(res.body.invoice.installments).toHaveLength(10);

    const notifications = await prisma.notification.findMany({
      where: { userId: clientId },
      orderBy: { createdAt: 'asc' },
    });
    expect(notifications.map((n) => n.type)).toEqual(['subscription_confirmed', 'invoice_created']);

    const entitlements = await request(app)
      .get('/api/v1/client/entitlements')
      .set(authHeader(clientToken));
    expect(entitlements.status).toBe(200);
    expect(entitlements.body.rules).toEqual({
      cancellationDeadlineHours: 24,
      makeupValidityDays: 60,
    });
    expect(entitlements.body.riders[0]).toMatchObject({
      firstName: 'Emma',
      sessionsPerWeek: 2,
      usedThisWeek: 0,
      credits: [],
      subscription: { plan: { name: 'Classique' }, invoiceId: res.body.invoice.id },
    });
  });

  it('applique la réduction famille selon les cavaliers déjà abonnés, pas les profils', async () => {
    freezeAt('2026-07-10T10:00:00.000Z');
    const emma = await createRider();
    const lucas = await createRider({ firstName: 'Lucas' });
    await createRider({ firstName: 'Profil vide' });

    // Trois profils, mais aucun forfait encore : pas de réduction
    const alone = await preview(emma.id, { planId: classique.id, paymentSchedule: 'quarterly' });
    expect(alone.body.preview.discount).toBeNull();

    await subscribe(emma.id, { planId: classique.id, paymentSchedule: 'ten_installments' });

    const res = await subscribe(lucas.id, { planId: classique.id, paymentSchedule: 'quarterly' });
    expect(res.status).toBe(201);
    expect(res.body.subscription.discountPercent).toBe(10);
    expect(res.body.invoice.totalCents).toBe(80_100);
    expect(res.body.invoice.items.map((i) => i.totalCents)).toEqual([89_000, -8_900]);
    expect(res.body.invoice.installments.map((i) => i.amountCents)).toEqual([
      26_700, 26_700, 26_700,
    ]);
    expect(res.body.invoice.installments.map((i) => i.dueAt)).toEqual([
      '2026-09-04T22:00:00.000Z',
      '2027-01-04T23:00:00.000Z',
      '2027-04-04T22:00:00.000Z',
    ]);
  });

  it('arrivée en cours de saison : prorata et première échéance immédiate', async () => {
    freezeAt('2026-11-10T10:00:00.000Z');
    // Jeton émis à la date simulée (sinon expiré)
    clientToken = await accessTokenFor(clientUser);
    const emma = await createRider();

    const res = await subscribe(emma.id, {
      planId: classique.id,
      paymentSchedule: 'ten_installments',
    });

    expect(res.status).toBe(201);
    // 34 semaines restantes sur 44
    expect(res.body.invoice.totalCents).toBe(Math.round((89_000 * 34) / 44));
    expect(res.body.invoice.items[0].label).toContain('à partir du 10/11/2026');
    const installments = res.body.invoice.installments;
    expect(installments).toHaveLength(8);
    expect(installments[0].dueAt).toBe('2026-11-10T10:00:00.000Z');
    expect(installments[1].dueAt).toBe('2026-12-04T23:00:00.000Z');
    expect(installments.reduce((sum, i) => sum + i.amountCents, 0)).toBe(
      res.body.invoice.totalCents
    );
  });

  it('refuse un second forfait sur la même saison, un forfait archivé et un autre foyer', async () => {
    const emma = await createRider();
    const first = await subscribe(emma.id, {
      planId: decouverte.id,
      paymentSchedule: 'ten_installments',
    });
    expect(first.status).toBe(201);

    const second = await subscribe(emma.id, {
      planId: classique.id,
      paymentSchedule: 'quarterly',
    });
    expect(second.status).toBe(409);
    expect(second.body.error.message).toMatch(/Emma a déjà le forfait « Découverte »/);

    const lucas = await createRider({ firstName: 'Lucas' });
    const inactive = await subscribe(lucas.id, {
      planId: archived.id,
      paymentSchedule: 'quarterly',
    });
    expect(inactive.status).toBe(404);

    const other = await createUser({ email: 'autre-abo@test.fr', role: 'client' });
    const foreignRider = await createRider({ family: await familyIdOf(other.id) });
    const foreign = await subscribe(foreignRider.id, {
      planId: classique.id,
      paymentSchedule: 'quarterly',
    });
    expect(foreign.status).toBe(404);

    const invalid = await subscribe(lucas.id, { planId: classique.id, paymentSchedule: 'monthly' });
    expect(invalid.status).toBe(400);
  });

  it('le secrétariat souscrit pour une famille puis arrête le forfait', async () => {
    const emma = await createRider();

    const res = await request(app)
      .post(`/api/v1/admin/riders/${emma.id}/subscriptions`)
      .set(authHeader(adminToken))
      .send({ planId: decouverte.id, paymentSchedule: 'quarterly' });
    expect(res.status).toBe(201);

    const forbidden = await request(app)
      .post(`/api/v1/admin/subscriptions/${res.body.subscription.id}/end`)
      .set(authHeader(clientToken));
    expect(forbidden.status).toBe(403);

    const ended = await request(app)
      .post(`/api/v1/admin/subscriptions/${res.body.subscription.id}/end`)
      .set(authHeader(adminToken));
    expect(ended.status).toBe(200);
    expect(ended.body.subscription.status).toBe('ended');
    expect(ended.body.subscription.endedAt).toBeTruthy();

    const again = await request(app)
      .post(`/api/v1/admin/subscriptions/${res.body.subscription.id}/end`)
      .set(authHeader(adminToken));
    expect(again.status).toBe(409);

    const members = await request(app).get('/api/v1/admin/members').set(authHeader(adminToken));
    const family = members.body.members.find((m) => m.id === clientId).family;
    expect(family.riders[0].subscriptions).toEqual([]);
  });

  it('refuse de supprimer un forfait déjà souscrit (archivage à la place)', async () => {
    const emma = await createRider();
    await subscribe(emma.id, { planId: decouverte.id, paymentSchedule: 'quarterly' });

    const res = await request(app)
      .delete(`/api/v1/admin/subscription-plans/${decouverte.id}`)
      .set(authHeader(adminToken));
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/archivez-le/);
  });
});

describe('Création et édition de membres (Excel 7.1)', () => {
  it('crée un client avec une famille vide', async () => {
    const res = await request(app).post('/api/v1/admin/members').set(authHeader(adminToken)).send({
      email: 'nouveau-client@test.fr',
      password: 'MotDePasse123',
      firstName: 'Nora',
      lastName: 'Martin',
      role: 'client',
    });

    expect(res.status).toBe(201);
    expect(res.body.member.role).toBe('client');

    const family = await prisma.family.findUnique({
      where: { userId: res.body.member.id },
      include: { riders: true },
    });
    expect(family).not.toBeNull();
    expect(family?.riders).toEqual([]);
  });

  it('refuse de créer un administrateur via cet endpoint', async () => {
    const res = await request(app).post('/api/v1/admin/members').set(authHeader(adminToken)).send({
      email: 'intrus-admin@test.fr',
      password: 'MotDePasse123',
      firstName: 'Ada',
      lastName: 'Admin',
      role: 'admin',
    });

    expect(res.status).toBe(400);
  });

  it('met à jour le profil d’un membre sans changer le rôle', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/members/${clientId}`)
      .set(authHeader(adminToken))
      .send({ firstName: 'Lina', lastName: 'Dupont', phone: '0611223344' });

    expect(res.status).toBe(200);
    expect(res.body.member).toMatchObject({
      firstName: 'Lina',
      lastName: 'Dupont',
      phone: '0611223344',
      role: 'client',
    });
  });
});
