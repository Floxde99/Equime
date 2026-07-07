# Matrice de traçabilité — Equime

> Phase 7 : lien entre user stories majeures, modules, fichiers/tests et statut de livraison.
> Référence backlog : `docs/backlog.md`.

Légende statut : **Livré** | **Partiel** | **Prévu**

| US | Intitulé (résumé) | Module | Fichiers principaux | Tests | Statut |
|---|---|---|---|---|---|
| US-1.1–1.5 | Auth inscription / session | auth | `apps/api/src/routes/auth.routes.js`, `apps/web/src/features/auth/` | `apps/api/src/tests/auth*.js`, `playwright/e2e/auth.spec.js` | Livré |
| US-1.6 | Suppression compte RGPD | auth | auth service + `docs/rgpd.md` | tests auth / manuel | Partiel |
| US-2.1 | CRUD cavaliers | riders | `riderService.js`, `RidersPage.jsx`, `riders.routes.js` | `core.test.js`, `client-flow.spec.js` | Livré |
| US-2.2 | Documents + consentement | riders / uploads | `uploads.js`, `EnrollSection.jsx`, schéma `riders.js` | `core.test.js`, recette T-RGPD | Partiel |
| US-2.3 | Affinités chevaux | horses / riders | `horseAssignment.js`, cavaliers API | `horseAssignment.test.js` | Livré |
| US-3.1–3.2 | Fiches chevaux & santé | horses | `horseService.js`, `AdminCavalryPage.jsx` | `phase4.test.js` | Livré |
| US-3.3 | Espaces | spaces | `spaceService.js`, admin planning | `core.test.js` | Livré |
| US-4.1–4.4 | Cours, planning, appel | courses / planning | `courseService.js`, `recurrence.js`, `PlanningCalendar.jsx`, `AttendancePage.jsx` | `recurrence.test.js`, `core.test.js`, E2E-2/3 | Livré |
| US-5.1–5.3 | Attribution chevaux | horses | `horseAssignment.js`, moniteur planning | `horseAssignment.test.js`, E2E-3 | Livré |
| US-6.1–6.3 | Facturation | billing | `billingService.js`, `pricing.js`, pages admin/client factures | `pricing.test.js`, `phase4.test.js`, `billing-flow.spec.js` | Livré |
| US-7.1–7.3 | Événements | events | `eventService.js`, `AdminEventsPage.jsx`, `ClientEventsPage.jsx` | `phase5.test.js` | Livré |
| US-8.1 | Messagerie | messages | `messageService.js`, `MessagesPage.jsx` | `phase5.test.js`, T-S.2 | Livré |
| US-8.2 | Incidents | incidents | `incidentService.js`, `InstructorIncidentsPage.jsx` | `phase5.test.js` | Livré |
| US-8.3 | Bénévolat | volunteer | `volunteerService.js`, `VolunteerPage.jsx` | `phase5.test.js` | Livré |
| US-8.4 | Notifications | notifications | `notificationService.js`, `NotificationsPage.jsx` | `phase5.test.js` | Livré |
| US-9.1 | Dashboard KPIs | admin | `AdminDashboardPage.jsx`, routes admin | manuel / recette | Partiel |
| US-9.2 | Gestion membres | admin | `admin.routes.js` | manuel | Partiel |

## Couverture tests automatisés

| Niveau | Emplacement | Périmètre |
|---|---|---|
| Unitaire | `apps/api/src/services/*.test.js` | récurrence, pricing, attribution |
| Intégration API | `apps/api/src/tests/core.test.js`, `phase4.test.js`, `phase5.test.js` | parcours métier par phase |
| E2E | `playwright/e2e/*.spec.js` | 4 parcours E2E-1 à E2E-4 |
| CI | `.github/workflows/ci.yml` | lint, tests API, couverture, Playwright |

## Documents associés

- Recette : `docs/cahier-de-recette.md`
- Tests détaillés : `docs/cahier-de-tests.md`
- Sécurité OWASP : `docs/securite.md`
- RGPD : `docs/rgpd.md`

