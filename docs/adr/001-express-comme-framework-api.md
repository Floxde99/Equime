# ADR 001 — Express 5 comme framework API

- **Statut** : accepté (Phase 0/1)
- **Décideur** : développeur principal · **Proposé par** : assistant

## Contexte

L'API REST d'Equime (~15 modules, auth JWT maison, middlewares de sécurité) nécessite un framework HTTP Node.js. La v0.1.0 utilisait Hono. Le projet est évalué dans le cadre du titre CDA : la lisibilité de l'architecture en couches et la capacité à justifier chaque brique comptent autant que la performance.

## Options étudiées

| Option | Pour | Contre |
|---|---|---|
| **Express 5** | Standard de fait (écosystème, middlewares éprouvés : helmet, cors…), architecture route→middleware→controller limpide à présenter au jury, v5 gère nativement les erreurs async, documentation abondante | Moins performant que Fastify en débit brut, API vieillissante |
| Fastify | Très performant, validation par schéma intégrée, plugins officiels | Écosystème de plugins plus fragile, courbe d'apprentissage (encapsulation), la validation intégrée ferait doublon avec Zod partagé front/back |
| Hono | Léger, moderne, multi-runtime | Reprendre la stack abandonnée de la v0.1.0, écosystème jeune, moins de recul en production Node |

## Décision

**Express 5.** Le débit n'est pas le facteur limitant d'une application de gestion (volumétrie faible, cache Redis sur le planning). L'écosystème mature et la clarté du modèle middleware servent directement les exigences du référentiel (sécurité identifiable, couches strictes route → validation Zod → controller → service).

## Conséquences

- Middlewares : `helmet`, `cors` (whitelist), `express.json`, `pino-http`, `validate(schema)` maison, `requireAuth`/`requireRole` maison.
- Express 5 rejette proprement les promesses : plus besoin de wrapper `asyncHandler`.
- La validation reste entièrement portée par Zod (`packages/shared`) — aucune dépendance à un mécanisme propre au framework, l'API resterait portable.
