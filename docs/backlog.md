# Backlog produit — Equime

> Livrable Phase 1, maintenu en continu (règle n° 6). User stories au format
> « En tant que [rôle], je veux [action] afin de [bénéfice] », avec critères d'acceptation testables,
> priorisées **MoSCoW** (M = Must, S = Should, C = Could, W = Won't pour cette version).
> Chaque phase de développement est traitée comme un **sprint** avec un objectif.

## Organisation des sprints

| Sprint | Phase | Objectif de sprint | Statut |
|---|---|---|---|
| S0 | Phase 0 | Environnement de dev opérationnel et outillé (compose, CI, thème) | ✅ Terminé |
| S1 | Phase 1 | Conception validée : modèles de données, UML, backlog, jeux d'essai | ✅ Terminé |
| S2 | Phase 2 | Un utilisateur peut créer un compte et se connecter de façon sécurisée | ✅ Terminé |
| S3 | Phase 3 | Le cœur opérationnel tourne : familles, cavalerie, espaces, planning | ✅ Terminé |
| S4 | Phase 4 | L'attribution des chevaux et la facturation fonctionnent de bout en bout | ✅ Terminé |
| S5 | Phase 5 | Modules relationnels : messagerie, incidents, bénévolat, événements, notifications | ✅ Terminé |
| CDC | Conformité Excel | Écarts Must/Should : profil, absences, staff, documents, vitrine, factures batch | ✅ Terminé |
| S6 | Phase 6 | Application recettée, déployée en préprod puis prod | 🔄 En revue (E2E + recette manuelle) |
| S7 | Phase 7 | Dossier professionnel consolidé | 🔄 En cours |

---

## EPIC 1 — Authentification & compte (Sprint 2)

### US-1.1 — Inscription `M`
**En tant que** visiteur, **je veux** créer un compte avec mon email et un mot de passe **afin de** devenir client du centre.

Critères d'acceptation :
- [ ] Email unique, format validé (Zod) ; mot de passe ≥ 12 caractères avec message d'aide explicite.
- [ ] Le mot de passe est hashé en argon2id — jamais stocké ni loggé en clair.
- [ ] Une famille est créée automatiquement pour tout compte de rôle `client`.
- [ ] Après inscription, l'utilisateur est connecté (access + refresh token) et redirigé vers son dashboard avec la carte d'onboarding « ajoutez votre premier cavalier ».
- [ ] Un email déjà utilisé renvoie une erreur générique sans révéler l'existence du compte.

### US-1.2 — Connexion `M`
**En tant qu'** utilisateur enregistré, **je veux** me connecter **afin d'** accéder à mon espace selon mon rôle.

Critères d'acceptation :
- [ ] Access token 15 min conservé en mémoire ; refresh token 7 j en cookie httpOnly + Secure + SameSite=Strict.
- [ ] Identifiants invalides → 401 avec message générique (pas d'indication du champ fautif).
- [ ] Un compte banni ne peut pas se connecter (403 explicite).
- [ ] Redirection selon le rôle : client → dashboard, moniteur → planning, admin → dashboard KPIs.
- [ ] Plus de 10 tentatives par IP sur 15 min → 429 (rate limiting Redis).

### US-1.3 — Session silencieuse `M`
**En tant qu'** utilisateur connecté, **je veux** que ma session se prolonge sans action de ma part **afin de** ne pas être déconnecté toutes les 15 minutes.

Critères d'acceptation :
- [ ] Sur 401 TOKEN_EXPIRED, l'apiClient rafraîchit silencieusement puis rejoue la requête initiale.
- [ ] Chaque refresh **rotate** le token (l'ancien est révoqué, le nouveau hérite de la famille).
- [ ] La réutilisation d'un refresh révoqué révoque **toute la famille** (toutes les sessions de cette lignée).
- [ ] Un seul refresh concurrent même si plusieurs requêtes échouent simultanément.

### US-1.4 — Mot de passe oublié `M`
**En tant qu'** utilisateur, **je veux** réinitialiser mon mot de passe par email **afin de** récupérer l'accès à mon compte.

Critères d'acceptation :
- [ ] La demande répond toujours 200, que l'email existe ou non (pas d'énumération).
- [ ] Jeton à usage unique, hashé en base, expirant à 1 h ; email envoyé via SendGrid.
- [ ] Après réinitialisation, toutes les sessions actives sont révoquées.

### US-1.5 — Déconnexion `M`
**En tant qu'** utilisateur connecté, **je veux** me déconnecter **afin de** protéger mon compte sur un poste partagé.

Critères d'acceptation :
- [ ] La famille de refresh tokens est révoquée ; l'access token est blacklisté (Redis) jusqu'à expiration.
- [ ] Le cookie refresh est expiré côté navigateur ; retour à l'écran de connexion.

### US-1.6 — Suppression de compte (RGPD) `S`
**En tant que** client, **je veux** supprimer mon compte **afin d'** exercer mon droit à l'effacement.

Critères d'acceptation :
- [x] Confirmation explicite nommant les conséquences.
- [x] Données personnelles anonymisées (nom, email, téléphone, documents supprimés) ; factures conservées anonymisées (obligation comptable).
- [x] Connexion impossible après suppression ; sessions révoquées.

### US-1.7 — Éditer mon profil `M`
**En tant qu'** utilisateur connecté, **je veux** modifier mon prénom, nom et téléphone **afin de** tenir mon compte à jour. (Excel 3.1)

Critères d'acceptation :
- [x] `PATCH /api/v1/auth/me` (Zod : `firstName`, `lastName`, `phone`) ; email et rôle non modifiables par cette voie.
- [x] Formulaire sur `ClientAccountPage` prérempli avec les valeurs courantes.

---

## EPIC 2 — Famille & cavaliers (Sprint 3)

### US-2.1 — Gérer mes cavaliers `M`
**En tant que** client, **je veux** ajouter, modifier et retirer les cavaliers de ma famille **afin de** gérer qui pratique.

Critères d'acceptation :
- [ ] CRUD complet limité à sa propre famille (un client ne voit jamais les cavaliers d'autrui).
- [ ] Champs : prénom, nom, date de naissance, niveau (initiation → Galop 7).
- [ ] EmptyState avec appel à l'action si aucun cavalier.

### US-2.2 — Téléverser les documents `M`
**En tant que** client, **je veux** téléverser le certificat médical et la licence d'un cavalier **afin de** valider son dossier.

Critères d'acceptation :
- [x] Formats acceptés : PDF/JPG/PNG, taille ≤ 5 Mo, contrôle du MIME réel côté serveur.
- [x] Consentement explicite requis avant le téléversement du certificat médical (RGPD).
- [x] Statut visible : manquant / en attente / validé / refusé (badge design system).
- [x] Fichiers stockés dans le volume `/uploads`, servis derrière Nginx, inaccessibles sans autorisation.

### US-2.3 — Déclarer les affinités chevaux `S`
**En tant que** client, **je veux** indiquer les chevaux favoris / à éviter de chaque cavalier **afin d'** influencer l'attribution.

Critères d'acceptation :
- [ ] Une affinité par couple cavalier/cheval : favori, neutre, à éviter.
- [ ] Reflétée dans le score d'attribution (+10 / 0 / −15) — vérifiable en Phase 4.

---

## EPIC 3 — Cavalerie & espaces (Sprint 3)

### US-3.1 — Gérer les fiches chevaux `M`
**En tant qu'** admin, **je veux** gérer les fiches des chevaux (identité, statut, plage de niveaux, charge max) **afin de** tenir la cavalerie à jour.

Critères d'acceptation :
- [x] Statut modifiable après création (`PATCH /horses/:id`, liste En forme / Repos / Indisponible / Blessé).
- [ ] CRUD admin ; statuts : en forme / repos / indisponible / blessé (badges sémantiques partout).
- [ ] Charge hebdomadaire visible avec seuil d'alerte ; dépassement remonté sur le dashboard.

### US-3.2 — Tenir le carnet de santé `S`
**En tant qu'** admin, **je veux** consigner les événements de santé (vétérinaire, maréchal…) **afin de** suivre chaque cheval.

Critères d'acceptation :
- [ ] Entrées horodatées avec type et notes, listées par cheval de la plus récente à la plus ancienne.
- [x] Un moniteur consulte le carnet en lecture seule (`/moniteur/sante`) ; seul l'admin écrit.

### US-3.3 — Gérer les espaces `M`
**En tant qu'** admin, **je veux** gérer les espaces (manège, carrière, paddock) **afin de** planifier les cours.

Critères d'acceptation :
- [x] CRUD admin ; nom unique, type, capacité (création, édition nom/type/capacité, suppression).
- [x] Impossible de programmer deux cours au même moment dans le même espace (conflit détecté).

---

## EPIC 4 — Cours & planning (Sprint 3)

### US-4.1 — Créer un cours récurrent `M`
**En tant qu'** admin, **je veux** créer un cours hebdomadaire sur une période **afin de** générer le planning en une opération.

Critères d'acceptation :
- [ ] Récurrence hebdomadaire avec date de fin ; chaque séance générée est un cours autonome rattaché à la série (`recurrence.js` testé unitairement).
- [ ] Statuts du cours : brouillon / programmé / en cours / terminé / annulé.
- [ ] Annulation d'une séance ≠ annulation de la série (choix explicite).

### US-4.2 — Consulter le planning `M`
**En tant que** moniteur, **je veux** un calendrier filtrable (mon planning / structure) **afin de** préparer mes séances.

Critères d'acceptation :
- [ ] Vue calendrier (semaine/mois) aux couleurs de statut du design system.
- [ ] Filtre « mon planning » (mes séances uniquement) / « structure » (tout le centre).
- [ ] Réponse < 500 ms sur le planning 8 semaines (cache Redis, invalidé à chaque mutation de cours).

### US-4.3 — Inscrire un cavalier à un cours `M`
**En tant que** client, **je veux** inscrire mon cavalier à un cours compatible avec son niveau **afin de** réserver sa place.

Critères d'acceptation :
- [ ] Seuls les cours de la plage de niveau du cavalier sont proposés.
- [ ] Capacité respectée (cours complet → inscription refusée avec message clair).
- [ ] Quota d'abonnement décrémenté ; inscription visible immédiatement dans le planning famille.
- [ ] Notification `course_enrolled` envoyée selon les préférences.
- [x] Inscription refusée si le certificat médical ou la licence n'est pas `approved` **ou si la date de validité est échue** (Excel 7.2) ; message explicite.
- [x] Dates `medicalCertificateExpiresAt` / `licenseExpiresAt` saisies au téléversement ; l'admin peut les corriger à la validation.

### US-4.4 — Faire l'appel `M`
**En tant que** moniteur, **je veux** pointer les présences d'une séance **afin de** tracer l'assiduité.

Critères d'acceptation :
- [ ] Statuts : en attente / présent / absent / excusé, modifiables pendant et après la séance.
- [ ] Une absence déclenche la notification `rider_absence` à la famille.

### US-4.5 — Signaler une absence `M`
**En tant que** client, **je veux** excuser une séance à venir **afin de** prévenir le club sans attendre l'appel. (Excel 3.7)

Critères d'acceptation :
- [x] Action limitée aux inscriptions de sa famille et aux séances encore à venir ; statut `excused`.
- [x] Notification `rider_absence` envoyée selon les préférences.
- [x] Action disponible sur le planning famille et le dashboard (`UpcomingEnrollments`).

---

## EPIC 5 — Attribution des chevaux (Sprint 4) ⭐ pièce maîtresse

### US-5.1 — Attribution automatique `M`
**En tant que** moniteur, **je veux** attribuer automatiquement les chevaux d'une séance **afin de** gagner du temps et d'optimiser les couples cavalier/cheval.

Critères d'acceptation :
- [ ] Éligibilité : statut `fit` ET charge hebdo < max.
- [ ] Score : favori +10 · niveau compatible +5 · à éviter −15 · charge −5 × heures.
- [ ] Un cheval n'est jamais attribué deux fois dans la même séance.
- [ ] Charge hebdo incrémentée de la durée du cours ; tout est transactionnel (échec = aucune écriture).
- [ ] Les inscriptions sans solution sont listées comme conflits avec la raison.
- [ ] Tests unitaires : nominal, avoid, surcharge, aucun éligible, égalité de scores, cheval déjà pris.
- [x] Stages : `EventRegistration.horseId`, même scoring, incrément de `(endAt - startAt)`, bouton admin, décrément à l'annulation (Excel 11.2 / 11.6).

### US-5.2 — Override manuel `M`
**En tant que** moniteur, **je veux** remplacer manuellement un cheval attribué **afin de** garder la décision finale.

Critères d'acceptation :
- [ ] Liste des chevaux disponibles avec leur score et un avertissement si affinité « à éviter ».
- [ ] Les charges hebdo des deux chevaux (retiré/ajouté) sont réajustées.

### US-5.3 — Audit de compatibilité `S`
**En tant qu'** admin, **je veux** lancer un audit batch sur les séances à venir **afin d'** anticiper les conflits d'attribution.

Critères d'acceptation :
- [ ] `POST /api/v1/admin/compatibility-audit` : simulation sans écriture.
- [ ] Rapport par séance : scores, conflits, chevaux manquants.

---

## EPIC 6 — Facturation & abonnements (Sprint 4)

### US-6.1 — Formules & réductions `M`
**En tant qu'** admin, **je veux** gérer les formules d'abonnement et les règles de réduction **afin de** piloter la tarification.

Critères d'acceptation :
- [ ] CRUD formules (prix, séances/semaine) et règles (pourcentage, condition min. cavaliers).
- [ ] `pricing.js` pur et testé : prix = formule − réductions applicables, jamais négatif.

### US-6.2 — Générer et suivre les factures `M`
**En tant qu'** admin, **je veux** créer des factures et suivre leur statut **afin de** gérer les encaissements.

Critères d'acceptation :
- [ ] Statuts : brouillon → envoyée → payée / en retard / annulée ; numérotation unique séquentielle.
- [x] Liste admin : brouillons visibles (badge « Brouillon ») avec action Envoyer ; Relancer réservé aux factures envoyées ou en retard.
- [x] Lignes détaillées (libellé, quantité, montant) ; totaux en centimes.
- [x] Relance des impayés → notification `invoice_reminder`.
- [x] PDF téléchargeable (`GET /admin/invoices/:id/pdf`) y compris brouillon.

### US-6.3 — Consulter et payer `M`
**En tant que** client, **je veux** consulter mes factures et les payer (paiement simulé) **afin de** régler mes échéances.

Critères d'acceptation :
- [ ] Le client ne voit que les factures de sa famille.
- [x] Les brouillons restent invisibles côté client (seules envoyée / payée / en retard).
- [ ] Paiement simulé : facture marquée payée, notification `payment_confirmed`, visible côté admin.
- [x] PDF téléchargeable (`GET /client/invoices/:id/pdf`) pour les factures visibles ; 404 si brouillon ou facture d'une autre famille.

### US-6.4 — Générer les factures d'abonnement du mois `S`
**En tant qu'** admin, **je veux** générer en une opération les factures d'abonnement du mois **afin de** ne pas les créer une par une. (Excel 12.1 Should)

Critères d'acceptation :
- [x] `POST /api/v1/admin/invoices/generate-subscriptions` : mois calendaire en cours ; une famille déjà facturée sur la période est ignorée (skip).
- [x] Bouton sur `AdminBillingPage` ; déclenchement manuel (pas de cron).

### US-6.5 — Souscrire à une formule `M`
**En tant que** client, **je veux** choisir une formule d'abonnement si je n'en ai pas **afin d'** activer les inscriptions aux cours. (Excel 8.2)

Critères d'acceptation :
- [x] `POST /api/v1/client/family/subscription` si `Family.subscriptionPlanId` est `null` ; quota initial = `sessionsPerWeek * 4`.
- [x] 409 si une formule existe déjà (message « contactez le secrétariat ») ; pas de PATCH client.
- [x] Admin : `PATCH /api/v1/admin/families/:id/subscription` change le plan et réinitialise le quota.
- [x] `GET /api/v1/public/plans` : formules actives (vitrine + compte).
- [x] `ClientAccountPage` : formule + quota ; CTA « Choisir une formule » seulement si aucune.

---

## EPIC 7 — Événements (Sprint 5)

### US-7.1 — Vitrine publique `S`
**En tant que** visiteur, **je veux** voir les stages à venir sur la vitrine **afin de** découvrir l'activité du centre.

Critères d'acceptation :
- [x] `GET /api/v1/events` public (sans auth) ; vitrine responsive conforme au design system.
- [x] Footer vitrine : adresse, téléphone, email depuis `VITE_CLUB_ADDRESS` / `VITE_CLUB_PHONE` / `VITE_CLUB_EMAIL` (Excel 1.1).
- [x] Newsletter : `POST /api/v1/public/newsletter` (email Zod, consentement horodaté, confirmation mailer, rate-limit) — pas d'ESP marketing en v1.
- [x] Formules live : `GET /api/v1/public/plans` (actives) affichées sur `HomePage` avec prix (Excel 1.2).
- [x] Cours à venir : `GET /api/v1/public/courses` (titre, horaires, type d'espace, places restantes — pas d'identité d'élève) sur `HomePage` (Excel 1.2).

### US-7.2 — Réserver un événement `M`
**En tant que** client, **je veux** inscrire un cavalier à un stage ou une compétition **afin de** participer aux activités.

Critères d'acceptation :
- [x] Capacité respectée ; statuts en attente / confirmée / annulée.
- [x] Notification `registration_confirmed` à la confirmation.
- [x] Inscription refusée si le certificat médical ou la licence n'est pas `approved` **ou si la date de validité est échue** (Excel 7.2).
- [x] Si `priceCents > 0`, facture **envoyée** (1 ligne cavalier + titre) ; pas de facture si prix 0 ; idempotente via `InvoiceItem.eventRegistrationId` unique (Excel 12.1).
- [x] Monture affectée (auto à la confirmation ou bouton admin) ; charge hebdo incrémentée de la durée du stage ; retirée à l'annulation ; override admin ; uniquement chevaux `fit` sous le max (Excel 11.2).

### US-7.3 — Gérer les événements `M`
**En tant qu'** admin, **je veux** créer et gérer les événements **afin d'** animer le centre. (CRUD, types stage/compétition interne/externe.)

Critères d'acceptation :
- [x] Bouton « Attribuer les chevaux » sur `AdminEventsPage` (secondaire) ; inscriptions avec monture affichée.

---

## EPIC 8 — Messagerie, incidents, bénévolat, notifications (Sprint 5)

### US-8.1 — Messagerie `S`
**En tant qu'** utilisateur connecté, **je veux** échanger des messages avec mes contacts autorisés **afin de** communiquer sans quitter l'application.

Critères d'acceptation :
- [x] Contacts filtrés par rôle (un client écrit aux moniteurs/admin, pas aux autres clients).
- [x] Conversations multi-participants ; marquage lu par participant (`lastReadAt`).
- [x] Rafraîchissement par polling TanStack Query (`refetchInterval`) — WebSocket noté en perspective.

### US-8.2 — Incidents `S`
**En tant que** moniteur, **je veux** déclarer un incident (gravité faible → critique) **afin de** tracer les événements de sécurité. Admin : consultation, résolution.

Critères d'acceptation :
- [x] Déclaration moniteur sécurisée avec gravité, horodatage et rattachements optionnels (cours, cheval, cavalier).
- [x] File admin filtrable des incidents ouverts avec résolution horodatée.
- [x] Les incidents critiques ouverts sont mis en évidence sur le dashboard admin.

### US-8.3 — Bénévolat `C`
**En tant que** client, **je veux** m'inscrire aux missions de bénévolat **afin de** participer à la vie du club. (Places limitées, CRUD admin.)

Critères d'acceptation :
- [x] CRUD admin des missions avec titre, créneau et nombre de places.
- [x] Inscription client bornée aux places disponibles, unique par utilisateur et transactionnelle.

### US-8.4 — Notifications & préférences `M`
**En tant qu'** utilisateur, **je veux** recevoir des notifications in-app et email selon mes préférences **afin de** rester informé sans être noyé.

Critères d'acceptation :
- [x] 8 types de notification (templates SendGrid + in-app) ; préférence par type et par canal.
- [x] Une préférence désactivée bloque effectivement l'envoi sur ce canal.

---

## EPIC 9 — Administration & pilotage (Sprints 4-5)

### US-9.1 — Dashboard KPIs `M`
**En tant qu'** admin, **je veux** un dashboard (occupation des cours, CA, charge des chevaux) avec alertes **afin de** piloter le centre. (KPI or « l'or est rare » : un seul chiffre clé en or par écran.)

### US-9.2 — Gestion des membres `M`
**En tant qu'** admin, **je veux** gérer les membres (rôles, ban/déban, validation des documents) **afin de** contrôler l'accès au service.

Critères d'acceptation :
- [x] Ban : connexion refusée + sessions actives révoquées immédiatement.
- [x] Validation des documents cavalier avec motif en cas de refus.
- [x] Création d'un compte membre : `POST /admin/members` avec `role: instructor | client` (client → famille vide, quota 0) ; formulaire sur `AdminMembersPage` (Excel 7.1).
- [x] Édition fiche : `PATCH /admin/members/:id` (prénom, nom, téléphone — pas le rôle).
- [x] Changement de formule famille depuis l'annuaire (`PATCH /admin/families/:id/subscription`).

### US-9.4 — Inscription forcée (admin) `S`
**En tant qu'** admin, **je veux** inscrire un cavalier malgré des documents incomplets ou un quota épuisé **afin de** traiter les cas exceptionnels. (Excel 10.4)

Critères d'acceptation :
- [x] `force: true` réservé au rôle admin (cours et événements) ; un client qui envoie `force` reste bloqué.
- [x] Le bypass couvre le contrôle documents (Excel 7.2, y compris expiration) et le quota de séances.

---

## Won't (hors périmètre v1, consigné pour l'oral)

| Sujet | Raison |
|---|---|
| Paiement réel (Stripe) | Paiement simulé suffisant pour le référentiel ; intégration réelle en perspective |
| WebSocket temps réel | Polling TanStack Query suffisant à cette échelle ; perspective d'évolution |
| PWA / mode hors-ligne (Excel 4.7) | Cible CDA = web responsive ; pas de service worker en v1 |
| Stats prédictives / ML (Excel 5.1) | Dashboard KPIs = analyse (occupation, charge, CA), pas de prédiction |
| Application mobile native | Cible web responsive mobile-first |
| Multi-centres (multi-tenant) | Un seul centre ; l'architecture n'y fait pas obstacle |
| Groupes de plus de 2 dans l'UI messagerie v1 | Le modèle supporte les groupes ; l'UI v1 reste 1-à-1 |

## Traçabilité

Chaque US référence ses tests dans `docs/cahier-de-tests.md` (ID `T-x.y`) ; les résultats
sont consignés en préprod dans `docs/cahier-de-recette.md` (Phase 6).

## Avancement Phase 6

- [x] Socle Playwright Chromium ajouté (`playwright.config.js`, `playwright/e2e/`, 4 parcours métier critiques E2E-1–4 + extension fumée/modules E2E-5–13).
- [x] Workflow CI enrichi avec build web + job E2E dédié (artefact `playwright-report`).
- [x] Reset rate limits E2E (`playwright/clear-rate-limits.mjs`) pour éviter les faux négatifs post-intégration.
- [x] Graine de recette maintenue (`apps/api/prisma/seed-recette.js`) et cahier de recette structuré.
- [x] Squelettes préprod/prod finalisés (`docker-compose.preprod.yml`, `docker-compose.prod.yml`, Nginx).
- [ ] Déploiement préproduction automatisé (`develop`).
- [ ] Déploiement production avec approbation manuelle (`main`).
- [ ] Audit accessibilité RGAA/WCAG AA exécuté et consigné.
- [ ] Reverse proxy SSL / HSTS validés en situation réelle.
