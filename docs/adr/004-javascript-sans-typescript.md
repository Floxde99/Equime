# ADR 004 — JavaScript moderne sans TypeScript (choix assumé)

- **Statut** : accepté (contrainte de projet, Phase 0/1)
- **Décideur** : développeur principal · **Proposé par** : développeur principal

## Contexte

TypeScript est majoritaire dans l'écosystème professionnel, et le jury posera la question. Le projet fait le choix délibéré du **JavaScript moderne (ESM, Node 22)** sur tout le monorepo. Ce choix doit être argumenté et ses risques activement compensés.

## Options étudiées

| Option | Pour | Contre |
|---|---|---|
| TypeScript | Typage statique, refactorings sûrs, standard du marché | Chaîne de compilation sur les 3 workspaces, friction outillage (Docker dev, seeds, scripts), courbe syntaxique qui déplace l'attention du métier vers le typage |
| **JavaScript + garde-fous** | Exécution directe (Node 22 ESM natif), stack allégée, focus sur l'architecture et le métier ; la **validation runtime** protège là où les types statiques ne protègent pas (inputs réseau) | Pas de vérification statique inter-fichiers par défaut, refactorings plus risqués |

## Décision

**JavaScript intégral**, avec quatre compensations systématiques :

1. **Zod valide TOUS les inputs** au runtime : body/params/query de chaque route (`validate(schema)`), formulaires front (react-hook-form + mêmes schémas partagés), variables d'environnement au boot (crash explicite). Un type TS n'existe qu'à la compilation ; Zod vérifie les données réelles en production.
2. **JSDoc complet** (`@param`, `@returns`, `@typedef`) sur tous les services métier et helpers partagés.
3. **`// @ts-check`** en tête des fichiers critiques : l'éditeur (tsserver) vérifie les JSDoc sans étape de compilation — typage graduel gratuit.
4. **ESLint strict** (`eslint:recommended` + import/react/react-hooks) + Prettier en CI.

## Argumentaire jury (« pourquoi pas TypeScript ? »)

- Le risque principal d'une application web est la **donnée entrante non fiable** ; TS ne la contrôle pas à l'exécution, Zod oui. Le projet met l'effort là où est le risque.
- JSDoc + `@ts-check` fournissent l'autocomplétion et la détection d'erreurs dans l'éditeur — une partie substantielle de la valeur de TS sans sa chaîne de build.
- Choix conscient de périmètre : démontrer la maîtrise des fondations JavaScript (prototype, modules ESM, async) plutôt que d'une surcouche.
- Limite reconnue : sur une équipe nombreuse ou un domaine plus complexe, TypeScript serait le bon choix — inscrit comme **perspective d'évolution** (migration progressive possible : les JSDoc sont convertibles).

## Conséquences

- Contrainte transverse : aucun fichier `.ts` dans `apps/` ni `packages/` (le client Prisma généré est transpilé en JS — ADR 003).
- Couverture de tests ≥ 70 % sur `apps/api/src` : les tests remplacent le compilateur comme filet de refactoring.
- shadcn/ui configuré en mode JavaScript (`"tsx": false`).
