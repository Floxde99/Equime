# ADR 002 — Authentification JWT maison (sans Passport ni solution clé en main)

- **Statut** : accepté (Phase 1, implémentation Phase 2)
- **Décideur** : développeur principal · **Proposé par** : assistant

## Contexte

L'application requiert une authentification par rôles (client, moniteur, admin) avec sessions durables et sécurisées. La v0.1.0 utilisait Better Auth. Le module d'authentification est le plus scruté lors de l'oral CDA : chaque mécanisme doit être compris, justifié et démontrable dans le code.

## Options étudiées

| Option | Pour | Contre |
|---|---|---|
| **JWT maison** (jsonwebtoken + argon2 + logique de rotation propre) | Maîtrise totale démontrable au jury, surface exacte du besoin, rotation + détection de réutilisation implémentées explicitement, aucune magie | Responsabilité de bien faire (compensée par un plan de tests exhaustif et les référentiels OWASP) |
| Passport.js | Standard historique, nombreuses stratégies | N'apporte que l'abstraction « stratégie » — la gestion des refresh tokens resterait à écrire ; couche d'indirection difficile à justifier pour une seule stratégie locale |
| Better Auth / Lucia / Auth.js | Rapides à mettre en place, sécurité par défaut | Boîte noire contraire à l'objectif pédagogique, dépendance forte au vendor, personnalisation de la rotation/famille de tokens limitée |

## Décision

**Implémentation maison** :

- Access token **JWT signé, 15 min**, stocké en mémoire côté front (jamais en localStorage — XSS).
- Refresh token **opaque, 7 jours**, cookie `httpOnly + Secure + SameSite=Strict`, **hashé en base** (`refresh_tokens`), **rotation à chaque usage**, **détection de réutilisation** avec révocation de toute la famille de tokens.
- Mots de passe **argon2id** (vainqueur de la Password Hashing Competition, résistant GPU ; paramètres mémoire ≥ 19 MiB conformes aux recommandations OWASP).
- Blacklist Redis des access tokens révoqués (logout, ban, réutilisation détectée), TTL aligné sur l'expiration.

## Conséquences

- Table `refresh_tokens` (hash, familyId, expiresAt, revokedAt) + `password_reset_tokens` au schéma.
- Tests exigés (Phase 2) : rotation, expiration, réutilisation → famille révoquée, utilisateur banni, rôle insuffisant.
- Séquence complète documentée : `docs/uml/sequence-authentification.md` ; mapping OWASP dans `docs/securite.md`.
- Sujet de veille suggéré (RESEARCH-LOG personnel) : « argon2id vs bcrypt » et « rotation de refresh tokens (RFC 6749 §10.4) ».
