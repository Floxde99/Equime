# ADR 009 — Règle de niveau asymétrique pour l'attribution des chevaux

- **Statut** : accepté (remplace le critère « niveau compatible +5 » de l'US-5.1)
- **Décideur** : développeur principal
- **Date** : 2026-09-23

## Contexte

L'US-5.1 définissait un score : favori +10, niveau compatible +5, à éviter −15,
charge −5 par heure. Le niveau n'était qu'une **préférence**, pas une contrainte.

Le jeu d'essai du dossier (`docs/cahier-de-tests.md`, Module 5), exécuté sur la fonction
réelle `simulateHorseAssignments`, a mis en évidence deux écarts :

1. **Le bonus de niveau (+5) vaut exactement une heure de charge (−5).** Un
   cheval inadapté mais moins chargé passe donc devant un cheval adapté : Emma
   (galop 4) recevait Caramel, poney initiation–galop 2.
2. **L'attribution est gloutonne, dans l'ordre d'inscription.** En prenant le
   poney, Emma a poussé Tom (galop 1) sur Tornade, cheval galop 3–7 : un
   débutant sur un cheval confirmé, soit un **risque de sécurité**. Hugo
   (initiation) s'est retrouvé sans cheval alors que Caramel lui convenait.

Les stages (`EventRegistration`) n'ont aucun filtre de niveau à l'inscription, ce
qui rend ce mélange de niveaux courant.

## Options étudiées

| Option | Pour | Contre |
|---|---|---|
| A — Garder le score, ajouter un avertissement | Aucun changement métier | Le risque subsiste : l'algorithme propose toujours le cheval dangereux |
| B — Filtre strict dans les deux sens | Le plus sûr | Plus de conflits ; un cavalier confirmé ne pourrait jamais monter un cheval plus facile |
| **C — Asymétrique** | Traite le **danger** (sous-niveau) comme une contrainte et le **gaspillage** (sur-niveau) comme une préférence | Deux règles à expliquer au lieu d'une |

## Décision

**Option C.** La fonction `levelFit(riderLevel, horse)` classe chaque couple :

| Cas | Signification | Traitement |
|---|---|---|
| `under` | cavalier sous le `minLevel` du cheval | **exclu** de l'attribution automatique (cours, stages, audit) |
| `over` | cavalier au-dessus du `maxLevel` | pénalité `OVER_LEVEL_PENALTY` = **−20** |
| `ok` | dans la plage | bonus +5 (inchangé) |

La pénalité de −20 dépasse le bonus de compatibilité plus trois heures de charge.
Un cheval adapté l'emporte donc sur un cheval trop facile, sauf s'il est très
chargé.

Le **moniteur garde la décision finale** (US-5.2) : les chevaux `under` restent
proposés dans les options d'override, avec l'avertissement « Cavalier sous le
niveau minimum du cheval ».

## Conséquences

- `apps/api/src/services/horseAssignment.js` : `levelFit`, `OVER_LEVEL_PENALTY`,
  `candidateWarning` ; filtre `under` dans `simulateHorseAssignments`.
- Interface moniteur : l'avertissement réel s'affiche dans l'override (auparavant,
  toujours « à éviter »).
- Tests : le jeu d'essai du dossier est devenu un test unitaire
  (`horseAssignment.test.js`) ; les tests existants restent valides.
- Résultat du jeu d'essai : Emma → Tornade, Tom → Caramel, Léa → Éclair, Hugo en
  conflit (inévitable : 3 chevaux éligibles pour 4 cavaliers) ; **aucune
  attribution dangereuse**.
- Limite connue : l'algorithme reste glouton. Traiter d'abord les cavaliers ayant
  le moins de chevaux possibles réduirait encore les conflits ; c'est une
  évolution possible, non nécessaire pour la sécurité.
