# Sécurité — Equime

> Livrable Phase 2 (v1). Tableau de correspondance **mesure ↔ vulnérabilité OWASP Top 10 (2021) ↔ fichier**.
> Enrichi à chaque phase ; audit final en Phase 6.

## Synthèse

Equime applique une défense en profondeur : validation systématique des entrées (Zod), authentification JWT maison avec rotation des refresh tokens, rate limiting Redis, headers HTTP durcis, et séparation stricte des rôles. Aucune donnée sensible n'est codée en dur — tout transite par des variables d'environnement validées au boot.

## Tableau OWASP

| OWASP 2021 | Risque | Mesure implémentée | Fichier(s) |
|---|---|---|---|
| **A01** — Broken Access Control | Accès à des ressources sans droit | Middleware `requireAuth` + `requireRole` sur chaque route protégée ; guards React par rôle ; isolation cavaliers par `familyId` ; téléchargement documents authentifié | `apps/api/src/middlewares/auth.js`, `apps/api/src/lib/family.js`, `apps/web/src/features/auth/guards.jsx` |
| **A02** — Cryptographic Failures | Fuite de secrets, mots de passe faibles | Mots de passe **argon2id** ; refresh/reset tokens **hashés SHA-256** en BDD ; secrets JWT en `.env` (≥ 32 car.) ; cookie refresh **httpOnly + Secure + SameSite=Strict** ; access token **jamais en localStorage** | `apps/api/src/lib/passwords.js`, `apps/api/src/services/tokenService.js`, `apps/web/src/lib/apiClient.js`, `apps/api/src/controllers/authController.js` |
| **A03** — Injection | SQL / NoSQL / command injection | Prisma ORM (requêtes paramétrées) ; validation Zod sur body/params/query avant tout traitement | `apps/api/src/middlewares/validate.js`, `packages/shared/src/schemas/` |
| **A04** — Insecure Design | Flux auth faibles | Rotation refresh + détection réutilisation (révocation famille) ; logout révoque refresh + blacklist access ; reset password révoque toutes les sessions | `apps/api/src/services/tokenService.js`, `docs/uml/sequence-authentification.md`, ADR 002 |
| **A05** — Security Misconfiguration | Stack trace exposée, headers manquants | `helmet()` (`frame-ancestors 'none'`) ; stack trace **uniquement en dev** ; config env validée Zod (crash si manquante) ; `trust proxy` **uniquement en production** ; secrets commençant par `change_me` **refusés en prod** | `apps/api/src/app.js`, `apps/api/src/middlewares/errorHandler.js`, `apps/api/src/config/env.js` |
| **A06** — Vulnerable Components | Dépendances obsolètes | Audit des dépendances de production en CI (job lint), bloquant en high/critical, avec exceptions nominatives justifiées et datées ; dépendances épinglées via lockfile ; Node 22 LTS | `scripts/audit-ci.mjs`, `.github/workflows/ci.yml`, `package-lock.json` |
| **A07** — Identification & Auth Failures | Brute force, énumération | Rate limiting Redis sur `/api/v1/auth/*` (**fail-closed 503** si Redis down) ; login **5 tentatives / heure / email** ; messages **génériques** (login, forgot-password, **register 400** « Inscription impossible ») ; comptes **bannis** rejetés + sessions révoquées | `apps/api/src/middlewares/rateLimit.js`, `apps/api/src/services/authService.js`, `apps/api/src/routes/auth.routes.js` |
| **A08** — Software & Data Integrity | Tokens forgés, CSRF | JWT signé HS256 (`jwt.verify` avec `algorithms: ['HS256']`) ; blacklist Redis par `jti` ; cookie SameSite=Strict ; CORS whitelist stricte | `apps/api/src/services/tokenService.js`, `apps/api/src/middlewares/auth.js`, `apps/api/src/app.js` |
| **A09** — Security Logging Failures | Incidents non tracés | Logs structurés **pino** (JSON prod) ; tentatives auth refusées loggées en `warn` ; headers `authorization` / `cookie` / `set-cookie` **redactés** (`[Redacted]`) | `apps/api/src/lib/logger.js`, `apps/api/src/middlewares/errorHandler.js` |
| **A10** — SSRF | Requêtes serveur abusives | Pas d'appel HTTP sortant piloté par l'utilisateur en Phase 2 ; SendGrid via SDK officiel avec URL fixe | `apps/api/src/lib/mailer.js` |

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

Implémentation : compteur Redis par IP + préfixe (`apps/api/src/middlewares/rateLimit.js`). Login : seconde limite `rl:login-account:<email>` (5 / h). Routes d’auth **fail-closed** (Redis down → 503) ; newsletter fail-open. Nginx `limit_req` sur `/api/v1/auth/` (préprod / prod).

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
| Cache Redis | TTL 5 min, invalidation globale à chaque mutation cours | `apps/api/src/services/planningCache.js` |
| Conflit d'espace | Refus 409 si chevauchement dans le même espace | `apps/api/src/services/spaceService.js` |

## Détail — attribution & facturation (Phase 4)

| Mesure | Détail | Fichier |
|---|---|---|
| Attribution transactionnelle | Affectation chevaux + charge hebdo dans une unique transaction Prisma, rollback complet sur erreur | `apps/api/src/services/horseAssignment.js` |
| Audit sans écriture | Simulation batch admin sans modification BDD | `apps/api/src/services/horseAssignment.js`, `apps/api/src/routes/admin.routes.js` |
| Isolation famille factures | Consultation/paiement/PDF client bornés à `family.userId` ; brouillons exclus de la liste et du PDF client | `apps/api/src/services/billingService.js`, `apps/api/src/lib/invoicePdf.js`, `apps/api/src/routes/client.routes.js` |
| Paiement simulé maîtrisé | Aucun PSP réel ; simple changement d'état + notification | `apps/api/src/services/billingService.js` |

## Détail — événements, incidents, bénévolat, messagerie, notifications (Phase 5)

| Mesure | Détail | Fichier |
|---|---|---|
| Préférences par canal | Chaque type de notification vérifie les préférences `in_app` / `email` avant dispatch ; création automatique des préférences manquantes | `apps/api/src/services/notificationService.js`, `apps/api/src/routes/notifications.routes.js` |
| Lecture publique limitée | Les événements publics exposent uniquement les rendez-vous à venir, sans données d'inscription ni d'utilisateurs | `apps/api/src/services/eventService.js`, `apps/api/src/routes/events.routes.js` |
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
| Stack préprod/prod | Compose multi-services (postgres, redis, migrate, api, web) ; ports publiés sur la loopback uniquement, TLS terminé par Caddy sur l'hôte | `docker-compose.preprod.yml`, `docker-compose.prod.yml`, `docs/deploiement.md` |
| Chaîne de proxy à un seul saut | Caddy attaque l'API en direct pour `/api/*` : `trust proxy 1` reste valide et le rate limiting garde la vraie IP client (vérifié : compteurs isolés par IP) | `apps/api/src/app.js`, `docs/deploiement.md` |
| Aucun secret dans les images | `.dockerignore` exclut `**/.env` (les motifs non préfixés ne matchent que la racine) ; secrets injectés au runtime | `.dockerignore`, `docker-compose.prod.yml` |

## Perspectives (hors scope immédiat)

- **Déploiement CI/CD** : workflows `develop` → préprod et `main` → prod avec approbation manuelle.
- **Point restant** : le refresh silencieux reste vérifié en intégration ; E2E dédié à TTL réduit en perspective.
- **Audit RGAA** : T-A.1 consigné ✅ ; T-A.2 ⚠️ (revue code + arbre d’accessibilité, **pas** de session lecteur d’écran) — journal dans `docs/cahier-de-recette.md`.
- **Hors scope v1** : MFA, CAPTCHA, détection d'anomalies géolocalisées.
