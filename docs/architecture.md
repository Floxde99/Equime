# Architecture — Equime

> Livrable Phase 0. Décrit le monorepo, l'architecture applicative et les trois environnements Docker.
> Les décisions structurantes sont tracées en ADR dans `docs/adr/` (à partir de la Phase 1).

## 1. Vue d'ensemble

Equime est une application web en **monorepo npm workspaces**, 100 % JavaScript (ESM, Node 22) :

| Workspace | Rôle |
|---|---|
| `apps/api` | API REST Express 5 — couches strictes : route → validation Zod → controller → service → Prisma |
| `apps/web` | SPA React 18 (Vite), organisée par features, thème Tailwind 4 dérivé du design system |
| `packages/shared` | Schémas Zod, énumérations et libellés français — source unique de vérité front/back |

```mermaid
flowchart LR
    subgraph Navigateur
        SPA[React SPA<br/>TanStack Query + Zustand]
    end
    subgraph Monorepo
        WEB[apps/web<br/>Vite / React 18]
        API[apps/api<br/>Express 5]
        SHARED[packages/shared<br/>Zod + enums + labels]
    end
    PG[(PostgreSQL 17)]
    RD[(Redis 7)]

    SPA -->|"HTTP /api/v1 (JSON)"| API
    WEB -.->|import| SHARED
    API -.->|import| SHARED
    API -->|Prisma| PG
    API -->|"blacklist tokens + cache planning"| RD
```

### Couches de l'API

```mermaid
flowchart TD
    R[Route Express] --> V["Middleware validate(schema) — Zod"]
    V --> C[Controller — fin, sans logique]
    C --> S["Service métier — pur, JSDoc, ne connaît ni req ni res"]
    S --> P[Prisma → PostgreSQL]
    S --> RE[Redis]
    C -->|next err| E[errorHandler centralisé — AppError]
```

## 2. Environnement de développement

`docker-compose.yml` — hot reload, volumes locaux, ports exposés pour le debug.

```mermaid
flowchart TB
    DEV[Poste développeur] -->|localhost:5173| WEBC
    DEV -->|localhost:3000/health| APIC

    subgraph "Docker Compose (dev)"
        WEBC["web — Vite dev server<br/>volume ./apps/web/src (HMR)"]
        APIC["api — node --watch<br/>volume ./apps/api/src"]
        PGC[("postgres:17-alpine<br/>volume postgres-data")]
        RDC[("redis:7-alpine")]
    end

    WEBC -->|"proxy Vite /api → api:3000"| APIC
    APIC --> PGC
    APIC --> RDC
```

- Le serveur Vite proxifie `/api` vers le conteneur `api` : pas de CORS inter-domaines en dev, mêmes chemins qu'en prod.
- `node --watch` et le HMR Vite rechargent à chaud le code monté en volume (polling activé pour les volumes Windows).
- Postgres et Redis exposent leurs ports sur l'hôte pour l'outillage local (Prisma Studio, redis-cli).

## 3. Environnement de préproduction (finalisé en Phase 6)

`docker-compose.preprod.yml` — **iso-prod** : mêmes images multi-stage que la production (tirées de ghcr.io, tag `develop`), même Nginx. Base dédiée alimentée par le **seed de recette** (données réalistes anonymisées). Le **cahier de recette** y est exécuté avant chaque mise en production.

```mermaid
flowchart TB
    U[Testeur / PO] -->|"HTTPS preprod.equime.fr"| NGP

    subgraph "VPS — Docker Compose (préprod)"
        NGP["nginx frontal<br/>reverse proxy + SSL"]
        WEBP["web — build statique<br/>ghcr.io/…/equime-web:develop"]
        APIP["api — node:22-alpine non-root<br/>ghcr.io/…/equime-api:develop"]
        PGP[("postgres:17 — réseau interne<br/>seed de recette")]
        RDP[("redis:7 — réseau interne")]
    end

    NGP --> WEBP
    NGP -->|"/api"| APIP
    APIP --> PGP
    APIP --> RDP
```

## 4. Environnement de production (finalisé en Phase 6)

`docker-compose.prod.yml` — un seul point d'entrée : Nginx frontal (SSL Let's Encrypt, headers de sécurité, rate limit, gzip). Postgres et Redis sur réseau interne, **aucun port exposé**. API en image multi-stage `node:22-alpine`, user non-root.

```mermaid
flowchart TB
    CL[Clients / Moniteurs / Admin] -->|"HTTPS equime.fr"| NG

    subgraph "VPS — Docker Compose (prod)"
        NG["nginx frontal<br/>SSL Let's Encrypt · headers · rate limit · gzip"]
        WEBPR["web — build statique Vite<br/>servi par Nginx"]
        APIPR["api — node:22-alpine<br/>multi-stage · non-root"]
        PGPR[("postgres:17<br/>réseau interne uniquement")]
        RDPR[("redis:7<br/>réseau interne uniquement")]
    end

    NG --> WEBPR
    NG -->|"/api"| APIPR
    APIPR --> PGPR
    APIPR --> RDPR
```

## 5. Flux CI/CD (GitFlow)

```mermaid
flowchart LR
    F[feature/*] -->|PR| D[develop]
    D -->|"CI : lint + tests unit + intégration"| BUILD1["build images → ghcr.io"]
    BUILD1 -->|automatique| PREPROD[Déploiement préprod]
    D -->|PR release| M[main]
    M --> BUILD2["build images → ghcr.io"]
    BUILD2 -->|"approbation manuelle<br/>(environment protection)"| PROD[Déploiement prod]
    H[hotfix/*] -->|PR| M
```

- Branches : `main` (prod), `develop` (préprod), `feature/*`, `hotfix/*`. Commit direct sur `main` interdit.
- Sur chaque PR et push : lint + tests unitaires + tests d'intégration (services Postgres + Redis en CI à partir de la Phase 2).
- Migrations Prisma versionnées (`prisma migrate deploy` au déploiement) — jamais de `db push` hors dev.

## 6. Ports et URLs (dev)

| Service | URL / port |
|---|---|
| Web (Vite) | http://localhost:5173 |
| API | http://localhost:3000 — santé : `GET /health` |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |
