# ADR 003 — Prisma 7 comme ORM PostgreSQL

- **Statut** : accepté (Phase 1)
- **Décideur** : développeur principal · **Proposé par** : assistant

## Contexte

Le modèle compte ~25 tables relationnelles avec des transactions critiques (attribution des chevaux). Le projet est 100 % JavaScript (ADR 004) et exige des migrations versionnées rejouables sur 3 environnements. La v0.1.0 utilisait Drizzle.

## Options étudiées

| Option | Pour | Contre |
|---|---|---|
| **Prisma 7** | Schéma déclaratif lisible (proche du MPD Merise — atout dossier), `prisma migrate` versionné de référence, transactions interactives, Studio pour l'exploration, driver adapters natifs (pg) | Le générateur v7 n'émet que du TypeScript (contournement ci-dessous), DSL propriétaire |
| Drizzle | Léger, SQL-first, performant | Reprise de la stack abandonnée ; définition du schéma en TS/JS moins parlante comme livrable de conception ; migrations moins outillées |
| Knex + requêtes SQL | Contrôle total, SQL démontrable | Beaucoup de code de mapping manuel, risque d'injection accru sans query builder typé, migrations artisanales |

## Décision

**Prisma 7** (version courante — pas de version antérieure pour ne pas démarrer un projet neuf sur une branche en fin de vie), avec le contournement suivant pour le projet sans TypeScript :

- Le générateur `prisma-client` émet du TS dans `apps/api/generated/prisma` (`generatedFileExtension: "ts"`, `importFileExtension: "js"`).
- Le script `apps/api/scripts/build-prisma-client.js` (esbuild) **transpile immédiatement le dossier généré en JavaScript pur** puis supprime les `.ts`. Enchaîné par `npm run prisma:generate`.
- Le dossier généré est ignoré par git, ESLint et Prettier (artefact de build, régénérable).
- Connexion via driver adapter officiel `@prisma/adapter-pg` (obligatoire en v7).

## Conséquences

- `prisma migrate dev` en développement, `prisma migrate deploy` en préprod/prod — **jamais `db push`** hors dev.
- Configuration dans `apps/api/prisma.config.js` (JS pur, supporté officiellement), seed déclaré (`node prisma/seed.js`).
- Le `schema.prisma` sert de MPD exécutable : la correspondance MCD → MLD → MPD → schéma est documentée dans `docs/merise/`.
- Risque suivi : si une version future de Prisma sait émettre du JS nativement, le script de transpilation sera supprimé (isolé et documenté à cet effet).
