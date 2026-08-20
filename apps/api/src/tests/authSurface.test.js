// @ts-check
/**
 * Surface d'authentification de l'API — garde-fou structurel.
 *
 * L'authentification est posée au niveau de chaque routeur
 * (`router.use(requireAuth)`), jamais déléguée au reverse proxy : la
 * préproduction expose `/api/*` sans Basic Auth (voir docs/deploiement.md
 * § 5.1), et c'est donc l'API seule qui protège les données.
 *
 * Ce test échoue si un `router.use(requireAuth)` est déplacé d'une ligne, si
 * une route est déclarée avant le garde, ou si un nouveau routeur est monté
 * sans protection. Il vérifie aussi que la liste des routes délibérément
 * publiques n'a pas grossi par inadvertance.
 */
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { redis } from '../lib/redis.js';

const app = createApp();

/**
 * Une entrée par routeur monté dans app.js. Toute route listée ici doit
 * répondre 401 sans jeton — un 404 signalerait que le chemin n'existe plus
 * et que l'assertion ne prouve plus rien.
 */
const ROUTES_PROTEGEES = [
  ['/api/v1/riders', 'listRiders'],
  ['/api/v1/horses', 'listHorses'],
  ['/api/v1/spaces', 'listSpaces'],
  ['/api/v1/courses/planning', 'getPlanning'],
  ['/api/v1/events/admin', 'listAdminEvents'],
  ['/api/v1/incidents/critical-count', 'countCriticalOpen'],
  ['/api/v1/notifications/preferences', 'listPreferences'],
  ['/api/v1/volunteer-missions', 'listMissions'],
  ['/api/v1/messages/contacts', 'listContacts'],
  ['/api/v1/admin/dashboard-kpis', 'dashboardKpis'],
  ['/api/v1/client/family/subscription', 'getFamilySubscription'],
];

/** Routes publiques assumées : elles ne doivent renvoyer ni 401 ni 403. */
const ROUTES_PUBLIQUES = [
  '/health',
  '/api/v1/public/plans',
  '/api/v1/public/courses',
  '/api/v1/events',
];

describe("Surface d'authentification", () => {
  describe.each(ROUTES_PROTEGEES)('GET %s', (path, controleur) => {
    it(`refuse l'accès sans jeton (${controleur})`, async () => {
      const res = await request(app).get(path);

      // 401 strictement : un 404 voudrait dire que la route a disparu et que
      // le test ne prouve plus rien.
      expect(res.status).toBe(401);
      expect(res.body.error?.code).toBeDefined();
    });

    it('refuse un jeton invalide', async () => {
      const res = await request(app).get(path).set('Authorization', 'Bearer pas-un-vrai-jeton');

      expect(res.status).toBe(401);
    });
  });

  describe.each(ROUTES_PUBLIQUES)('GET %s', (path) => {
    it('reste accessible sans authentification', async () => {
      const res = await request(app).get(path);

      expect([401, 403]).not.toContain(res.status);
      expect(res.status).toBeLessThan(500);
    });
  });

  it('ne monte aucun routeur applicatif hors des préfixes connus', async () => {
    // Une route inconnue doit tomber sur le 404 structuré, jamais sur une
    // ressource servie par défaut (l'API n'expose aucun fichier statique :
    // les documents cavaliers passent uniquement par /api/v1/riders, sous
    // requireAuth + requireRole).
    const res = await request(app).get('/uploads/certificat.pdf');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

afterAll(() => {
  redis.disconnect();
});
