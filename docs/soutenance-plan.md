# Plan de soutenance — Equime

> Durée indicative : 30–40 min (démo 15 min, questions 15 min). Adapter au jury CDA.

## 1. Introduction (2 min)

- Contexte : refonte d’un outil de gestion de centre équestre (projet CDA RNCP37873).
- Objectif : centraliser familles, planning, cavalerie, facturation et relation client.
- Stack : monorepo JS ESM, React + Express + Prisma, Docker, CI GitHub Actions.

## 2. Architecture (5 min)

- Schéma couches API : route → Zod → controller → service → Prisma (`docs/architecture.md`).
- Auth JWT maison : access 15 min, refresh rotatif cookie httpOnly (`docs/securite.md`).
- Partage des schémas Zod dans `packages/shared`.

## 3. Script de démonstration (15 min)

Comptes seed recette (`docs/cahier-de-recette.md`) : admin / moniteur / client — `Recette!2026`.

| # | Acteur | Écran | Message clé |
|---|---|---|---|
| 1 | Visiteur | `/register` puis déconnexion | Inscription sécurisée, famille créée |
| 2 | Client | Cavaliers → ajout → planning → inscription cours | Parcours E2E-2 |
| 3 | Moniteur | Planning → appel → attribution chevaux | Algorithme d’attribution (score niveau + affinités + charge) |
| 4 | Client | Factures → paiement FAC-2026-0002 | Cycle facturation E2E-4 |
| 5 | Admin | Dashboard / cavalerie / facturation | Vue opérationnelle |
| 6 | (option) | Messagerie ou événement | Modules relationnels Phase 5 |

**Plan B** : si réseau indisponible, montrer enregistrement Playwright ou captures + `npm test -w apps/api`.

## 4. Qualité & conformité (5 min)

- Tests : unitaires + intégration API + Playwright (4 parcours métier critiques E2E-1–4 + fumée étendue E2E-5–13).
- Traçabilité : `docs/traceabilite.md`.
- RGPD : `docs/rgpd.md` (consentement médical, anonymisation).
- OWASP : tableau `docs/securite.md`.

## 5. Bilan & perspectives (3 min)

- Phases 0–6 livrées sur branche `feature/phase-3-core` (merge develop à planifier).
- Pistes : export RGPD, KPIs dashboard, purge tokens, déploiement prod SSL.

## 6. Supports à avoir sous la main

- `docs/questions-jury.md`
- `docs/cahier-de-recette.md` (journal d’exécution signé)
- Rapport de couverture CI (seuil 70 % API)

