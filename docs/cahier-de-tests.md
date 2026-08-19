# Cahier de tests — Equime

> Livrable Phase 1, **enrichi à chaque phase**. Scénarios fonctionnels par module, reliés aux
> user stories (`docs/backlog.md`). En Phase 6, ce cahier dérive le cahier de recette exécuté en
> préproduction (`docs/cahier-de-recette.md`).
>
> Statuts : ⬜ à exécuter · ✅ conforme · ❌ non conforme · ➖ non applicable à cette phase.
> Les colonnes « Automatisé » référencent les tests Vitest/Supertest/Playwright correspondants.

## Environnements d'exécution

| Type | Où | Quand |
|---|---|---|
| Tests unitaires / intégration | CI (GitHub Actions) + poste dev | À chaque commit |
| Tests fonctionnels manuels | Environnement Docker dev (seed `seed.js`) | Fin de chaque phase |
| Recette | Préproduction (seed `seed-recette.js`) | Phase 6, avant chaque mise en prod |

Comptes de test (seed dev) : `admin@equime.local` (admin) · `coach@equime.local` (moniteur) ·
`lina@equime.local`, `alex@equime.local` (clients) — mot de passe commun `Equime!2026`.

---

## Module 0 — Socle (Phase 0)

| ID | Scénario | Étapes | Résultat attendu | Auto | Statut |
|---|---|---|---|---|---|
| T-0.1 | Santé de l'API | GET /health | 200, `status: ok`, état Redis | ✅ Supertest | ✅ |
| T-0.2 | Route inconnue | GET /nope | 404, erreur structurée `NOT_FOUND`, pas de stack | ✅ Supertest | ✅ |
| T-0.3 | Config invalide | Démarrer l'API sans `DATABASE_URL` | Crash explicite listant la variable manquante | ⬜ | ⬜ |
| T-0.4 | Vitrine placeholder | Ouvrir http://localhost:5173 | Thème navy/or, polices chargées, un seul CTA or | manuel | ✅ |

## Module 1 — Authentification (Phase 2)

| ID | Scénario | Étapes | Résultat attendu | Auto | Statut |
|---|---|---|---|---|---|
| T-1.1 | Inscription nominale | POST /auth/register (email neuf, mdp fort) | 201, famille créée, connexion automatique | ✅ intégration | ✅ |
| T-1.2 | Email déjà pris | Register avec email existant | Erreur générique, pas de fuite d'existence | ✅ intégration | ✅ |
| T-1.3 | Mot de passe faible | Register mdp < 12 caractères | 400 Zod avec message d'aide | ✅ intégration | ✅ |
| T-1.4 | Connexion OK | Login lina@equime.local | 200, access en mémoire, cookie refresh httpOnly | ✅ intégration | ✅ |
| T-1.5 | Connexion KO | Login mauvais mot de passe | 401 générique | ✅ intégration | ✅ |
| T-1.6 | Compte banni | Login utilisateur banni | 403, connexion refusée | ✅ intégration | ✅ |
| T-1.7 | Rotation du refresh | Attendre expiration access → appel API | Refresh silencieux, requête rejouée, ancien refresh révoqué | ✅ intégration | ⬜ |
| T-1.8 | Réutilisation détectée | Rejouer un refresh déjà rotaté | 401, **toute la famille révoquée**, session légitime déconnectée | ✅ intégration | ✅ |
| T-1.9 | Route protégée sans token | GET /api/v1/auth/me sans Bearer | 401 | ✅ intégration | ✅ |
| T-1.10 | Rôle insuffisant | Client sur route admin | 403 | ✅ intégration | ✅ |
| T-1.11 | Rate limiting | 11 logins ratés en 15 min même IP | 429 | ✅ intégration | ✅ |
| T-1.12 | Mot de passe oublié | Demande + reset via lien email | 200 systématique ; nouveau mdp actif ; sessions révoquées | ✅ intégration | ✅ |
| T-1.13 | Déconnexion | Logout puis rejeu de l'ancien access | 401 (blacklist Redis) | ✅ intégration | ✅ |
| T-1.14 | Suppression compte RGPD | DELETE /auth/me avec confirmation | 204, anonymisation, factures conservées, sessions révoquées | ✅ `auth.test.js` | ✅ |

## Module 2 — Famille & cavaliers (Phase 3)

| ID | Scénario | Étapes | Résultat attendu | Auto | Statut |
|---|---|---|---|---|---|
| T-2.1 | Ajout cavalier | Client ajoute un cavalier complet | 201, visible dans la liste famille | ✅ intégration | ⬜ |
| T-2.2 | Isolation famille | Lina tente GET des cavaliers d'Alex | 403/404 — aucune fuite | ⬜ intégration | ⬜ |
| T-2.3 | Upload certificat | PDF 2 Mo avec consentement coché | Statut « en attente », fichier servi authentifié seulement | ⬜ intégration | ⬜ |
| T-2.4 | Upload invalide | .exe renommé en .pdf, ou 8 Mo | 400 — MIME réel et taille contrôlés | ⬜ intégration | ⬜ |
| T-2.5 | Upload sans consentement | Certificat sans consentement | 400, rien n'est stocké | ⬜ intégration | ⬜ |
| T-2.6 | Affinités | Déclarer favori + à éviter | Persisté, unique par couple, visible en Phase 4 dans les scores | ⬜ intégration | ⬜ |

## Module 3 — Cavalerie & espaces (Phase 3)

| ID | Scénario | Étapes | Résultat attendu | Auto | Statut |
|---|---|---|---|---|---|
| T-3.1 | CRUD cheval | Admin crée/modifie/supprime | Badges de statut conformes au design system | ✅ intégration | ⬜ |
| T-3.2 | Changement de statut | Passer Sultan `injured` → `fit` | Historique cohérent, cheval redevenu éligible | ⬜ intégration | ⬜ |
| T-3.3 | Carnet de santé | Ajouter une entrée vétérinaire | Listée anti-chronologiquement ; moniteur lit, seul admin écrit | ⬜ intégration | ⬜ |
| T-3.4 | Conflit d'espace | 2 cours simultanés même espace | Refus avec message explicite | ✅ intégration | ⬜ |

## Module 4 — Cours & planning (Phase 3)

| ID | Scénario | Étapes | Résultat attendu | Auto | Statut |
|---|---|---|---|---|---|
| T-4.1 | Récurrence 8 semaines | Créer cours hebdo avec date de fin | 8 séances générées rattachées à la série | ✅ unit (recurrence.js) + intégration | ⬜ |
| T-4.2 | Annulation d'une séance | Annuler séance 3 seulement | Les 7 autres inchangées ; notification `course_cancelled` aux inscrits | ⬜ intégration | ⬜ |
| T-4.3 | Inscription niveau OK | Emma (G3) sur cours G2-4 | 201, quota décrémenté | ✅ intégration | ⬜ |
| T-4.4 | Inscription niveau KO | Lucas (initiation) sur cours G5+ | 400 avec raison | ⬜ intégration | ⬜ |
| T-4.5 | Cours complet | Inscrire au-delà de la capacité | Refus explicite | ⬜ intégration | ⬜ |
| T-4.6 | Présences | Moniteur pointe présent/absent/excusé | Persisté ; absence → notification famille | ⬜ intégration | ⬜ |
| T-4.7 | Cache planning | 2 lectures puis mutation puis relecture | 2ᵉ lecture servie par Redis ; mutation invalide le cache | ⬜ intégration | ⬜ |

## Module 5 — Attribution des chevaux (Phase 4) ⭐

| ID | Scénario | Étapes | Résultat attendu | Auto | Statut |
|---|---|---|---|---|---|
| T-5.1 | Cas nominal | Séance seed : Emma (favori Indigo disponible) | Indigo attribué (+10), charge +1 h | ⬜ unit + intégration | ⬜ |
| T-5.2 | Affinité avoid | Seul cheval restant : « à éviter » | Attribué en dernier recours ou conflit signalé selon score −15 | ⬜ unit | ⬜ |
| T-5.3 | Cheval surchargé | Charge = max | Écarté de l'éligibilité | ⬜ unit | ⬜ |
| T-5.4 | Aucun éligible | Tous blessés/repos | 0 attribution, conflit par inscription, transaction propre | ⬜ unit + intégration | ⬜ |
| T-5.5 | Égalité de scores | Deux chevaux à score égal | Départage déterministe (documenté), résultat stable | ⬜ unit | ⬜ |
| T-5.6 | Cheval déjà pris | 2 cavaliers visent le même favori | Le 2ᵉ reçoit le suivant au classement | ⬜ unit | ⬜ |
| T-5.7 | Atomicité | Erreur simulée en cours d'attribution | ROLLBACK complet — aucune écriture partielle | ⬜ intégration | ⬜ |
| T-5.8 | Override manuel | Moniteur remplace le cheval | Charges réajustées sur les 2 chevaux | ⬜ intégration | ⬜ |
| T-5.9 | Audit batch | POST /admin/compatibility-audit | Rapport complet, **aucune écriture** | ⬜ intégration | ⬜ |

## Module 6 — Facturation & abonnements (Phase 4)

| ID | Scénario | Étapes | Résultat attendu | Auto | Statut |
|---|---|---|---|---|---|
| T-6.1 | Pricing | Famille 2 cavaliers, plan Classique | Prix = plan − 10 % (règle famille nombreuse) — `pricing.js` pur | ⬜ unit | ⬜ |
| T-6.2 | Réductions cumulées | Cas 3 cavaliers | Meilleure règle appliquée (15 %), jamais de prix négatif | ⬜ unit | ⬜ |
| T-6.3 | Cycle de facture | brouillon → envoyée → payée | Numérotation unique ; notifications `invoice_created`, `payment_confirmed` | ⬜ intégration | ⬜ |
| T-6.4 | Paiement simulé client | Lina paie FAC-2026-0002 | Statut payé côté client ET admin | ✅ E2E `billing-flow.spec.js` | ⬜ |
| T-6.5 | Relance impayé | Relancer FAC-2026-0004 (overdue) | Notification `invoice_reminder` selon préférences | ⬜ intégration | ⬜ |
| T-6.6 | Isolation | Alex tente GET facture de Lina | 403/404 | ⬜ intégration | ⬜ |

## Module 7 — Événements (Phase 5)

| ID | Scénario | Étapes | Résultat attendu | Auto | Statut |
|---|---|---|---|---|---|
| T-7.1 | API publique | GET /api/v1/events sans auth | 200, stages à venir (vitrine) | ✅ `phase5.test.js` | ✅ |
| T-7.2 | Réservation | Inscrire Emma au stage | Confirmée si places, notification envoyée | ✅ `phase5.test.js` | ✅ |
| T-7.3 | Capacité épuisée | Inscrire au-delà de la capacité | Refus explicite | ✅ `phase5.test.js` | ✅ |

## Module 8 — Messagerie, incidents, bénévolat, notifications (Phase 5)

| ID | Scénario | Étapes | Résultat attendu | Auto | Statut |
|---|---|---|---|---|---|
| T-8.1 | Contacts filtrés | Client liste ses contacts | Moniteurs + admin seulement (jamais d'autres clients) | ✅ `phase5.test.js` | ✅ |
| T-8.2 | Fil de conversation | Envoyer/recevoir, marquer lu | `lastReadAt` par participant ; polling rafraîchit | ✅ `phase5.test.js` | ✅ |
| T-8.3 | Incident critique | Moniteur déclare `critical` | Visible en alerte dashboard admin | ✅ `phase5.test.js` | ✅ |
| T-8.4 | Bénévolat complet | S'inscrire sur mission pleine | Refus, places restantes exactes | ✅ `phase5.test.js` | ✅ |
| T-8.5 | Préférences respectées | Désactiver email `invoice_created` puis créer facture | In-app envoyée, email non envoyé | ✅ `phase5.test.js` | ✅ |

## Module 9 — Administration (Phases 4-5)

| ID | Scénario | Étapes | Résultat attendu | Auto | Statut |
|---|---|---|---|---|---|
| T-9.1 | KPIs dashboard | Charger le dashboard admin | Occupation, CA, charge chevaux exacts vs seed | ✅ `admin.test.js` | ✅ |
| T-9.2 | Ban immédiat | Bannir un client connecté | Sessions révoquées, reconnexion refusée | ✅ `admin.test.js` | ✅ |
| T-9.3 | Validation documents | Approuver/refuser un certificat | Statut mis à jour, motif obligatoire si refus | ✅ `admin.test.js` | ✅ |

## Parcours E2E (Phase 6 — Playwright, 4 et pas plus)

| ID | Parcours | Couvre | Auto | Statut |
|---|---|---|---|---|
| E2E-1 | Visiteur : inscription client puis déconnexion | T-1.1, T-1.13 | `auth.spec.js` | ✅ |
| E2E-2 | Client : ajout cavalier + réservation + consultation planning | T-2.1, T-4.3 | `client-flow.spec.js` | ✅ |
| E2E-3 | Moniteur : accès planning + appel (socle attribution/présences) | T-5.1, T-5.8, T-4.6 | `instructor-flow.spec.js` | ✅ |
| E2E-4 | Client : paiement facture + contrôle admin | T-6.4 | `billing-flow.spec.js` | ✅ |

Socle automatisé ajouté en Phase 6 :

- Configuration : `playwright.config.js`
- Dossier de specs : `playwright/e2e/`
- Préparation locale : `docker compose up -d postgres redis` puis `npm run e2e:prepare`
- Exécution locale (stack auto) : `npm run e2e`
- Exécution avec stack Docker : `npm run e2e:stack` puis `PLAYWRIGHT_EXTERNAL_STACK=1 npm run e2e`

Limite connue : les tests d'intégration auth saturent parfois le rate limiting Redis partagé ;
`playwright/clear-rate-limits.mjs` est exécuté avant la suite E2E (`e2e:prepare` / `start-stack.mjs`).

Le **refresh silencieux** n'est pas encore isolé en E2E robuste, car la durée
de vie nominale du token (15 min) n'est pas abaissée dans un environnement de test dédié. Il
reste couvert par les tests d'intégration API.

## Transverse — sécurité & accessibilité (audités en Phase 6)

| ID | Scénario | Résultat attendu |
|---|---|---|
| T-S.1 | Injection SQL sur champs de recherche | Neutralisée (Prisma paramétré) |
| T-S.2 | XSS dans un message | Échappé à l'affichage, CSP active |
| T-S.3 | Headers de sécurité | helmet + Nginx : CSP, X-Frame-Options, HSTS (prod) |
| T-S.4 | IDOR | Tout ID d'une autre famille → 403/404 |
| T-A.1 | Navigation clavier complète | Tous les parcours principaux au clavier, focus visible |
| T-A.2 | Lecteur d'écran | Labels, landmarks, badges avec texte (jamais couleur seule) |
