/**
 * Tests d'intégration du module auth (Supertest + Postgres de test + Redis db 1).
 * Couvre le cahier de tests T-1.1 à T-1.8 et les scénarios de sécurité
 * (rotation, réutilisation, blacklist, bannissement, rate limiting).
 */
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { banUser } from '../services/authService.js';
import { hashToken } from '../services/tokenService.js';

import { refreshCookieOf, registerPayload, resetAuthTables, resetRateLimits } from './helpers.js';

const app = createApp();

beforeEach(async () => {
  await resetAuthTables();
  await resetRateLimits();
});

afterAll(async () => {
  await resetAuthTables();
  await prisma.$disconnect();
  redis.disconnect();
});

// ---------------------------------------------------------------------------
// POST /api/v1/auth/register (T-1.1, T-1.2)
// ---------------------------------------------------------------------------
describe('POST /api/v1/auth/register', () => {
  it('crée un compte client + sa famille, renvoie access token et cookie refresh', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(registerPayload());

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      email: 'client@test.fr',
      firstName: 'Jean',
      role: 'client',
    });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.accessToken).toBeDefined();

    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toContain('equime_refresh=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/api/v1/auth');

    // La famille est créée dans la même transaction (US-1.1)
    const family = await prisma.family.findUnique({ where: { userId: res.body.user.id } });
    expect(family).not.toBeNull();

    // Le mot de passe est stocké haché en argon2id, jamais en clair
    const user = await prisma.user.findUnique({ where: { id: res.body.user.id } });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it("normalise l'email (trim + minuscules)", async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(registerPayload('  Client@Test.FR '));

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('client@test.fr');
  });

  it('refuse un email déjà utilisé (409)', async () => {
    await request(app).post('/api/v1/auth/register').send(registerPayload());
    const res = await request(app).post('/api/v1/auth/register').send(registerPayload());

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('refuse un mot de passe trop faible avec le détail des champs (400)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...registerPayload(), password: 'court' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(res.body.error.details.some((d) => d.field === 'password')).toBe(true);
  });

  it('refuse un email invalide (400)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...registerPayload(), email: 'pas-un-email' });

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/auth/login (T-1.3, T-1.4)
// ---------------------------------------------------------------------------
describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/v1/auth/register').send(registerPayload());
  });

  it('connecte un utilisateur valide', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'client@test.fr', password: 'MotDePasse123' });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('client@test.fr');
    expect(res.body.accessToken).toBeDefined();
    expect(refreshCookieOf(res)).toBeDefined();
  });

  it('refuse un mauvais mot de passe — message identique à un email inconnu (anti-énumération)', async () => {
    const badPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'client@test.fr', password: 'Mauvais12345' });
    const unknownEmail = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'inconnu@test.fr', password: 'Mauvais12345' });

    expect(badPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(badPassword.body.error.message).toBe(unknownEmail.body.error.message);
  });

  it('refuse un compte banni (403)', async () => {
    const user = await prisma.user.findUnique({ where: { email: 'client@test.fr' } });
    await banUser(user.id);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'client@test.fr', password: 'MotDePasse123' });

    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Routes protégées : requireAuth + requireRole (T-1.7, T-1.8)
// ---------------------------------------------------------------------------
describe('Routes protégées', () => {
  it('refuse une requête sans token (401)', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('refuse un token falsifié (401)', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer un.token.bidon');
    expect(res.status).toBe(401);
  });

  it('renvoie le profil avec un token valide (GET /me)', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send(registerPayload());
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${reg.body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('client@test.fr');
    expect(res.body.user.sessionQuota).toBe(0);
  });

  it('un utilisateur banni est rejeté immédiatement, même avec un access token encore valide', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send(registerPayload());
    await banUser(reg.body.user.id);

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${reg.body.accessToken}`);

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/auth/refresh — rotation et détection de réutilisation (T-1.5)
// ---------------------------------------------------------------------------
describe('POST /api/v1/auth/refresh', () => {
  it('sans cookie : 401', async () => {
    const res = await request(app).post('/api/v1/auth/refresh');
    expect(res.status).toBe(401);
  });

  it('avec un cookie invalide : 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'equime_refresh=nimporte_quoi');
    expect(res.status).toBe(401);
  });

  it('rotation : émet une nouvelle paire, révoque le token présenté, conserve la famille', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send(registerPayload());
    const cookie1 = refreshCookieOf(reg);

    const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie1);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.accessToken).not.toBe(reg.body.accessToken);
    const cookie2 = refreshCookieOf(res);
    expect(cookie2).toBeDefined();
    expect(cookie2).not.toBe(cookie1);

    const tokens = await prisma.refreshToken.findMany({
      where: { userId: reg.body.user.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(tokens).toHaveLength(2);
    expect(tokens[0].revokedAt).not.toBeNull(); // l'ancien est consommé
    expect(tokens[1].revokedAt).toBeNull();
    expect(tokens[0].familyId).toBe(tokens[1].familyId); // même famille

    // Le nouveau token fonctionne à son tour
    const res2 = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie2);
    expect(res2.status).toBe(200);
  });

  it('réutilisation détectée : toute la famille est révoquée (scénario vol de token)', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send(registerPayload());
    const stolenCookie = refreshCookieOf(reg);

    // La victime (ou l'attaquant) consomme le token : rotation normale
    const rotated = await request(app).post('/api/v1/auth/refresh').set('Cookie', stolenCookie);
    const legitCookie = refreshCookieOf(rotated);

    // L'attaquant rejoue le token déjà consommé
    const replay = await request(app).post('/api/v1/auth/refresh').set('Cookie', stolenCookie);
    expect(replay.status).toBe(401);

    // Conséquence : le token légitime (même famille) est lui aussi révoqué
    const legit = await request(app).post('/api/v1/auth/refresh').set('Cookie', legitCookie);
    expect(legit.status).toBe(401);

    const active = await prisma.refreshToken.count({
      where: { userId: reg.body.user.id, revokedAt: null },
    });
    expect(active).toBe(0);

    // Et les access tokens de la famille sont blacklistés
    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${rotated.body.accessToken}`);
    expect(me.status).toBe(401);
  });

  it('refuse un refresh token expiré (401)', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send(registerPayload());
    const cookie = refreshCookieOf(reg);
    const plain = cookie.split('=')[1];

    await prisma.refreshToken.update({
      where: { tokenHash: hashToken(plain) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(res.status).toBe(401);
  });

  it('T-1.7 : après refresh, le nouvel access token authentifie une route protégée', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send(registerPayload());
    const cookie = refreshCookieOf(reg);

    const refreshed = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(refreshed.status).toBe(200);

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${refreshed.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('client@test.fr');
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/auth/logout (T-1.6)
// ---------------------------------------------------------------------------
describe('POST /api/v1/auth/logout', () => {
  it("révoque le refresh, blackliste l'access et efface le cookie", async () => {
    const reg = await request(app).post('/api/v1/auth/register').send(registerPayload());
    const cookie = refreshCookieOf(reg);

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${reg.body.accessToken}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(204);
    expect(String(res.headers['set-cookie'])).toContain('equime_refresh=;');

    // L'access token ne fonctionne plus (blacklist Redis)
    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${reg.body.accessToken}`);
    expect(me.status).toBe(401);

    // Le refresh non plus (famille révoquée)
    const refresh = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(refresh.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Mot de passe oublié / réinitialisation
// ---------------------------------------------------------------------------
describe('POST /api/v1/auth/forgot-password + reset-password', () => {
  beforeEach(async () => {
    await request(app).post('/api/v1/auth/register').send(registerPayload());
  });

  it('répond exactement pareil que le compte existe ou non (anti-énumération)', async () => {
    const known = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'client@test.fr' });
    const unknown = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'inconnu@test.fr' });

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
  });

  it('flux complet : demande → reset → anciennes sessions révoquées → login avec le nouveau mot de passe', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'client@test.fr', password: 'MotDePasse123' });
    const oldCookie = refreshCookieOf(login);

    await request(app).post('/api/v1/auth/forgot-password').send({ email: 'client@test.fr' });

    // Le token en clair ne sort que par email : on le reconstruit via la base
    // en réinsérant un token contrôlé (même méthode de hachage que le service)
    const user = await prisma.user.findUnique({ where: { email: 'client@test.fr' } });
    const knownToken = 'token_de_test_connu';
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(knownToken),
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });

    const reset = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: knownToken, password: 'NouveauMotDePasse1' });
    expect(reset.status).toBe(200);

    // Ancien mot de passe refusé, nouveau accepté
    const oldLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'client@test.fr', password: 'MotDePasse123' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'client@test.fr', password: 'NouveauMotDePasse1' });
    expect(newLogin.status).toBe(200);

    // Les sessions antérieures au reset sont révoquées
    const refresh = await request(app).post('/api/v1/auth/refresh').set('Cookie', oldCookie);
    expect(refresh.status).toBe(401);
  });

  it('un token de réinitialisation est à usage unique', async () => {
    const user = await prisma.user.findUnique({ where: { email: 'client@test.fr' } });
    const knownToken = 'token_usage_unique';
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(knownToken),
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });

    const first = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: knownToken, password: 'NouveauMotDePasse1' });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: knownToken, password: 'EncoreUnAutre123' });
    expect(second.status).toBe(400);
  });

  it('refuse un token de réinitialisation expiré', async () => {
    const user = await prisma.user.findUnique({ where: { email: 'client@test.fr' } });
    const knownToken = 'token_expire';
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(knownToken),
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: knownToken, password: 'NouveauMotDePasse1' });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/auth/me — édition du profil (Excel 3.1)
// ---------------------------------------------------------------------------
describe('PATCH /api/v1/auth/me', () => {
  it('refuse une requête sans token (401)', async () => {
    const res = await request(app)
      .patch('/api/v1/auth/me')
      .send({ firstName: 'Marie', lastName: 'Dupont', phone: '0612345678' });
    expect(res.status).toBe(401);
  });

  it('met à jour prénom, nom et téléphone et renvoie le profil public', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send(registerPayload());

    const res = await request(app)
      .patch('/api/v1/auth/me')
      .set('Authorization', `Bearer ${reg.body.accessToken}`)
      .send({ firstName: 'Marie', lastName: 'Dupont', phone: '06 12 34 56 78' });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      id: reg.body.user.id,
      email: 'client@test.fr',
      firstName: 'Marie',
      lastName: 'Dupont',
      phone: '06 12 34 56 78',
      role: 'client',
      sessionQuota: 0,
    });
    expect(res.body.user.passwordHash).toBeUndefined();

    const stored = await prisma.user.findUnique({ where: { id: reg.body.user.id } });
    expect(stored.firstName).toBe('Marie');
    expect(stored.lastName).toBe('Dupont');
    expect(stored.phone).toBe('06 12 34 56 78');
    expect(stored.email).toBe('client@test.fr');
  });

  it('permet de vider le téléphone', async () => {
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...registerPayload(), phone: '0611111111' });

    const res = await request(app)
      .patch('/api/v1/auth/me')
      .set('Authorization', `Bearer ${reg.body.accessToken}`)
      .send({ firstName: 'Jean', lastName: 'Test', phone: '' });

    expect(res.status).toBe(200);
    expect(res.body.user.phone).toBeNull();
  });

  it('refuse un prénom vide (400)', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send(registerPayload());
    const res = await request(app)
      .patch('/api/v1/auth/me')
      .set('Authorization', `Bearer ${reg.body.accessToken}`)
      .send({ firstName: '  ', lastName: 'Dupont', phone: '0612345678' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('refuse un téléphone invalide (400)', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send(registerPayload());
    const res = await request(app)
      .patch('/api/v1/auth/me')
      .set('Authorization', `Bearer ${reg.body.accessToken}`)
      .send({ firstName: 'Marie', lastName: 'Dupont', phone: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.error.details.some((d) => d.field === 'phone')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Suppression de compte RGPD (US-1.6)
// ---------------------------------------------------------------------------
describe('DELETE /api/v1/auth/me', () => {
  it('anonymise le compte, révoque les sessions et empêche la reconnexion', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send(registerPayload());
    const userId = reg.body.user.id;
    const family = await prisma.family.findUnique({ where: { userId } });
    const rider = await prisma.rider.create({
      data: {
        familyId: family.id,
        firstName: 'Test',
        lastName: 'Rider',
        birthdate: new Date('2012-01-01'),
        level: 'initiation',
        medicalCertificateStatus: 'approved',
      },
    });
    await prisma.invoice.create({
      data: {
        familyId: family.id,
        number: 'FAC-DEL-001',
        status: 'paid',
        totalCents: 3000,
        paidAt: new Date(),
        items: { create: [{ label: 'Abo', quantity: 1, unitCents: 3000, totalCents: 3000 }] },
      },
    });

    const del = await request(app)
      .delete('/api/v1/auth/me')
      .set('Authorization', `Bearer ${reg.body.accessToken}`)
      .send({ confirmation: 'SUPPRIMER MON COMPTE' });
    expect(del.status).toBe(204);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user.anonymizedAt).not.toBeNull();
    expect(user.email).toBe(`deleted-${userId}@anonymized.local`);
    expect(user.firstName).toBe('Utilisateur');

    const riderAfter = await prisma.rider.findUnique({ where: { id: rider.id } });
    expect(riderAfter.firstName).toBe('Anonyme');

    const invoices = await prisma.invoice.count({ where: { familyId: family.id } });
    expect(invoices).toBe(1);

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${reg.body.accessToken}`);
    expect(me.status).toBe(401);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'client@test.fr', password: 'MotDePasse123' });
    expect(login.status).toBe(401);
  });

  it('exige la confirmation exacte', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send(registerPayload());
    const res = await request(app)
      .delete('/api/v1/auth/me')
      .set('Authorization', `Bearer ${reg.body.accessToken}`)
      .send({ confirmation: 'supprimer' });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/auth/me/export — portabilité RGPD
// ---------------------------------------------------------------------------
describe('GET /api/v1/auth/me/export', () => {
  it('exporte les données structurées du compte client', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send(registerPayload());

    const res = await request(app)
      .get('/api/v1/auth/me/export')
      .set('Authorization', `Bearer ${reg.body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.format).toBe('equime-portability-v1');
    expect(res.body.profile.email).toBe('client@test.fr');
    expect(res.body.family).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Purge refresh tokens expirés
// ---------------------------------------------------------------------------
describe('purgeExpiredRefreshTokens', () => {
  it('supprime les tokens expirés de la base', async () => {
    const { purgeExpiredRefreshTokens } = await import('../services/tokenService.js');
    const reg = await request(app).post('/api/v1/auth/register').send(registerPayload());

    await prisma.refreshToken.updateMany({
      where: { userId: reg.body.user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const count = await purgeExpiredRefreshTokens();
    expect(count).toBeGreaterThan(0);

    const remaining = await prisma.refreshToken.count({ where: { userId: reg.body.user.id } });
    expect(remaining).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Rate limiting Redis
// ---------------------------------------------------------------------------
describe('Rate limiting', () => {
  it('bloque après 10 tentatives de login dans la fenêtre (429 + Retry-After)', async () => {
    const attempt = () =>
      request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'brute@test.fr', password: 'ForceButee123' });

    for (let i = 0; i < 10; i += 1) {
      const res = await attempt();
      expect(res.status).toBe(401); // sous la limite : erreur métier normale
    }

    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('expose les en-têtes X-RateLimit-*', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'headers@test.fr', password: 'MotDePasse123' });

    expect(res.headers['x-ratelimit-limit']).toBe('10');
    expect(Number(res.headers['x-ratelimit-remaining'])).toBeLessThan(10);
  });
});
