# Equime

Equestrian center management web application — full rewrite (v3) built as part of the French **CDA professional certification** (Concepteur Développeur d'Applications, RNCP37873).

Equime helps an equestrian center run its daily operations: families and riders, horse stable management, recurring course planning, **automatic horse-to-rider assignment**, event registrations, invoicing, volunteering and messaging — with four roles: visitor, client, instructor, admin.

## Stack

**100% modern JavaScript (ESM, Node 22) — no TypeScript.** Static typing is compensated by Zod validation on every input (API, forms, env config), full JSDoc on business services, and strict ESLint.

| Layer | Technologies |
|---|---|
| Frontend (`apps/web`) | React 18, Vite, React Router v7, TanStack Query v5, Zustand, Tailwind CSS 4, shadcn/ui |
| Backend (`apps/api`) | Node.js 22, Express 5, Prisma 7, PostgreSQL 17, Redis 7, custom JWT auth (argon2id, refresh token rotation) |
| Shared (`packages/shared`) | Zod schemas, enums and French labels — single source of truth |
| Infrastructure | Docker Compose (dev / preprod / prod), Nginx, GitHub Actions CI/CD, GitFlow |

## Monorepo layout

```
apps/api          Express 5 REST API (layered: route → validation → controller → service → Prisma)
apps/web          React SPA (feature-based structure)
packages/shared   Zod schemas, enums, labels shared by front and back
docker/nginx      Nginx configurations (dev / preprod / prod)
docs              Project documentation (French): architecture, ADRs, backlog, security, RGPD…
```

## Prerequisites

- Docker Desktop (Compose v2+)
- Node.js ≥ 22 and npm ≥ 10 (for linting, tests and tooling outside containers)

## Quickstart (development)

```bash
cp .env.example .env
npm install
npm run prisma:generate   # generate the Prisma client (transpiled to plain JS)
npm run dev               # or: make dev — starts postgres, redis, api (hot reload), web (vite)
npm run migrate           # apply database migrations
npm run seed              # load the development dataset (4 accounts, password: Equime!2026)
```

- Web app: http://localhost:5173
- API health check: http://localhost:3000/health

## Scripts

| Command | Description |
|---|---|
| `npm run dev` / `make dev` | Start the full dev environment (Docker Compose) |
| `npm run down` / `make down` | Stop and remove containers |
| `npm run logs` / `make logs` | Follow container logs |
| `npm run lint` | Lint the whole monorepo (ESLint flat config) |
| `npm test` | Run tests in all workspaces (Vitest) |
| `npm run migrate` / `make migrate` | Apply Prisma migrations (from Phase 1) |
| `npm run seed` / `make seed` | Seed the database (from Phase 1) |

## Environments

| Environment | Compose file | Purpose |
|---|---|---|
| Development | `docker-compose.yml` | Hot reload, local volumes |
| Preproduction | `docker-compose.preprod.yml` | Production-identical images, acceptance testing (skeleton — finalized in Phase 6) |
| Production | `docker-compose.prod.yml` | Multi-stage images, non-root user, Nginx + SSL (skeleton — finalized in Phase 6) |

## Documentation

All project documentation lives in [`docs/`](docs/) (in French). Key references:

| Document | Purpose |
|---|---|
| [`architecture.md`](docs/architecture.md) | System overview and layering |
| [`backlog.md`](docs/backlog.md) | Agile backlog (MoSCoW user stories) |
| [`cahier-de-tests.md`](docs/cahier-de-tests.md) | Test catalog |
| [`cahier-de-recette.md`](docs/cahier-de-recette.md) | Acceptance test book (Phase 6) |
| [`traceabilite.md`](docs/traceabilite.md) | Requirements → modules → tests matrix |
| [`rgpd.md`](docs/rgpd.md) | GDPR processing, consent, retention |
| [`securite.md`](docs/securite.md) | OWASP controls mapping |
| [`soutenance-plan.md`](docs/soutenance-plan.md) | Demo script for the oral defense |
| [`questions-jury.md`](docs/questions-jury.md) | Anticipated jury Q&A |
| [`design-system.md`](docs/design-system.md) | UI tokens and components |
| [`adr/`](docs/adr/) | Architecture decision records |

## License

Educational project — all rights reserved.

