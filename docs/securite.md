# Sécurité — Equime

> Livrable Phase 2 (v1). Tableau de correspondance **mesure ↔ vulnérabilité OWASP Top 10 ↔ fichier**.
> Enrichi à chaque phase ; audit final en Phase 6. **Mis à jour vers l'OWASP Top 10:2025**
> (version finale publiée en janvier 2026), voir `docs/veille-securite.md`.

## Synthèse

Equime applique une défense en profondeur : validation systématique des entrées (Zod), authentification JWT maison avec rotation des refresh tokens, rate limiting Redis, headers HTTP durcis, et séparation stricte des rôles. Aucune donnée sensible n'est codée en dur — tout transite par des variables d'environnement validées au boot.

## Tableau OWASP Top 10:2025

| OWASP 2025 | Risque | Mesure implémentée | Fichier(s) |
|---|---|---|---|
| **A01:2025** — Broken Access Control *(inclut désormais le SSRF)* | Accès à des ressources sans droit ; requêtes serveur abusives | `requireAuth` + `requireRole` **au niveau de chaque routeur** ; isolation par `familyId` (anti-IDOR) ; cours brouillons masqués ; documents servis uniquement par route authentifiée ; test `authSurface.test.js` (401 sur chaque routeur protégé). SSRF : aucun appel HTTP sortant piloté par l'utilisateur (Stripe et SendGrid via SDK officiels, URL fixes) | `apps/api/src/middlewares/auth.js`, `apps/api/src/lib/family.js`, `apps/api/src/tests/authSurface.test.js` |
| **A02:2025** — Security Misconfiguration | En-têtes manquants, pile exposée, image obsolète | `helmet()` ; CSP nginx (`img-src … blob:`, `font-src … data:`) ; pile d'appels **uniquement en dev** ; configuration validée par Zod au démarrage ; `trust proxy` seulement en prod ; valeurs `change_me` refusées en prod ; image **`nginx:1.30`** (la 1.27 est en fin de vie) | `apps/api/src/app.js`, `docker/nginx/web.conf`, `apps/api/src/config/env.js`, `apps/web/Dockerfile` |
| **A03:2025** — Software Supply Chain Failures *(nouveau)* | Dépendance ou image compromise, vulnérable ou obsolète | Lockfile + **`npm ci`** ; audit bloquant en CI avec exceptions **nominatives et datées** ; `build --pull` au déploiement (images de base à jour) ; actions GitHub en v7 ; veille documentée | `scripts/audit-ci.mjs`, `scripts/deploy-vps.sh`, `.github/workflows/ci.yml`, `docs/veille-securite.md` |
| **A04:2025** — Cryptographic Failures | Fuite de secrets, mots de passe faibles | **argon2id** ; refresh et reset tokens **hachés** (SHA-256) ; secrets en `.env` ; cookie refresh `httpOnly` + `Secure` + `SameSite=Strict` ; access token **jamais en localStorage** ; HTTPS/HSTS par Caddy | `apps/api/src/lib/passwords.js`, `apps/api/src/services/tokenService.js`, `apps/web/src/lib/apiClient.js` |
| **A05:2025** — Injection | SQL, NoSQL, XSS | Prisma (requêtes paramétrées) ; Zod sur body, params et query ; échappement HTML des emails ; contrôle MIME réel des fichiers (magic bytes) | `apps/api/src/middlewares/validate.js`, `apps/api/src/lib/mailer.js`, `apps/api/src/lib/uploads.js` |
| **A06:2025** — Insecure Design | Défaut de conception métier | Rotation des refresh tokens avec détection de rejeu ; **idempotence des paiements** ; verrou `FOR UPDATE` contre le surbooking ; **règle de niveau asymétrique** (aucun débutant placé automatiquement sur un cheval confirmé, ADR 009) | `apps/api/src/services/tokenService.js`, `billingService.js`, `eventService.js`, `horseAssignment.js` |
| **A07:2025** — Authentication Failures | Brute force, énumération, session | Rate limiting Redis (IP **et** compte), **fail-closed** si Redis tombe ; messages génériques ; comptes bannis rejetés ; fenêtre de grâce `REFRESH_RACE` sans effacement du cookie valide | `apps/api/src/middlewares/rateLimit.js`, `apps/api/src/routes/auth.routes.js`, `apps/api/src/controllers/authController.js` |
| **A08:2025** — Software or Data Integrity Failures | Jetons forgés, webhook falsifié, CSRF | JWT HS256 avec algorithme imposé ; blacklist Redis par `jti` ; **webhook Stripe signé** (corps brut + `constructEvent`) ; `SameSite=Strict` ; CORS en liste blanche | `apps/api/src/services/tokenService.js`, `apps/api/src/services/paymentService.js`, `apps/api/src/app.js` |
| **A09:2025** — Security Logging and Alerting Failures | Incidents non tracés | Logs **pino** structurés ; jetons et cookies masqués (`[Redacted]`) ; journal d'audit des consultations de certificats médicaux et des licences téléversées par un admin ; **erreur journalisée** si un paiement arrive sur une facture déjà payée (remboursement à traiter) | `apps/api/src/lib/logger.js`, `apps/api/src/services/adminService.js`, `billingService.js` |
| **A10:2025** — Mishandling of Exceptional Conditions *(nouveau)* | Comportement imprévu sur erreur | Gestionnaire d'erreurs central (`AppError` → code maîtrisé ; bug → 500 générique) ; rate limiting **fail-closed** ; échec d'email absorbé et journalisé ; notifications d'annulation en `Promise.allSettled` ; webhook : paiement différé non encaissé ≠ payé | `apps/api/src/middlewares/errorHandler.js`, `apps/api/src/lib/mailer.js`, `apps/api/src/services/courseService.js`, `paymentService.js` |

## Détail — module authentification (Phase 2)

### Tokens

| Élément | Durée | Stockage client | Stockage serveur |
|---|---|---|---|
| Access token (JWT) | 15 min (configurable) | Mémoire JS (`apiClient.js`) | Non persisté ; `jti` blacklisté dans Redis si révoqué |
| Refresh token (opaque) | 7 j (configurable) | Cookie `equime_refresh` httpOnly | Hash SHA-256 en `refresh_tokens` + `familyId` pour rotation |

### Rate limiting (`/api/v1/auth/*`)

| Route | Limite | Fenêtre |
|---|---|---|
| `POST /register` | 10 req | 1 h |
| `POST /login` (par IP) | 10 req | 15 min |
| `POST /login` (par email) | 5 req | 1 h |
| `POST /refresh` | 60 req | 15 min |
| `POST /forgot-password` | 5 req | 1 h |
| `POST /reset-password` | 10 req | 1 h |
| `POST /api/v1/public/newsletter` | 5 req | 1 h |

Implémentation : compteur Redis par IP + préfixe (`apps/api/src/middlewares/rateLimit.js`) — script Lua `INCR` + `EXPIRE` atomique au premier hit. Login : seconde limite `rl:login-account:<email>` (5 / h). Routes d’auth **fail-closed** (Redis down → 503) ; newsletter fail-open. Nginx `limit_req` sur `/api/v1/auth/` (préprod / prod). Rotation refresh : `updateMany` conditionnel (`revokedAt: null`) ; concurrence → 401 sans révoquer la famille du gagnant ; réutilisation (token déjà consommé au read) → révocation famille.

### Politique de mot de passe

- Minimum 12 caractères, majuscule + minuscule + chiffre.
- Schéma partagé front/back : `packages/shared/src/schemas/auth.js`.
- Hash : argon2id (paramètres OWASP — `apps/api/src/lib/passwords.js`).

### Headers HTTP (Express + Nginx prod)

| Header | Source | Phase |
|---|---|---|
| CSP API (`frame-ancestors 'none'`), X-Content-Type-Options, X-Frame-Options… | `helmet()` | 2 ✅ |
| CSP SPA | Nginx `web.conf`, `preprod.conf`, `prod.conf` | 6 ✅ |
| HSTS + TLS 443 | Nginx `prod.conf` | 6 ✅ |
| Rate limit Nginx `/api/v1/auth/` | `limit_req_zone` (préprod / prod) | 6 ✅ |
| gzip | Nginx frontal | 6 ✅ |

## Tests de sécurité automatisés

| Scénario | Réf. cahier | Fichier test |
|---|---|---|
| Inscription + famille créée | T-1.1 | `apps/api/src/tests/auth.test.js` |
| Email déjà pris (400 générique « Inscription impossible ») | T-1.2 | idem |
| Mot de passe faible (400 Zod) | T-1.3 | idem |
| Login OK / KO générique | T-1.4, T-1.5 | idem |
| Compte banni (403) | T-1.6 | idem |
| Rotation refresh | T-1.7 | idem |
| Réutilisation → famille révoquée | T-1.8 | idem |
| Route sans token (401) | T-1.9 | `apps/api/src/middlewares/auth.test.js` |
| Rôle insuffisant (403) | T-1.10 | idem |
| Rate limiting (429) | T-1.11 | `apps/api/src/tests/auth.test.js` |
| Hash token / argon2 | — | `apps/api/src/services/tokenService.test.js`, `passwords.test.js` |

## Détail — module cœur métier (Phase 3)

### Documents cavaliers

| Mesure | Détail | Fichier |
|---|---|---|
| Contrôle MIME réel | Magic bytes via `file-type`, pas l'extension seule | `apps/api/src/lib/uploads.js` |
| Taille max | 5 Mo via `multer.limits` | idem |
| Consentement RGPD | Obligatoire avant certificat médical | `apps/api/src/services/riderService.js` |
| Stockage hors webroot | Volume `UPLOAD_DIR`, servi via route authentifiée | `docker-compose.yml`, `apps/api/src/routes/riders.routes.js`, `apps/api/src/routes/horses.routes.js` |

### Photos cavalerie

| Mesure | Détail | Fichier |
|---|---|---|
| Contrôle MIME réel | JPEG/PNG/WebP via magic bytes | `apps/api/src/lib/uploads.js` (`persistHorsePhoto`) |
| Conversion WebP | Sharp, max 1200 px, qualité 80 | `apps/api/src/lib/imageConvert.js` |
| Accès authentifié | GET `/horses/:id/photo` derrière JWT | `apps/api/src/routes/horses.routes.js` |

### Planning

| Mesure | Détail | Fichier |
|---|---|---|
| Cache Redis isolé | TTL 5 min ; clé `planning:{from}:{to}:{scope}` avec `mine:<userId>` (client) ou `mine:<instructorId>` (moniteur) — jamais fusionné vers `all` ; invalidation globale à chaque mutation cours | `apps/api/src/services/planningCache.js`, `apps/api/src/services/courseService.js` |
| Lecture brouillon | GET `/courses/:id` : statut `draft` réservé admin ou moniteur assigné (404 sinon) | `apps/api/src/services/courseService.js` |
| Conflit d'espace | Refus 409 si chevauchement dans le même espace | `apps/api/src/services/spaceService.js` |

## Détail — attribution & facturation (Phase 4)

| Mesure | Détail | Fichier |
|---|---|---|
| Attribution transactionnelle | Affectation chevaux + charge hebdo dans une unique transaction Prisma, rollback complet sur erreur | `apps/api/src/services/horseAssignment.js` |
| Audit sans écriture | Simulation batch admin sans modification BDD | `apps/api/src/services/horseAssignment.js`, `apps/api/src/routes/admin.routes.js` |
| Isolation famille factures | Consultation/paiement/PDF client bornés à `family.userId` ; brouillons exclus de la liste et du PDF client | `apps/api/src/services/billingService.js`, `apps/api/src/lib/invoicePdf.js`, `apps/api/src/routes/client.routes.js` |
| Paiement Stripe Checkout | Aucune CB stockée chez Equime (PCI hors scope) ; Session hébergée Stripe ; confirmation uniquement via webhook | `apps/api/src/services/paymentService.js`, ADR 008 |
| Webhook signé (A02/A04) | Body brut `express.raw` avant `express.json` ; `constructEvent` + `STRIPE_WEBHOOK_SECRET` ; signature invalide → 400 | `apps/api/src/app.js`, `apps/api/src/routes/webhook.routes.js` |
| Secrets paiement | `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` uniquement en `.env` ; préfixes validés Zod au boot | `apps/api/src/config/env.js` |
| Paiement simulé borné | `POST …/pay` uniquement si Stripe absent **et** `NODE_ENV` ∈ {development, test} ; sinon 410 | `apps/api/src/services/billingService.js` |

## Détail — événements, incidents, bénévolat, messagerie, notifications (Phase 5)

| Mesure | Détail | Fichier |
|---|---|---|
| Préférences par canal | Chaque type de notification vérifie les préférences `in_app` / `email` avant dispatch ; création automatique des préférences manquantes | `apps/api/src/services/notificationService.js`, `apps/api/src/routes/notifications.routes.js` |
| Lecture publique limitée | Les événements publics exposent uniquement les rendez-vous à venir, sans données d'inscription ni d'utilisateurs | `apps/api/src/services/eventService.js`, `apps/api/src/routes/events.routes.js` |
| Inscription événement | Capacité recomptée dans une transaction Prisma avant upsert ; HTML des emails d'confirmation échappé (`escapeHtml`) | `apps/api/src/services/eventService.js`, `apps/api/src/lib/mailer.js` |
| Contrôle d'accès messagerie | Contacts filtrés par rôle ; accès à une conversation borné aux participants ; un tiers reçoit 404 (anti-IDOR) | `apps/api/src/services/messageService.js`, `apps/api/src/routes/messages.routes.js` |
| XSS messagerie | Les messages sont rendus en texte brut via React (pas de `dangerouslySetInnerHTML`) ; l'access token reste en mémoire uniquement | `apps/web/src/features/engagement/pages/MessagesPage.jsx`, `apps/web/src/lib/apiClient.js` |
| Incidents critiques visibles | Les incidents `critical` ouverts sont exposés au dashboard admin pour traitement prioritaire | `apps/api/src/services/incidentService.js`, `apps/web/src/features/admin/pages/AdminDashboardPage.jsx` |
| Bénévolat transactionnel | L'inscription bénévole vérifie unicité + capacité dans une transaction Prisma unique | `apps/api/src/services/volunteerService.js` |

## Détail — Phase 6 (recette, E2E, déploiement)

| Mesure | Détail | Fichier |
|---|---|---|
| Tests E2E Playwright | 4 parcours métier critiques (E2E-1–4 : auth, client, moniteur, facturation) + extension fumée/modules (E2E-5–13) en CI Chromium | `playwright/e2e/`, `playwright.config.js`, `.github/workflows/ci.yml` |
| Isolation rate limit E2E | Purge Redis `rl:*` avant la suite pour éviter les 429 après tests d'intégration | `playwright/clear-rate-limits.mjs`, `playwright/start-stack.mjs` |
| Seed recette déterministe | Jeu de données volumétrique pour préprod, rejouable | `apps/api/prisma/seed-recette.js` |
| Headers HTTP | X-Content-Type-Options, X-Frame-Options, Referrer-Policy, CSP SPA sur le statique (Nginx de l'image web) et Helmet sur l'API ; HSTS et Permissions-Policy au frontal Caddy de l'hôte | `docker/nginx/web.conf`, `apps/api/src/app.js`, `docs/deploiement.md` |
| CSP `style-src 'unsafe-inline'` | **Risque accepté** : Tailwind / styles runtime de la SPA exigent l'inline CSS ; `script-src` reste `'self'` uniquement. Pas de nonce/hash styles en v1 (casse le build). | `docker/nginx/web.conf`, `docker/nginx/prod.conf`, `docker/nginx/preprod.conf` |
| Redis AUTH préprod/prod | `requirepass` via `REDIS_PASSWORD` ; `REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379` injecté par Compose (réseau interne uniquement) | `docker-compose.prod.yml`, `docker-compose.preprod.yml`, `.env.prod.example`, `.env.preprod.example` |
| Stack préprod/prod | Compose multi-services (postgres, redis, migrate, api, web) ; ports publiés sur la loopback uniquement, TLS terminé par Caddy sur l'hôte | `docker-compose.preprod.yml`, `docker-compose.prod.yml`, `docs/deploiement.md` |
| Chaîne de proxy à un seul saut | Caddy attaque l'API en direct pour `/api/*` : `trust proxy 1` reste valide et le rate limiting garde la vraie IP client (vérifié : compteurs isolés par IP) | `apps/api/src/app.js`, `docs/deploiement.md` |
| Aucun secret dans les images | `.dockerignore` exclut `**/.env` (les motifs non préfixés ne matchent que la racine) ; secrets injectés au runtime | `.dockerignore`, `docker-compose.prod.yml` |

## Perspectives (hors scope immédiat)

- **Déploiement CI/CD** : workflows `develop` → préprod et `main` → prod avec approbation manuelle.
- **Point restant** : le refresh silencieux reste vérifié en intégration ; E2E dédié à TTL réduit en perspective.
- **Audit RGAA** : T-A.1 consigné ✅ ; T-A.2 ⚠️ (revue code + arbre d’accessibilité, **pas** de session lecteur d’écran) — journal dans `docs/cahier-de-recette.md`.
- **Hors scope v1** : MFA, CAPTCHA, détection d'anomalies géolocalisées.
