# UML — Diagramme de séquence : authentification complète

> Livrable Phase 1. Couvre le cycle de vie complet des jetons : connexion, rafraîchissement
> silencieux avec **rotation**, et **détection de réutilisation** (révocation de la famille).
> Implémentation en Phase 2 (`apps/api/src/services/` + `apps/web/src/lib/apiClient.js`).

## Principes

- **Access token** : JWT signé, durée 15 min, conservé **en mémoire** côté front (jamais en localStorage).
- **Refresh token** : opaque (aléatoire cryptographique), durée 7 jours, transporté par **cookie httpOnly + Secure + SameSite=Strict**, persisté **hashé** en base (table `refresh_tokens`).
- **Rotation** : chaque usage d'un refresh token le révoque et en émet un nouveau, membre de la même **famille** (`familyId`).
- **Détection de réutilisation** : si un token déjà révoqué est présenté (vol de cookie, rejeu), toute la famille est révoquée → déconnexion de toutes les sessions issues de cette lignée.

## 1. Connexion

```mermaid
sequenceDiagram
    autonumber
    actor U as Utilisateur
    participant W as SPA React<br/>(apiClient.js + store Zustand)
    participant A as API Express<br/>(/api/v1/auth)
    participant S as authService / tokenService
    participant DB as PostgreSQL
    participant R as Redis

    U->>W: saisit email + mot de passe
    W->>A: POST /auth/login {email, password}
    A->>A: validate(loginSchema) — Zod
    A->>S: login(email, password)
    S->>DB: SELECT user WHERE email
    DB-->>S: user (passwordHash, role, banned)
    S->>S: argon2.verify(hash, password)
    alt identifiants invalides ou compte banni
        S-->>A: AppError 401 (message générique)
        A-->>W: 401 {error} — pas d'indice sur le champ fautif
    else succès
        S->>S: génère access JWT (15 min)<br/>+ refresh opaque (7 j, familyId neuf)
        S->>DB: INSERT refresh_tokens(hash, familyId, expiresAt)
        S-->>A: {accessToken, user} + refresh en clair
        A-->>W: 200 {accessToken, user}<br/>Set-Cookie: refresh (httpOnly, Secure, SameSite=Strict)
        W->>W: accessToken en mémoire,<br/>user dans le store Zustand
    end
    Note over R: le rate limiting Redis protège /auth/*<br/>(tentatives par IP + par compte)
```

## 2. Rafraîchissement silencieux avec rotation

```mermaid
sequenceDiagram
    autonumber
    participant W as SPA React<br/>(intercepteur apiClient.js)
    participant A as API Express
    participant S as tokenService
    participant DB as PostgreSQL

    W->>A: GET /api/v1/families/me (Authorization: Bearer access)
    A-->>W: 401 TOKEN_EXPIRED (access périmé)
    Note over W: l'intercepteur met la requête en file<br/>et déclenche UN SEUL refresh concurrent
    W->>A: POST /auth/refresh (cookie refresh)
    A->>S: rotate(refreshToken)
    S->>S: hash(refreshToken)
    S->>DB: SELECT refresh_tokens WHERE tokenHash
    DB-->>S: token {familyId, expiresAt, revokedAt: null}
    S->>DB: UPDATE token SET revokedAt = now()  — rotation
    S->>DB: INSERT nouveau token (même familyId)
    S-->>A: {nouvel access, nouveau refresh}
    A-->>W: 200 {accessToken}<br/>Set-Cookie: refresh (rotaté)
    W->>W: remplace l'access en mémoire
    W->>A: rejoue GET /families/me (nouvel access)
    A-->>W: 200 {famille}
```

## 3. Détection de réutilisation → révocation de la famille

```mermaid
sequenceDiagram
    autonumber
    actor X as Attaquant<br/>(cookie volé/rejoué)
    participant A as API Express
    participant S as tokenService
    participant DB as PostgreSQL
    participant R as Redis
    actor U as Utilisateur légitime

    X->>A: POST /auth/refresh (ancien refresh déjà rotaté)
    A->>S: rotate(refreshToken)
    S->>DB: SELECT WHERE tokenHash
    DB-->>S: token {familyId, revokedAt: non null} ⚠️
    Note over S: réutilisation détectée :<br/>un token révoqué est présenté
    S->>DB: UPDATE refresh_tokens<br/>SET revokedAt = now()<br/>WHERE familyId = … — toute la famille
    S->>R: blacklist des access tokens de la famille<br/>(TTL = durée de vie restante)
    S-->>A: AppError 401 TOKEN_REUSED
    A-->>X: 401 + Set-Cookie expiré
    U->>A: POST /auth/refresh (son refresh, même famille)
    A-->>U: 401 — famille révoquée, reconnexion requise
    Note over U: sécurité > confort :<br/>l'utilisateur légitime se reconnecte
```

## 4. Déconnexion

```mermaid
sequenceDiagram
    autonumber
    actor U as Utilisateur
    participant W as SPA React
    participant A as API Express
    participant S as tokenService
    participant DB as PostgreSQL
    participant R as Redis

    U->>W: clic « Se déconnecter »
    W->>A: POST /auth/logout (cookie refresh + Bearer access)
    A->>S: logout(refreshToken, accessToken)
    S->>DB: UPDATE refresh_tokens SET revokedAt WHERE familyId — famille entière
    S->>R: SETEX blacklist:accessJti (TTL restant)
    A-->>W: 204 + Set-Cookie refresh expiré
    W->>W: purge accessToken mémoire + store Zustand → redirection /login
```
