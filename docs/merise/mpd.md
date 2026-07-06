# MPD — Modèle Physique de Données

> Livrable Phase 1 (Merise). Modèle physique **PostgreSQL 17**, implémenté par
> `apps/api/prisma/schema.prisma` et la migration `prisma/migrations/*_init/migration.sql`
> (source de vérité SQL exacte). Ce document en donne la lecture synthétique : types, contraintes, index.

## Choix physiques transverses

| Choix | Justification |
|---|---|
| Clés primaires `TEXT` (cuid) | Identifiants opaques non séquentiels (pas d'énumération de ressources par ID — OWASP), générés côté application, compatibles avec la réplication |
| Montants en `INTEGER` centimes | Aucune arithmétique flottante sur l'argent |
| Énumérations en types `ENUM` PostgreSQL | Intégrité au niveau base + valeurs partagées avec le front via `packages/shared` |
| `TIMESTAMP(3)` UTC partout | Précision milliseconde, conversion de fuseau à l'affichage uniquement |
| `created_at DEFAULT now()` / `updated_at` géré par Prisma | Traçabilité uniforme |
| Suppressions logiques pour les données de facturation | RGPD : anonymisation du compte, jamais de hard delete des factures |

## Types énumérés

| Type | Valeurs |
|---|---|
| `Role` | client, instructor, admin |
| `RiderLevel` | initiation, galop_1 … galop_7 |
| `DocumentStatus` | missing, pending, approved, rejected |
| `HorseStatus` | fit, rest, unavailable, injured |
| `AffinityType` | favorite, neutral, avoid |
| `SpaceType` | indoor, outdoor, paddock |
| `CourseStatus` | draft, scheduled, ongoing, completed, cancelled |
| `RecurrenceFrequency` | weekly |
| `AttendanceStatus` | pending, present, absent, excused |
| `EventType` | stage, competition_internal, competition_external |
| `RegistrationStatus` | pending, confirmed, cancelled |
| `InvoiceStatus` | draft, sent, paid, overdue, cancelled |
| `HealthLogType` | veterinarian, farrier, dentist, care, observation |
| `IncidentSeverity` | low, medium, high, critical |
| `IncidentStatus` | open, resolved |
| `NotificationType` | subscription_confirmed, invoice_created, payment_confirmed, invoice_reminder, registration_confirmed, course_enrolled, course_cancelled, rider_absence |

## Tables (extrait des colonnes discriminantes)

| Table | Colonnes clés | Contraintes & index |
|---|---|---|
| `users` | email TEXT, password_hash TEXT, role Role, banned BOOL, anonymized_at TIMESTAMP? | UNIQUE(email) · INDEX(role) |
| `families` | user_id TEXT, subscription_plan_id TEXT?, session_quota INT | UNIQUE(user_id) · FK users, subscription_plans · INDEX(subscription_plan_id) |
| `riders` | family_id, birthdate, level RiderLevel, medical_certificate_status, license_status, medical_consent_at? | FK families · INDEX(family_id) |
| `horses` | status HorseStatus, min_level, max_level, weekly_load_hours FLOAT, max_weekly_load_hours FLOAT, alert_threshold_hours FLOAT | INDEX(status) |
| `horse_affinities` | rider_id, horse_id, affinity AffinityType | UNIQUE(rider_id, horse_id) · FK riders, horses · INDEX(horse_id) |
| `spaces` | name, type SpaceType, capacity INT? | UNIQUE(name) |
| `horse_health_logs` | horse_id, author_id?, type HealthLogType, occurred_at | FK horses, users · INDEX(horse_id, occurred_at) |
| `courses` | instructor_id, space_id, start_at, end_at, capacity, min/max_level, status CourseStatus, recurrence_rule?, recurrence_end_date?, parent_course_id? | FK users, spaces, courses(self) · INDEX(start_at), (instructor_id, start_at), (space_id, start_at), (parent_course_id) |
| `course_enrollments` | course_id, rider_id, horse_id?, attendance AttendanceStatus, horse_assigned_at? | UNIQUE(course_id, rider_id) · FK courses, riders, horses · INDEX(rider_id), (horse_id) |
| `events` | type EventType, start_at, end_at, capacity, price_cents INT | INDEX(start_at) |
| `event_registrations` | event_id, rider_id, status RegistrationStatus | UNIQUE(event_id, rider_id) · FK events, riders · INDEX(rider_id) |
| `subscription_plans` | name, price_cents INT, sessions_per_week INT, active BOOL | UNIQUE(name) |
| `discount_rules` | label, percentage INT, min_riders INT?, active BOOL | — |
| `invoices` | family_id, number, status InvoiceStatus, issued_at?, due_at?, total_cents INT, paid_at? | UNIQUE(number) · FK families · INDEX(family_id, status) |
| `invoice_items` | invoice_id, label, quantity INT, unit_cents INT, total_cents INT | FK invoices · INDEX(invoice_id) |
| `incidents` | reported_by_id, course_id?, horse_id?, rider_id?, severity, status, occurred_at, resolved_at? | FK users, courses, horses, riders · INDEX(status, severity), (horse_id) |
| `volunteer_missions` | title, start_at, end_at?, slots INT | INDEX(start_at) |
| `volunteer_signups` | mission_id, user_id | UNIQUE(mission_id, user_id) · FK missions, users |
| `conversations` | subject? | — |
| `conversation_participants` | conversation_id, user_id, last_read_at? | UNIQUE(conversation_id, user_id) · FK conversations, users · INDEX(user_id) |
| `messages` | conversation_id, sender_id, body TEXT | FK conversations, users · INDEX(conversation_id, created_at) |
| `notifications` | user_id, type NotificationType, title, body?, link_url?, read_at? | FK users · INDEX(user_id, read_at) |
| `notification_preferences` | user_id, type, email_enabled BOOL, in_app_enabled BOOL | UNIQUE(user_id, type) · FK users |
| `refresh_tokens` | user_id, token_hash, family_id TEXT, expires_at, revoked_at?, user_agent?, ip? | UNIQUE(token_hash) · FK users · INDEX(family_id), (user_id) |
| `password_reset_tokens` | user_id, token_hash, expires_at, used_at? | UNIQUE(token_hash) · FK users · INDEX(user_id) |

## Index de performance — justification

| Index | Requête servie |
|---|---|
| `courses(start_at)` | Planning global par période (cache Redis) |
| `courses(instructor_id, start_at)` | « Mon planning » moniteur |
| `courses(space_id, start_at)` | Détection de conflit d'espace à la création d'un cours |
| `course_enrollments(horse_id)` | Charge d'un cheval, chevaux déjà pris dans une séance (attribution) |
| `invoices(family_id, status)` | Facturation côté client + relances admin (impayés) |
| `messages(conversation_id, created_at)` | Pagination chronologique d'une conversation (polling) |
| `notifications(user_id, read_at)` | Badge « non lues » du dashboard |
| `refresh_tokens(family_id)` | Révocation en cascade d'une famille de jetons |
| `incidents(status, severity)` | File des incidents ouverts triés par gravité (admin) |

## Volumétrie estimée (dimensionnement)

| Table | Volume à 3 ans | Remarque |
|---|---|---|
| users / families / riders | ~500 / ~350 / ~600 | Centre de taille moyenne |
| courses | ~15 000 | ~30 séances/semaine expansées sur 3 ans |
| course_enrollments | ~120 000 | ~8 cavaliers/séance |
| invoices / invoice_items | ~12 000 / ~20 000 | Mensualités + événements |
| messages | ~50 000 | Polling, pas de temps réel |

Aucune table ne justifie de partitionnement à cet horizon ; les index ci-dessus suffisent.
