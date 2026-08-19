# Matrice de traçabilité — Equime

> Phase 7 : lien entre user stories majeures, modules, fichiers/tests et statut de livraison.
> Référence backlog : `docs/backlog.md`.

Légende statut : **Livré** | **Partiel** | **Prévu**

| US | Intitulé (résumé) | Module | Fichiers principaux | Tests | Statut |
|---|---|---|---|---|---|
| US-1.1–1.5 | Auth inscription / session | auth | `apps/api/src/routes/auth.routes.js`, `apps/web/src/features/auth/` | `apps/api/src/tests/auth*.js`, `playwright/e2e/auth.spec.js` | Livré |
| US-1.6 | Suppression compte RGPD | auth | `authService.js`, `auth.routes.js`, `ClientAccountPage.jsx` | `auth.test.js` (DELETE /me) | Livré |
| US-1.7 | Édition profil (Excel 3.1) | auth | `authService.js` (`updateMe`), `auth.routes.js`, `ClientAccountPage.jsx` | `auth.test.js` (PATCH /me) | Livré |
| US-2.1 | CRUD cavaliers | riders | `riderService.js`, `RidersPage.jsx`, `riders.routes.js` | `core.test.js`, `client-flow.spec.js` | Livré |
| US-2.2 | Documents + consentement | riders / uploads | `uploads.js`, `EnrollSection.jsx`, schéma `riders.js` | `core.test.js`, recette T-RGPD | Livré |
| US-2.3 | Affinités chevaux | horses / riders | `horseAssignment.js`, cavaliers API | `horseAssignment.test.js` | Livré |
| US-3.1–3.2 | Fiches chevaux & santé | horses | `horseService.js`, `AdminCavalryPage.jsx`, `InstructorHealthPage.jsx` | `phase4.test.js` | Livré |
| US-3.3 | Espaces | spaces | `spaceService.js`, `AdminCavalryPage.jsx` (CRUD + dialog d’édition) | `core.test.js` | Livré |
| US-4.1–4.4 | Cours, planning, appel | courses / planning | `courseService.js`, `recurrence.js`, `PlanningCalendar.jsx`, `AttendancePage.jsx` | `recurrence.test.js`, `core.test.js`, E2E-2/3 | Livré |
| US-4.3 / 7.2 | Blocage documents + expiration (Excel 7.2) | courses / events | `riderDocuments.js`, `courseService.js`, `eventService.js`, `RidersPage.jsx`, `AdminMembersPage.jsx` | `riderDocuments.test.js`, `core.test.js`, `admin.test.js`, `phase5.test.js` | Livré |
| US-4.5 | Excuse client (Excel 3.7) | courses | `courseService.js`, `UpcomingEnrollments.jsx`, planning / dashboard client | `core.test.js` (absence famille) | Livré |
| US-5.1–5.3 | Attribution chevaux (cours + stages Excel 11.2) | horses / events | `horseAssignment.js`, `eventService.js`, `AdminEventsPage.jsx` | `horseAssignment.test.js`, `phase4.test.js`, `phase5.test.js` | Livré |
| US-6.1–6.3 | Facturation | billing | `billingService.js`, `pricing.js`, `invoicePdf.js`, pages admin/client factures | `pricing.test.js`, `invoicePdf.test.js`, `phase4.test.js`, `billing-flow.spec.js` | Livré |
| US-6.4 | Factures abo batch (Excel 12.1) | billing | `billingService.js` (`generateSubscriptionInvoices`), `AdminBillingPage.jsx` | `phase4.test.js` | Livré |
| US-6.5 | Souscription formule (Excel 8.2) | billing | `billingService.js`, `client.routes.js`, `admin.routes.js`, `public.routes.js`, `ClientAccountPage.jsx` | `subscription.test.js` | Livré |
| US-7.2 / 12.1 | Facture auto stage tarifé | events / billing | `eventService.js`, `billingService.js` (`createSentInvoiceForEventRegistration`) | `phase5.test.js` | Livré |
| US-7.1 | Coordonnées vitrine (Excel 1.1) | home | `HomePage.jsx`, `clubContact.js` | `clubContact.test.js` | Livré |
| US-7.1b | Newsletter vitrine | home / public | `newsletterService.js`, `HomePage.jsx` | `newsletter.test.js` | Livré |
| US-7.1c | Vitrine live formules + cours (Excel 1.2) | home / public | `public.routes.js`, `courseService.js` (`listPublicCourses`), `HomePage.jsx` | `publicVitrine.test.js`, `money.test.js`, `publicSchedule.test.js` | Livré |
| US-7.1–7.3 | Événements | events | `eventService.js`, `AdminEventsPage.jsx`, `ClientEventsPage.jsx` | `phase5.test.js` | Livré |
| US-8.1 | Messagerie | messages | `messageService.js`, `MessagesPage.jsx` | `phase5.test.js`, T-S.2 | Livré |
| US-8.2 | Incidents | incidents | `incidentService.js`, `InstructorIncidentsPage.jsx` | `phase5.test.js` | Livré |
| US-8.3 | Bénévolat | volunteer | `volunteerService.js`, `VolunteerPage.jsx` | `phase5.test.js` | Livré |
| US-8.4 | Notifications | notifications | `notificationService.js`, `NotificationsPage.jsx` | `phase5.test.js` | Livré |
| US-9.1 | Dashboard KPIs | admin | `AdminDashboardPage.jsx`, `adminService.js` | `admin.test.js` T-9.1 | Livré |
| US-9.2 | Gestion membres (Excel 7.1) | admin | `authService.js` (`createMember`, `updateMemberProfile`), `admin.routes.js`, `AdminMembersPage.jsx` | `admin.test.js` T-9.2, `subscription.test.js` | Livré |
| US-9.3 | Validation documents | admin / riders | `riderService.js`, `AdminMembersPage.jsx` | `admin.test.js` T-9.3 | Livré |
| US-9.4 | Inscription forcée admin (Excel 10.4) | courses / events | `courseService.js`, `eventService.js` (`force: true`) | `core.test.js`, `phase5.test.js` | Livré |

## Couverture tests automatisés

| Niveau | Emplacement | Périmètre |
|---|---|---|
| Unitaire | `apps/api/src/services/*.test.js`, `apps/api/src/lib/*.test.js` | récurrence, pricing, attribution, documents cavalier |
| Intégration API | `apps/api/src/tests/core.test.js`, `phase4.test.js`, `phase5.test.js` | parcours métier par phase |
| E2E | `playwright/e2e/*.spec.js` | 4 parcours métier critiques (E2E-1–4) + extension fumée/modules (E2E-5–13) |
| CI | `.github/workflows/ci.yml` | lint, tests API, couverture, Playwright |

## Documents associés

- Recette : `docs/cahier-de-recette.md`
- Tests détaillés : `docs/cahier-de-tests.md`
- Sécurité OWASP : `docs/securite.md`
- RGPD : `docs/rgpd.md`

