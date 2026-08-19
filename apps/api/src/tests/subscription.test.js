/**
 * Tests d'intégration — souscription famille (Excel 8.2) et membres client (Excel 7.1).
 */
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { monthlySessionQuota } from '../services/billingService.js';

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
let clientId;
let familyId;
let classique;
let decouverte;

beforeEach(async () => {
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await resetCoreTables();
  await resetAuthTables();
  await prisma.subscriptionPlan.deleteMany();
  await resetRateLimits();

  const admin = await createUser({ email: 'admin-abo@test.fr', role: 'admin' });
  const client = await createUser({
    email: 'client-abo@test.fr',
    role: 'client',
    firstName: 'Lina',
  });

  adminToken = await accessTokenFor(admin);
  clientToken = await accessTokenFor(client);
  clientId = client.id;
  familyId = await familyIdOf(clientId);

  await prisma.family.update({
    where: { id: familyId },
    data: { subscriptionPlanId: null, sessionQuota: 0 },
  });

  decouverte = await prisma.subscriptionPlan.create({
    data: { name: 'Découverte', priceCents: 4900, sessionsPerWeek: 1, active: true },
  });
  classique = await prisma.subscriptionPlan.create({
    data: { name: 'Classique', priceCents: 8900, sessionsPerWeek: 2, active: true },
  });
  await prisma.subscriptionPlan.create({
    data: { name: 'Archive', priceCents: 100, sessionsPerWeek: 1, active: false },
  });
});

afterAll(async () => {
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await resetCoreTables();
  await resetAuthTables();
  await prisma.subscriptionPlan.deleteMany();
  await prisma.$disconnect();
  redis.disconnect();
});

describe('monthlySessionQuota', () => {
  it('vaut séances/semaine × 4', () => {
    expect(monthlySessionQuota(1)).toBe(4);
    expect(monthlySessionQuota(2)).toBe(8);
  });
});

describe('GET /api/v1/public/plans', () => {
  it('liste uniquement les formules actives, sans authentification', async () => {
    const res = await request(app).get('/api/v1/public/plans');

    expect(res.status).toBe(200);
    expect(res.body.plans).toHaveLength(2);
    expect(res.body.plans.map((p) => p.name).sort()).toEqual(['Classique', 'Découverte']);
    expect(res.body.plans[0]).not.toHaveProperty('active');
  });
});

describe('Souscription client (Excel 8.2)', () => {
  it('associe la formule et initialise le quota si la famille n’a pas de plan', async () => {
    const res = await request(app)
      .post('/api/v1/client/family/subscription')
      .set(authHeader(clientToken))
      .send({ subscriptionPlanId: classique.id });

    expect(res.status).toBe(201);
    expect(res.body.subscription.subscriptionPlanId).toBe(classique.id);
    expect(res.body.subscription.sessionQuota).toBe(8);
    expect(res.body.subscription.subscriptionPlan.name).toBe('Classique');

    const family = await prisma.family.findUniqueOrThrow({ where: { id: familyId } });
    expect(family.sessionQuota).toBe(monthlySessionQuota(classique.sessionsPerWeek));
  });

  it('répond 409 si une formule est déjà associée', async () => {
    await request(app)
      .post('/api/v1/client/family/subscription')
      .set(authHeader(clientToken))
      .send({ subscriptionPlanId: decouverte.id });

    const second = await request(app)
      .post('/api/v1/client/family/subscription')
      .set(authHeader(clientToken))
      .send({ subscriptionPlanId: classique.id });

    expect(second.status).toBe(409);
    expect(second.body.error.message).toMatch(/secrétariat/i);

    const family = await prisma.family.findUniqueOrThrow({ where: { id: familyId } });
    expect(family.subscriptionPlanId).toBe(decouverte.id);
  });

  it('interdit au client de changer la formule via PATCH admin', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/families/${familyId}/subscription`)
      .set(authHeader(clientToken))
      .send({ subscriptionPlanId: classique.id });

    expect(res.status).toBe(403);
  });

  it('n’expose pas de PATCH client pour changer de formule', async () => {
    const res = await request(app)
      .patch('/api/v1/client/family/subscription')
      .set(authHeader(clientToken))
      .send({ subscriptionPlanId: classique.id });

    expect(res.status).toBe(404);
  });
});

describe('Changement de formule admin (Excel 8.2)', () => {
  it('change le plan et réinitialise le quota', async () => {
    await prisma.family.update({
      where: { id: familyId },
      data: { subscriptionPlanId: decouverte.id, sessionQuota: 1 },
    });

    const res = await request(app)
      .patch(`/api/v1/admin/families/${familyId}/subscription`)
      .set(authHeader(adminToken))
      .send({ subscriptionPlanId: classique.id });

    expect(res.status).toBe(200);
    expect(res.body.subscription.subscriptionPlanId).toBe(classique.id);
    expect(res.body.subscription.sessionQuota).toBe(8);

    const family = await prisma.family.findUniqueOrThrow({ where: { id: familyId } });
    expect(family.sessionQuota).toBe(8);
  });
});

describe('Création et édition de membres (Excel 7.1)', () => {
  it('crée un client avec une famille vide et un quota à 0', async () => {
    const res = await request(app).post('/api/v1/admin/members').set(authHeader(adminToken)).send({
      email: 'nouveau-client@test.fr',
      password: 'MotDePasse123',
      firstName: 'Nora',
      lastName: 'Martin',
      role: 'client',
    });

    expect(res.status).toBe(201);
    expect(res.body.member.role).toBe('client');
    expect(res.body.member.sessionQuota).toBe(0);

    const family = await prisma.family.findUnique({ where: { userId: res.body.member.id } });
    expect(family).not.toBeNull();
    expect(family?.subscriptionPlanId).toBeNull();
    expect(family?.sessionQuota).toBe(0);
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
