# Sécurité — Equime

> Livrable Phase 2 (v1). Tableau de correspondance **mesure ↔ vulnérabilité OWASP Top 10 (2021) ↔ fichier**.
> Enrichi à chaque phase ; audit final en Phase 6.

## Synthèse

Equime applique une défense en profondeur : validation systématique des entrées (Zod), authentification JWT maison avec rotation des refresh tokens, rate limiting Redis, headers HTTP durcis, et séparation stricte des rôles. Aucune donnée sensible n'est codée en dur — tout transite par des variables d'environnement validées au boot.

## Tableau OWASP

| OWASP 2021 | Risque | Mesure implémentée | Fichier(s) |
|---|---|---|---|
| **A01** — Broken Access Control | Accès à des ressources sans droit | Middleware `requireAuth` + `requireRole` sur chaque route protégée ; guards React par rôle ; isolation des données par `familyId` (Phases 3+) | `apps/api/src/middlewares/auth.js`, `apps/web/src/features/auth/guards.jsx` |
| **A02** — Cryptographic Failures | Fuite de secrets, mots de passe faibles | Mots de passe **argon2id** ; refresh/reset tokens **hashés SHA-256** en BDD ; secrets JWT en `.env` (≥ 32 car.) ; cookie refresh **httpOnly + Secure + SameSite=Strict** ; access token **jamais en localStorage** | `apps/api/src/lib/passwords.js`, `apps/api/src/services/tokenService.js`, `apps/web/src/lib/apiClient.js`, `apps/api/src/controllers/authController.js` |
| **A03** — Injection | SQL / NoSQL / command injection | Prisma ORM (requêtes paramétrées) ; validation Zod sur body/params/query avant tout traitement | `apps/api/src/middlewares/validate.js`, `packages/shared/src/schemas/` |
| **A04** — Insecure Design | Flux auth faibles | Rotation refresh + détection réutilisation (révocation famille) ; logout révoque refresh + blacklist access ; reset password révoque toutes les sessions | `apps/api/src/services/tokenService.js`, `docs/uml/sequence-authentification.md`, ADR 002 |
| **A05** — Security Misconfiguration | Stack trace exposée, headers manquants | `helmet()` ; stack trace **uniquement en dev** ; config env validée Zod (crash si manquante) ; `trust proxy` derrière Nginx | `apps/api/src/app.js`, `apps/api/src/middlewares/errorHandler.js`, `apps/api/src/config/env.js` |
| **A06** — Vulnerable Components | Dépendances obsolètes | `npm audit` en CI ; dépendances épinglées via lockfile ; Node 22 LTS | `.github/workflows/ci.yml`, `package-lock.json` |
| **A07** — Identification & Auth Failures | Brute force, énumération | Rate limiting Redis sur `/api/v1/auth/*` ; messages d'erreur **génériques** (login, forgot-password) ; comptes **bannis** rejetés + sessions révoquées | `apps/api/src/middlewares/rateLimit.js`, `apps/api/src/services/authService.js`, `apps/api/src/routes/auth.routes.js` |
| **A08** — Software & Data Integrity | Tokens forgés, CSRF | JWT signé HS256 (secret fort) ; blacklist Redis par `jti` ; cookie SameSite=Strict ; CORS whitelist stricte | `apps/api/src/services/tokenService.js`, `apps/api/src/middlewares/auth.js`, `apps/api/src/app.js` |
| **A09** — Security Logging Failures | Incidents non tracés | Logs structurés **pino** (JSON prod) ; tentatives auth refusées loggées en `warn` ; pas de mot de passe/token dans les logs | `apps/api/src/lib/logger.js`, `apps/api/src/middlewares/errorHandler.js` |
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
| `POST /login` | 10 req | 15 min |
| `POST /refresh` | 60 req | 15 min |
| `POST /forgot-password` | 5 req | 1 h |
| `POST /reset-password` | 10 req | 1 h |

Implémentation : compteur Redis par IP + préfixe (`apps/api/src/middlewares/rateLimit.js`).

### Politique de mot de passe

- Minimum 12 caractères, majuscule + minuscule + chiffre.
- Schéma partagé front/back : `packages/shared/src/schemas/auth.js`.
- Hash : argon2id (paramètres OWASP — `apps/api/src/lib/passwords.js`).

### Headers HTTP (Express + Nginx prod)

| Header | Source | Phase |
|---|---|---|
| CSP, X-Content-Type-Options, X-Frame-Options… | `helmet()` | 2 ✅ |
| HSTS, rate limit Nginx, gzip | Nginx frontal | 6 |

## Tests de sécurité automatisés

| Scénario | Réf. cahier | Fichier test |
|---|---|---|
| Inscription + famille créée | T-1.1 | `apps/api/src/tests/auth.test.js` |
| Email déjà pris (409) | T-1.2 | idem |
| Mot de passe faible (400 Zod) | T-1.3 | idem |
| Login OK / KO générique | T-1.4, T-1.5 | idem |
| Compte banni (403) | T-1.6 | idem |
| Rotation refresh | T-1.7 | idem |
| Réutilisation → famille révoquée | T-1.8 | idem |
| Route sans token (401) | T-1.9 | `apps/api/src/middlewares/auth.test.js` |
| Rôle insuffisant (403) | T-1.10 | idem |
| Rate limiting (429) | T-1.11 | `apps/api/src/tests/auth.test.js` |
| Hash token / argon2 | — | `apps/api/src/services/tokenService.test.js`, `passwords.test.js` |

## Perspectives (phases suivantes)

- **Phase 3** : contrôle MIME + taille uploads ; IDOR sur ressources famille.
- **Phase 6** : audit accessibilité RGAA ; headers Nginx prod ; parcours E2E auth (E2E-1).
- **Hors scope v1** : MFA, CAPTCHA, détection d'anomalies géolocalisées.
